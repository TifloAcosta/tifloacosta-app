import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=n=>readFileSync(new URL('../Sources/'+n,import.meta.url),'utf8');
const screen=read('NativeAccessibleCinema.swift');
const history=read('NativeCinemaHistory.swift');
const player=read('NativeAccessibleCinemaLibrary.swift');
test('unified result rows start playback with a single activation and expose accessible alternatives',()=>{
  for(const token of ['playbackRow(.tape(film))','playbackRow(.movie(work))','playbackRow(.audio(item))','playbackRow(.personal(item))','playbackRow(selection, title: title)','NativeCinemaPlaybackRequest(selection: selection)','NativeCinemaDirectPlaybackScreen(request: request)','Text("Reproducir desde el principio")','Text("Información de la obra")','cinemaRecents.toggleFavorite(selection)']) assert.ok(screen.includes(token),token);
  assert.match(screen,/\.accessibilityValue\(Text\("Reproductor externo"\)\)/);
  assert.match(history,/guard !started, !request.informationOnly else \{ return \}/);
  assert.match(history,/await play\(fromBeginning: request.fromBeginning\)/);
  assert.match(history,/resolveSearchHit\(hit\)/);
});
test('resume retains all unfinished works and saves actual position on lifecycle changes',()=>{
  assert.doesNotMatch(screen,/entries.filter \{ !\$0.finished \}.prefix\(12\)/);
  assert.match(screen,/NativeCinemaResumeScreen\(recent: recent, autoResume: true\)/);
  assert.match(history,/if !\$0.finished \{ return true \}/);
  assert.match(history,/NativeCinemaRules.preferredPartIndex/);
  assert.match(history,/if autoResume \{ await play\(selection, fromBeginning: false\) \}/);
  assert.match(history,/resolvePrivateDrive/);
  for(const token of ['UIApplication.willResignActiveNotification','UIApplication.didEnterBackgroundNotification','save(library: library, force: true)','fromBeginning ? 0 : savedCloudPosition(reference)','audioQueue = remaining','savedCloudPosition(_ reference: String)']) assert.ok(player.includes(token),token);
});
test('favorites use opaque identifiers and are included in backwards-compatible backups',()=>{
  assert.match(history,/cinema-favorites-v1.json/);
  assert.match(history,/favorites.insert\(NativeCinemaRecent\(id: id, source: selection.historySource/);
  assert.match(history,/favorites.removeAll \{ \$0.source == source \}/);
  assert.match(screen,/NavigationLink\("Favoritos"\)/);
  assert.match(player,/"favoritos.json": encoder.encode\(favorites\)/);
  assert.match(read('NativeBackupSectionArchive.swift'),/section == \.cinema && path == "favoritos.json"/);
  assert.match(read('NativeBackupPersonalData.swift'),/history.filter\(\\\.finished\).count <= 100/);
  assert.match(history,/self.favorites = oldFavorites/);
});
test('new playback and actions labels are translated',()=>{
  for(const lang of ['en','fr','de','it','pt']) for(const key of ['Reproducir desde el principio','Información de la obra','Reproductor externo','Favoritos','Añadir a favoritos','Quitar de favoritos']) assert.ok(read(lang+'.lproj/Localizable.strings').includes(JSON.stringify(key)+' = '),lang+': '+key);
});
