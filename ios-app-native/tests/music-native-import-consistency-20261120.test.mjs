import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../Sources/NativeMyMusic.swift', import.meta.url), 'utf8');
const files = source.slice(source.indexOf('func importFiles(_ urls: [URL])'), source.indexOf('private func save() throws'));
test('single files and folder imports have the same native format whitelist', () => {
  const individual = files.match(/let allowed = \[([^\]]+)\]/)?.[1];
  const folder = files.match(/let allowed = Set\(\[([^\]]+)\]\)/)?.[1];
  assert.ok(individual && folder);
  assert.deepEqual(
    [...individual.matchAll(/"([^"]+)"/g)].map(x => x[1]).sort(),
    [...folder.matchAll(/"([^"]+)"/g)].map(x => x[1]).sort()
  );
  assert.ok(!folder.includes('"ogg"'));
  assert.ok(folder.includes('"aiff"') && folder.includes('"caf"') && folder.includes('"flac"'));
});
