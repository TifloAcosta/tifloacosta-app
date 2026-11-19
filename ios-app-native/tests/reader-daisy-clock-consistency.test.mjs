import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const generator = source('NativeGeminiDaisyExport.swift');
const verifier = source('NativeDaisyPackageVerifier.swift');

test('generated clipBegin includes milliseconds required by the verifier', () => {
  const generated = generator.match(/clipBegin=\\"([^\\"]+)\\"/);
  assert.ok(generated, 'the generated SMIL must contain clipBegin');
  const clockRegex = verifier.match(/clockPattern = try NSRegularExpression\(pattern: #"([^"#]+)"#\)/);
  assert.ok(clockRegex, 'the verifier must define a clock grammar');
  assert.match(generated[1], new RegExp(clockRegex[1]));
});

test('generated clipEnd uses the same precise DAISY clock function', () => {
  assert.match(generator, /clipEnd=\\"\\\(clock\(duration\)\)\\"/);
  assert.match(generator, /%02d:%02d:%06\.3f/);
});
