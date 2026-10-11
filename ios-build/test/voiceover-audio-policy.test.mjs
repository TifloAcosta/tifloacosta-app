import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(resolve(import.meta.dirname, '../native/TifloYouTubeViewController.swift'), 'utf8');
const policy = source.match(/let audioSessionPolicy = """\n([\s\S]*?)\n        """/)?.[1];
assert.ok(policy, 'The iOS player must embed the all-frame WebKit audio policy');

function harness(initial = true, hasAudioSession = true) {
  const listeners = {};
  const sent = [];
  const timers = [];
  const child = { postMessage: data => sent.push(data) };
  const window = { parent: {}, addEventListener: (name, cb) => { listeners['window:' + name] = cb; } };
  const document = {
    querySelectorAll: name => name === 'iframe' ? [{ contentWindow: child }] : [],
    addEventListener: (name, cb) => { listeners['document:' + name] = cb; }
  };
  const audioSession = { type: 'auto' };
  const navigator = hasAudioSession ? { audioSession } : {};
  const script = policy.replace(/\\\(shouldMixAudio \? "true" : "false"\)/, String(initial));
  assert.doesNotMatch(script, /\(shouldMixAudio/);
  runInNewContext(script, {
    window, document, navigator,
    setTimeout: callback => { timers.push(callback); }
  });
  return { window, listeners, audioSession, sent, timers };
}

test('WebKit policy starts in a mixing session when VoiceOver is on', () => {
  const h = harness();
  assert.equal(h.audioSession.type, 'ambient');
  h.audioSession.type = 'playback';
  h.listeners['document:play']();
  assert.equal(h.audioSession.type, 'ambient');
  h.audioSession.type = 'playback';
  h.timers.forEach(callback => callback());
  assert.equal(h.audioSession.type, 'ambient');
});

test('turning compatibility off returns the iframe to normal YouTube playback', () => {
  const h = harness();
  h.listeners['window:message']({
    source: h.window.parent,
    data: { type: 'tiflo-voiceover-audio-policy-v1', enabled: false }
  });
  assert.equal(h.audioSession.type, 'auto');
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].enabled, false);
  h.listeners['window:message']({
    source: {},
    data: { type: 'tiflo-voiceover-audio-policy-v1', enabled: true }
  });
  assert.equal(h.audioSession.type, 'auto');
});

test('WebKit policy is inert without VoiceOver or the experimental audio API', () => {
  assert.equal(harness(false).audioSession.type, 'auto');
  assert.doesNotThrow(() => harness(true, false));
});

test('policy reaches YouTube cross-origin frames and can change without reloading', () => {
  assert.match(source, /WKUserScript\(source: audioSessionPolicy, injectionTime: \.atDocumentStart, forMainFrameOnly: false\)/);
  assert.match(source, /webView\?\.evaluateJavaScript\(script, completionHandler: nil\)/);
  assert.match(source, /window\.postMessage\(\{type:'tiflo-voiceover-audio-policy-v1'/);
  assert.match(source, /setCategory\(\.playback, mode: \.moviePlayback, options: \[\.mixWithOthers\]\)/);
  assert.match(source, /audioMix\.restore\(\)/);
  assert.match(source, /webView\.accessibilityElementsHidden = true/);
});
