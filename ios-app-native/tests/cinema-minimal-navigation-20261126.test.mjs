import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../Sources/' + path, import.meta.url), 'utf8');
const source = read('NativeAccessibleCinema.swift');
const root = source.slice(source.indexOf('struct NativeAccessibleCinemaScreen: View'), source.indexOf('private enum NativeCinemaContentMode'));
const platforms = source.slice(source.indexOf('private struct NativeCinemaPlatformsScreen'), source.indexOf('private struct NativeCinemaProviderScreen'));

test('cinema home has single compact entries, not an expanded provider directory or import controls', () => {
  for (const label of ['Buscar obras','Plataformas','Mi colección personal','Historial de Multicines','Dónde ver una película','Continuar viendo o escuchando'])
    assert.ok(root.includes('NavigationLink("' + label + '")'), label);
  for (const token of ['source.detail','AccessibleCinemaDirectory.sources','TextField(','NativeCloudGooglePickerScreen','NativeAdjustableChoice','Importar audio o vídeo'])
    assert.ok(!root.includes(token), token);
  assert.ok(root.includes('personalPlayer.currentID != nil'));
  assert.ok(root.includes('entries.contains(where: { !$0.finished })'));
});

test('provider folders are grouped by six languages and Audesc has two separate collections', () => {
  for (const label of ['Español','Inglés','Francés','Portugués','Italiano','Alemán'])
    assert.ok(platforms.includes('NavigationLink("' + label + '")'), label);
  assert.ok(platforms.includes('NavigationLink("Universo Audesc")'));
  assert.ok(platforms.includes('source.languages.contains(.latino)'));
  assert.ok(platforms.includes('return matches && !["audesc-es", "audesc-latino"].contains(source.id)'));
  assert.ok(platforms.includes('source.id == "audesc-es" ? "Español de España" : "Español latino"'));
  assert.ok(platforms.includes('NativeCinemaProviderScreen(source: source)'));
  assert.ok(!platforms.includes('Text(source.detail)'));
});

test('provider information preserves access routes and attributes only recorded collaborators', () => {
  const details = source.slice(source.indexOf('private struct NativeCinemaProviderScreen'));
  for (const name of ['José Manuel Delicado','Paolo Bernardini (Medialica)','Mike Bamonte'])
    assert.ok(details.includes(name));
  assert.ok(platforms.includes('Alfredo Amate'));
  assert.ok(details.includes('NavigationLink("Entrar en Audiocinemateca")'));
  assert.ok(details.includes('https://audiocinemateca.com/usuario/register'));
  assert.ok(details.includes('Text(source.detail)'));
  assert.ok(details.includes('default: return nil'));
  assert.ok(details.includes('collaborator == nil ? "Información" : "Información y agradecimientos"'));
});

test('search remains federated and can find personal titles and provider names; import has its own screen', () => {
  assert.ok(source.includes('if mode == .search'));
  assert.ok(source.includes('if !filtered.isEmpty'));
  assert.ok(source.includes('return languageMatches && typeMatches && queryMatches'));
  assert.ok(source.includes('NativeAudiocinematecaBrowser(query: searchText, kind: selectedKind, language: selectedLanguage)'));
  assert.ok(source.includes('NavigationLink("Importar")'));
  assert.ok(source.includes('selectedIndex: $discoveryLanguageIndex'));
  assert.ok(source.includes('allowedContentTypes: [.audio, .movie]'));
});

test('minimal cinema labels and acknowledgements have all five translated catalogues', () => {
  for (const lang of ['en','pt','fr','it','de']) {
    const dict = read(lang + '.lproj/Localizable.strings');
    for (const key of ['Universo Audesc','Plataformas','Latinoamérica','Información y agradecimientos','Entrar en Audiocinemateca','Agradecemos a %@ su predisposición y colaboración con Multicines Accesibles.'])
      assert.ok(dict.includes('"' + key + '" = '), lang + ' ' + key);
  }
});

test('collection filters are independent and provider search carries its context', () => {
  assert.ok(source.includes('selectedIndex: $collectionLanguageIndex'));
  assert.ok(source.includes('selectedIndex: $collectionContentIndex'));
  assert.ok(source.includes('NativeCinemaProviderScreen(source: source, selectedKind: selectedKind, selectedLanguage: selectedLanguage, query: searchText)'));
  assert.ok(source.includes('NativeAudiocinematecaBrowser(query: query, kind: selectedKind, language: selectedLanguage)'));
  assert.ok(source.includes('var selectedKind: AccessibleCinemaKind = .all'));
});

test('each personal title opens a single detail, with one shared transport and local confirmation', () => {
  const rows = source.slice(source.indexOf('private var personalRows'), source.indexOf('var body: some View', source.indexOf('private var personalRows')));
  const detail = source.slice(source.indexOf('private struct NativeCinemaPersonalDetailScreen'), source.indexOf('private struct NativeCinemaPlatformsScreen'));
  assert.ok(rows.includes('NativeCinemaPersonalDetailScreen(itemID: item.id)'));
  assert.ok(!rows.includes('Button('));
  assert.ok(!rows.includes('NativeCinemaTransportControls'));
  assert.ok(detail.includes('NativeCinemaTransportControls(player: personalPlayer, library: personalLibrary)'));
  assert.ok(detail.includes('.confirmationDialog('));
  assert.ok(detail.includes('personalPlayer.pauseAndSave(library: personalLibrary)'));
  assert.ok(detail.indexOf('try personalLibrary.remove(item)') < detail.indexOf('dismiss()'));
});
