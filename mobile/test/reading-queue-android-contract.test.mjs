import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ROOT = new URL('../android/app/src/main/java/com/tifloacosta/app/reading/', import.meta.url);

async function source(name) {
  return readFile(new URL(name, ROOT), 'utf8');
}

test('android reading database migrates metadata and queue without replacing the library', async () => {
  const db = await source('ReadingLibraryDatabase.java');

  assert.match(db, /DATABASE_VERSION\s*=\s*6/);
  assert.match(db, /author\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+''/i);
  assert.match(db, /language\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+''/i);
  assert.match(db, /CREATE TABLE IF NOT EXISTS[^;]*reading_queue/is);
  assert.match(db, /(?:book_id\s+TEXT\s+NOT\s+NULL\s+UNIQUE|UNIQUE\s*\(\s*book_id\s*\))/i);
  assert.match(db, /FOREIGN KEY\s*\(\s*book_id\s*\)[^;]*ON DELETE CASCADE/is);
  assert.match(db, /version\s*==\s*4\s*&&\s*newVersion\s*>=\s*5/);
  assert.match(db, /version\s*==\s*5\s*&&\s*newVersion\s*>=\s*6/);
});

test('android repository exposes queue and metadata operations', async () => {
  const repository = await source('ReadingBookRepository.java');
  const record = await source('ReadingBookRecord.java');
  const query = await source('ReadingBookQuery.java');

  assert.match(repository, /List<ReadingQueueRecord>\s+listQueue\s*\(/);
  assert.match(repository, /boolean\s+addToQueue\s*\(\s*String\s+bookId\s*\)/);
  assert.match(repository, /boolean\s+removeFromQueue\s*\(\s*String\s+bookId\s*\)/);
  assert.match(repository, /boolean\s+moveQueueItem\s*\(\s*String\s+bookId\s*,\s*int\s+targetIndex\s*\)/);
  assert.match(repository, /updateBookMetadata\s*\(/);

  assert.match(record, /String\s+author/);
  assert.match(record, /String\s+language/);
  assert.match(record, /getAuthor\s*\(/);
  assert.match(record, /getLanguage\s*\(/);

  assert.match(query, /String\s+format/);
  assert.match(query, /case\s+"author"/);
  assert.match(query, /getFormat\s*\(/);
});

test('database queue is deterministic and completion removes queue membership', async () => {
  const db = await source('ReadingLibraryDatabase.java');

  assert.match(db, /listQueue\s*\(/);
  assert.match(db, /addToQueue\s*\(\s*String\s+bookId\s*\)/);
  assert.match(db, /removeFromQueue\s*\(\s*String\s+bookId\s*\)/);
  assert.match(db, /moveQueueItem\s*\(\s*String\s+bookId\s*,\s*int\s+targetIndex\s*\)/);
  assert.match(db, /queue_index\s+ASC/i);
  assert.match(db, /"read"\.equals\(state\)[\s\S]{0,500}removeFromQueue\(id\)/);
  assert.match(db, /format\s*=\s*\?/i);
  assert.match(db, /author\s+COLLATE\s+NOCASE\s+ASC/i);
});
