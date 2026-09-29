import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('derived content schema is version 6 and migrates from v5 without destructive fallback', async () => {
  const database = await read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingLibraryDatabase.java');

  assert.match(database, /DATABASE_VERSION\s*=\s*6/);
  assert.match(database, /TABLE_DERIVED\s*=\s*"reading_derived"/);
  assert.match(database, /if\s*\(version\s*==\s*5\s*&&\s*newVersion\s*>=\s*6\)/);
  assert.match(database, /createV6Tables\(db\)/);
  assert.match(database, /CHECK\(kind IN \('ocr','translation'\)\)/);
  assert.match(database, /CHECK\(status IN \('partial','complete','error'\)\)/);

  const migrationV5ToV6 = database.match(
    /if\s*\(version\s*==\s*5\s*&&\s*newVersion\s*>=\s*6\)\s*\{([\s\S]*?)\n\s*\}/
  );
  assert.ok(migrationV5ToV6, 'expected an explicit v5 to v6 migration block');
  assert.doesNotMatch(migrationV5ToV6[1], /DROP\s+TABLE/i);
});

test('derived records persist resumable progress and are deleted with their source book', async () => {
  const [database, record] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingLibraryDatabase.java'),
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingDerivedRecord.java')
  ]);

  for (const field of [
    'bookId', 'kind', 'variantKey', 'relativePath', 'sourceSha256',
    'sourceLanguage', 'targetLanguage', 'engine', 'engineVersion',
    'status', 'completedUnits', 'totalUnits', 'updatedAt'
  ]) {
    assert.match(record, new RegExp(`\\b${field}\\b`));
  }

  assert.match(database, /upsertDerivedContent\s*\(/);
  assert.match(database, /findDerivedContent\s*\(/);
  assert.match(database, /listDerivedContent\s*\(/);
  assert.match(database, /deleteDerivedContent\s*\(/);
  assert.match(database, /db\.delete\(TABLE_DERIVED,\s*"book_id = \?"/);
});

test('derived content files stay private under each book derived directory', async () => {
  const store = await read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingDerivedStore.java');

  assert.match(store, /"derived"/);
  assert.match(store, /"items\/"\s*\+\s*bookId\s*\+\s*"\/derived\//);
  assert.match(store, /getCanonicalPath\(\)/);
  assert.match(store, /StandardCharsets\.UTF_8/);
  assert.match(store, /writeUtf8\s*\(/);
  assert.match(store, /readUtf8\s*\(/);
  assert.match(store, /delete\s*\(/);
});
