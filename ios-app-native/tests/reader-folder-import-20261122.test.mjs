import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reader = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');

test('import from Files accepts a folder without asking for a ZIP', () => {
  assert.match(reader, /Button\("Carpeta completa desde Archivos"\)/);
  assert.match(reader, /isPresented: \$importFolderPresented/);
  assert.match(reader, /allowedContentTypes: \[\.folder\]/);
  assert.match(reader, /func importFolder\(from folder: URL/);
});

test('folder enumeration stays within a scoped URL and skips symlinks', () => {
  assert.match(reader, /folder\.startAccessingSecurityScopedResource\(\)/);
  assert.match(reader, /defer \{ if scope \{ folder\.stopAccessingSecurityScopedResource\(\) \} \}/);
  assert.match(reader, /\.skipsHiddenFiles, \.skipsPackageDescendants/);
  assert.match(reader, /properties\?\.isSymbolicLink != true/);
  assert.match(reader, /files\.count \+ skipped < 750/);
});

test('folder progress reports real document counts and continues on individual failures', () => {
  assert.match(reader, /Importando \\(index \+ 1\) de \\(files\.count\)/);
  assert.match(reader, /try importDocuments\(from: \[file\]\)/);
  assert.match(reader, /failures\.append\(/);
  assert.match(reader, /Documentos importados: \\(summary\.imported\)/);
  assert.match(reader, /UIAccessibility\.post\(notification: \.announcement, argument: importFolderStatus\)/);
});
