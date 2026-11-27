import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const browser = readFileSync(new URL('../Sources/NativeCloudFolderBrowserScreen.swift', import.meta.url), 'utf8');
const music = readFileSync(new URL('../Sources/NativeMyMusic.swift', import.meta.url), 'utf8');

test('shared folder browser supports Dropbox and future OneDrive without music dependencies', () => {
  assert.match(browser, /let provider: NativeCloudProvider/);
  assert.match(browser, /func loadFolder\(/);
  assert.match(browser, /listFolder\(id:/);
  assert.match(browser, /nextCursor/);
  assert.match(browser, /func importItem\(/);
  assert.doesNotMatch(browser, /NativeMusicLibrary|NativeMyMusicScreen/);
});

test('Dropbox is available as an optional provider in Mi música', () => {
  assert.match(music, /NativeCloudFolderBrowserScreen\(provider: \.dropbox/);
  assert.match(music, /library\.importFiles\(\[file\]\)/);
});

test('OneDrive remains available in the shared implementation but is hidden from this release', () => {
  assert.doesNotMatch(music, /NativeCloudFolderBrowserScreen\(provider: \.oneDrive/);
  assert.match(browser, /validAccessToken\(for: provider\)/);
});

test('folder navigation commits history only after a successful current-account response', () => {
  assert.match(browser, /let history = folderHistory \+ \[folderID\]/);
  assert.doesNotMatch(browser, /folderHistory\.removeLast\(\)|folderHistory\.append\(folderID\)/);
  assert.match(browser, /let page = try await storage\.listFolder\(id: id\)[\s\S]*?accounts\.sessionRevision\(for: provider\) == revision else \{ return \}\s+folderID = id\s+if let history \{ folderHistory = history \}/);
});
test('cloud pages deduplicate IDs and stop cursor cycles; disconnected downloads are discarded', () => {
  assert.match(browser, /var seen = Set\(items\.map\(\\\.id\)\)/);
  assert.match(browser, /consumedCursors\.insert\(cursor\)/);
  assert.match(browser, /consumedCursors\.contains\(\$0\) \? nil : \$0/);
  assert.match(browser, /let file = try await storage\.download[\s\S]*?accounts\.sessionRevision\(for: provider\) == revision else \{\s+try\? FileManager\.default\.removeItem/);
});
