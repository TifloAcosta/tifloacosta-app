import test from 'node:test';
import assert from 'node:assert/strict';
import { collectIosVoiceOverTargets, createIosContextActions } from '../src/core/ios-context-actions.mjs';

function control({ id = '', label = '', action = '', target = false, hidden = false } = {}) {
  const node = {
    id, textContent:label, dataset: { voAction:action, voTarget:target ? 'true':undefined },
    isConnected:true, hidden, disabled:false, clicks:0,
    getAttribute(key) { return key === 'aria-label' ? label : null; },
    click() { this.clicks += 1; },
    closest(selector) {
      if (selector.startsWith('[hidden]')) return null;
      if (selector === 'article') return this.article;
      return null;
    }
  };
  return node;
}
function article(primary, actions) {
  const card = { querySelectorAll() { return [primary, ...actions]; } };
  for (const c of [primary, ...actions]) c.article = card;
  return { primary, actions, card };
}
function root(items) { return { querySelectorAll() { return items.map(v=>v.primary); } }; }

test('registers only native actions of the actually focused item, not all nearby cards', () => {
  const first = article(control({ id:'video1',label:'Reproducir: Vídeo 1',action:'play',target:true }),
    [control({ label:'Compartir', action:'share' }), control({ label:'YouTube',action:'youtube' })]);
  const second = article(control({ id:'news2',label:'Leer: Noticia 2',action:'read',target:true }),
    [control({ label:'Favorito',action:'favorite' })]);
  const value = collectIosVoiceOverTargets(root([first,second]));
  assert.deepEqual(value.targets.map(x=>x.id), ['video1','news2']);
  assert.deepEqual(value.targets[0].actions.map(x=>x.id), ['play','share','youtube']);
  assert.deepEqual(value.targets[1].actions.map(x=>x.id), ['read','favorite']);
  assert.equal(value.handlers.get('video1').get('share'), first.actions[0]);
});

test('duplicate spoken labels are excluded rather than assigning wrong VoiceOver actions', () => {
  const first = article(control({ id:'a',label:'Abrir documento',action:'open',target:true }),[]);
  const second = article(control({ id:'b',label:'Abrir documento',action:'open',target:true }),[]);
  assert.deepEqual(collectIosVoiceOverTargets(root([first,second])).targets.map(x=>x.id), ['a']);
});

test('native targetAction clicks only a matching existing control and ignores stale focus', async () => {
  const first = article(control({ id:'video1',label:'Reproducir: Vídeo 1',action:'play',target:true }),
    [control({ label:'Compartir', action:'share' })]);
  let listener = null;
  const snapshots = [];
  const plugin = {
    async addListener(name, fn) {
      assert.equal(name, 'targetAction');
      listener = fn;
      return { remove: async () => { listener = null; } };
    },
    async registerAccessibleTargets(payload) { snapshots.push(payload.targets); }
  };
  const context = createIosContextActions({
    root: root([first]), plugin, lang: ()=>'es',
    observerFactory: () => ({ observe(){}, disconnect(){} })
  });
  await context.install();
  await context.refresh();
  assert.equal(snapshots.at(-1)[0].id, 'video1');
  assert.equal(listener({ targetId:'video1',action:'share' }), true);
  assert.equal(first.actions[0].clicks, 1);
  assert.equal(listener({ targetId:'wrong',action:'share' }), false);
  assert.equal(first.actions[0].clicks, 1);
  first.actions[0].isConnected = false;
  assert.equal(listener({ targetId:'video1',action:'share' }), false);
  await context.destroy();
  assert.deepEqual(snapshots.at(-1), []);
});
