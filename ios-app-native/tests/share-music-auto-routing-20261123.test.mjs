import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reader = file => readFileSync(new URL('../Sources/'+file,import.meta.url),'utf8');
const inbox = reader('NativeShareInbox.swift');
const music = reader('NativeMyMusic.swift');
const home = reader('NativeScreens.swift');

test('sharing an audio explicitly to Mi música imports automatically on foreground', () => {
  assert.match(inbox,/func importPendingMusicContent\(\) -> Bool/);
  assert.match(inbox,/[$]0[.]kind == "file" && [$]0[.]isAudioFile && [$]0[.]destination == "music"/);
  assert.match(home,/let receivedMusic = inbox[.]importPendingMusicContent\(\)/);
  assert.match(home, /\.onAppear \{\s*processSharedContent\(\)/);
  assert.match(home, /if phase == \.active \{\s*processSharedContent\(\)/);
  assert.match(home,/receivedMusic && inbox[.]readyToRead == nil/);
  assert.match(home,/navigationPath[.]append\(NativeDestination[.]miMusica\)/);
  assert.match(inbox,/item[.]destination != "pending" && item[.]destination != "music"/);
});

test('Mi música uses the immutable sharing UUID to avoid duplicate retry imports', () => {
  assert.match(inbox,/UUID\(uuidString: item[.]id\)/);
  assert.match(inbox,/NativeMusicSharedAudio[.]importFile\(named, sharingID: sharingID\)/);
  assert.match(music,/func importSharedFile\(_ url: URL, sharingID: UUID\) throws/);
  assert.match(music,/files[.]first\(where: \{ [$]0[.]id == sharingID \}\)/);
  assert.match(music,/MusicLocalFile\(id: sharingID,/);
  assert.match(music,/sharingID[.]uuidString \+ "[.]" \+ ext/);
  assert.match(music,/try save\(\)/);
  assert.match(music,/if !wasAlreadyCopied \{ try[?] FileManager[.]default[.]removeItem\(at: target\) \}/);
});

test('failed music imports never discard source inbox audio', () => {
  const body=inbox.split('func importToMusic(')[1]?.split('func importPendingMusicContent()')[0]??'';
  assert.match(body,/try NativeMusicSharedAudio[.]importFile/);
  assert.match(body,/complete\(item\)/);
  assert.ok(body.indexOf('try NativeMusicSharedAudio.importFile') < body.indexOf('complete(item)'));
  assert.match(inbox,/failed[.]append/);
  assert.match(inbox,/Los audios fallidos permanecen en Recibidos para reintentar[.]/);
});

test('multiple pending audios can go to one explicitly chosen destination', () => {
  assert.match(inbox,/func importPendingAudioBatch\(to destination: String,/);
  assert.match(inbox,/items[.]reversed\(\)[.]filter \{ [$]0[.]needsAudioDestination \}/);
  assert.match(inbox,/Button\("Importar todos los audios pendientes en Mi música"\)/);
  assert.match(inbox,/Button\("Importar todos los audios pendientes en TifloLector"\)/);
  assert.match(inbox,/if destination == "music" \{/);
  assert.match(inbox,/lastReader = try await importToReader\(item, library: library,\s*position: index \+ 1, total: pending\.count\)/);
});
