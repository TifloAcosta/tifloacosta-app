import { readFile, writeFile } from 'node:fs/promises';

const path = 'test/regression.test.mjs';
const before = await readFile(path, 'utf8');
const oldLine = `  assert.match(html, /<script src="app-core\\.js\\?v=1\\.3"><\\/script>\\s*<script src="app\\.js\\?v=[^\"]+"><\\/script>/);`;
const newLine = `  assert.match(html, /<script src="app-core\\.js\\?v=1\\.3"><\\/script>\\s*<script src="actualidad-core\\.js\\?v=[^\"]+"><\\/script>\\s*<script src="app\\.js\\?v=[^\"]+"><\\/script>/);`;

if (before.includes(newLine)) {
  console.log('test/regression.test.mjs: already updated');
} else if (!before.includes(oldLine)) {
  throw new Error('Regression assertion anchor not found');
} else {
  await writeFile(path, before.replace(oldLine, newLine), 'utf8');
  console.log('test/regression.test.mjs: updated');
}
