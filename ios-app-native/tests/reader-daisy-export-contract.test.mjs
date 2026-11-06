import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file = name => readFileSync(new URL('../Sources/' + name, import.meta.url),'utf8');
const daisy = file('NativeGeminiDaisyExport.swift');
const reader = file('NativeTifloLector.swift');
const audio = file('NativeGeminiAudioExport.swift');

test('DAISY contains its complete standard structure and true audio-linked text', () => {
  for (const required of ['book.opf','book.xml','book.ncx','sync.smil','<dtbook','<ncx','<smil','<package','smilref','clipBegin','clipEnd']) {
    assert.ok(daisy.includes(required), required);
  }
  assert.match(daisy, /NativeGeminiSpeech\.generate\(spoken, voice: voice\)/);
  assert.match(daisy, /Double\(pcm.count\) \/ 48000\.0/);
  assert.match(daisy, /Archive\(url: output, accessMode: \.create\)/);
  assert.match(daisy, /archive\.addEntry/);
});
test('DAISY is offered only through the actual export handler', () => {
  assert.match(audio, /case daisy = "DAISY"/);
  assert.match(audio, /NativeGeminiDaisyExport\.generate/);
  assert.match(reader, /Text\("DAISY"\)\.tag\(NativeGeminiAudioExport\.Format\.daisy\)/);
});
