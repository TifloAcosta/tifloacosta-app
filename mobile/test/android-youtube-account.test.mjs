import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { youtubeAccountError, createYoutubeAccountControls } from '../src/screens/youtube-account.mjs';

const source = relative => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');

class Node {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.handlers = new Map();
    this.attributes = {};
    this.textContent = '';
    this.value = '';
    this.id = '';
    this.disabled = false;
    this.focused = false;
  }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(type, fn) { this.handlers.set(type, fn); }
  insertBefore(item, existing) {
    const position = this.children.indexOf(existing);
    if (position < 0) throw new Error('Missing sibling');
    this.children.splice(position, 0, item);
  }
  querySelector(selector) {
    if (!selector.startsWith('#')) return null;
    return all(this).find(item => item.id === selector.slice(1)) || null;
  }
  focus() { this.focused = true; }
  click() { this.handlers.get('click')?.({ currentTarget: this }); }
}
function all(node) { return [node, ...node.children.flatMap(all)]; }
async function tick() {
  await new Promise(resolve => setImmediate(resolve));
}
async function withDocument(run) {
  const old = globalThis.document;
  globalThis.document = { createElement: tag => new Node(tag) };
  try { await run(); } finally {
    if (old === undefined) delete globalThis.document;
    else globalThis.document = old;
  }
}

test('Android account transport has a protected native callback and no new permissions', async () => {
  const [java, activity, manifest, screen, plugin, worker] = await Promise.all([
    source('android/app/src/main/java/com/tifloacosta/app/TifloYouTubeAccountPlugin.java'),
    source('android/app/src/main/java/com/tifloacosta/app/MainActivity.java'),
    source('android/app/src/main/AndroidManifest.xml'),
    source('src/screens/videos.mjs'),
    source('src/native/youtube-account-plugin.mjs'),
    source('../youtube-worker/src/index.js')
  ]);
  assert.match(activity, /registerPlugin\(TifloYouTubeAccountPlugin\.class\)/);
  assert.match(manifest, /android:scheme="tifloacosta" android:host="youtube-auth"/);
  assert.match(java, /AndroidKeyStore/);
  assert.match(java, /AES\/GCM\/NoPadding/);
  assert.match(java, /SHA-256/);
  assert.match(java, /\/auth\/native\/start/);
  assert.match(java, /\/auth\/native\/exchange/);
  assert.match(java, /Authorization", "Bearer /);
  assert.match(java, /SESSION_EXPIRED/);
  assert.doesNotMatch(java, /Log\.\w+\s*\(/);
  assert.match(worker, /ios-ticket/);
  assert.match(worker, /ios-session/);
  assert.match(plugin, /registerPlugin\('TifloYouTubeAccount'\)/);
  assert.match(screen, /createYoutubeAccountControls/);
  assert.match(screen, /youtubeAccount\.selectVideo/);
  assert.match(screen, /youtubeAccount\.dispose/);
  assert.match(screen, /player\.open\(item, button\)/);
  assert.match(screen, /videoRoot: player\.getAccountActionsHost\(\)/);
});

test('Android video lists expose one title and defer controls to the video itself', async () => {
  const [screen, player] = await Promise.all([
    source('src/screens/videos.mjs'),
    source('src/screens/video-player.mjs')
  ]);
  const searchCard = screen.split('function createSearchCard(video) {')[1]?.split('function setLoading(')[0];
  const ownList = screen.split('for (const item of items) {')[1]?.split('root.append(list);')[0];
  assert.ok(searchCard && ownList);
  assert.match(searchCard, /article\.append\(playButton\)/);
  assert.doesNotMatch(searchCard, /addExternalLink|addShareButton|addParagraph|article\.append\(title\)/);
  assert.match(ownList, /list\.append\(article\)/);
  assert.doesNotMatch(ownList, /addExternalLink|addShareButton|addFavoriteButton|article\.append\(title\)/);
  assert.match(screen, /player\.getExtraActionsHost\(\)/);
  assert.match(screen, /show\.setAttribute\('aria-expanded', String\(expanded\)\)/);
  assert.match(screen, /panel\.hidden = true/);
  assert.match(player, /section\.append\(heading, title, accountActionsHost, extraActionsHost, controls, positionWrap, status, frameWrap/);
  assert.match(player, /getExtraActionsHost: \(\) => extraActionsHost/);
  assert.match(player, /activeItem\?\.channelTitle/);
  assert.match(player, /activeItem\?\.durationSeconds/);
});

test('Android YouTube errors are announced clearly in Spanish and English', () => {
  assert.match(youtubeAccountError('SESSION_EXPIRED', 'es'), /caducado/);
  assert.match(youtubeAccountError('COMMENTS_DISABLED', 'es'), /desactivados/);
  assert.match(youtubeAccountError('AUTH_DENIED', 'en'), /cancelled/);
  assert.match(youtubeAccountError('QUOTA_EXCEEDED', 'en'), /limit/);
});

test('YouTube account panel signs in, shows selected-video actions and signs out', async () => {
  await withDocument(async () => {
    const root = new Node('main');
    const videoRoot = new Node('div');
    root.append(videoRoot);
    const links = [];
    let appUrlOpen;
    let removed = false;
    let signedIn = false;
    let subscribed = false;
    let rating = '';
    let published = '';
    const mockNative = {
      getSession: async () => ({ authenticated: signedIn }),
      beginSignIn: async () => ({ url: 'https://youtube-auth.tifloacosta.com/auth/native/start?challenge=ok' }),
      completeSignIn: async ({ url }) => {
        assert.match(url, /youtube-auth\?ticket=/);
        signedIn = true;
        return { authenticated: true };
      },
      signOut: async () => { signedIn = false; return { authenticated: false }; },
      getVideoState: async ({ videoId }) => {
        assert.equal(videoId, 'abcDEF123_-');
        return { subscribed, rating };
      },
      performAction: async ({ action, videoId, text }) => {
        assert.equal(videoId, 'abcDEF123_-');
        if (action === 'subscribe') subscribed = true;
        if (action === 'like') rating = 'like';
        if (action === 'comment') published = text;
        return {};
      }
    };
    const appPlugin = {
      addListener: async (type, callback) => {
        assert.equal(type, 'appUrlOpen');
        appUrlOpen = callback;
        return { remove: async () => { removed = true; } };
      }
    };
    const controller = createYoutubeAccountControls({
      root, videoRoot, accountPlugin: mockNative, appPlugin,
      lang: 'es',
      nativeActions: { openExternal: async url => { links.push(url); return true; } }
    });
    await tick();
    assert.ok(root.querySelector('#youtube-account-signin'));
    assert.equal(videoRoot.querySelector('#youtube-account-signin'), null);
    controller.selectVideo({ id: 'abcDEF123_-', title: 'Vídeo accesible' });
    root.querySelector('#youtube-account-signin').click();
    await tick();
    assert.equal(links.length, 1);
    assert.match(links[0], /^https:\/\/youtube-auth\.tifloacosta\.com/);
    appUrlOpen({ url: 'tifloacosta://youtube-auth?ticket=sealed-demo' });
    await tick();
    await tick();
    assert.ok(root.querySelector('#youtube-account-signout'));
    const subscribeButton = videoRoot.querySelector('#youtube-account-subscribe');
    assert.ok(subscribeButton, 'The subscribe action is next to the video, not the main account panel');
    subscribeButton.focus();
    subscribeButton.click();
    await tick();
    assert.strictEqual(videoRoot.querySelector('#youtube-account-unsubscribe'), subscribeButton,
      'Keep the original focused DOM button on subscribe');
    assert.equal(subscribeButton.focused, true);
    const likeButton = videoRoot.querySelector('#youtube-account-like');
    likeButton.focus();
    likeButton.click();
    await tick();
    assert.strictEqual(videoRoot.querySelector('#youtube-account-unlike'), likeButton,
      'Keep the original focused DOM button after liking');
    videoRoot.querySelector('#youtube-account-comment').click();
    const textarea = root.querySelector('#youtube-account-comment-text');
    assert.ok(textarea);
    textarea.value = 'Gracias por el vídeo';
    root.querySelector('#youtube-account-publish').click();
    await tick();
    assert.equal(published, 'Gracias por el vídeo');
    assert.equal(videoRoot.querySelector('#youtube-account-comment').focused, true,
      'Return TalkBack focus to the stable comment action after publishing');
    root.querySelector('#youtube-account-signout').click();
    await tick();
    assert.equal(signedIn, false);
    assert.ok(root.querySelector('#youtube-account-signin'));
    controller.dispose();
    await tick();
    assert.equal(removed, true);
  });
});

test('unrelated appUrlOpen links never complete an OAuth session', async () => {
  await withDocument(async () => {
    const root = new Node('main');
    let callback;
    let completed = 0;
    const control = createYoutubeAccountControls({
      root, lang: 'en',
      accountPlugin: {
        getSession: async () => ({ authenticated: false }),
        beginSignIn: async () => ({ url: 'https://youtube-auth.tifloacosta.com/auth/native/start?challenge=x' }),
        completeSignIn: async () => { completed++; return { authenticated: true }; },
        signOut: async () => ({ authenticated: false }),
        getVideoState: async () => ({}),
        performAction: async () => ({})
      },
      appPlugin: { addListener: async (_, handler) => { callback = handler; return { remove() {} }; } },
      nativeActions: { openExternal: async () => true }
    });
    await tick();
    root.querySelector('#youtube-account-signin').click();
    await tick();
    callback({ url: 'https://example.com/?ticket=attacker' });
    callback({ url: 'tifloacosta://evil-host?ticket=attacker' });
    await tick();
    assert.equal(completed, 0);
    control.dispose();
  });
});
