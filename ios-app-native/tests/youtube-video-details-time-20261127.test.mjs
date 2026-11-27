import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../Sources/' + p, import.meta.url), 'utf8');
test('video details are available without starting playback, on every shared row and in the player', () => {
    const row = read('NativeScreens.swift').split('struct NativeYouTubeVideoRow: View {')[1].split('struct NativeYouTubeCommentScreen')[0];
    assert.match(row, /\.accessibilityAction\(named: Text\("Detalles del vídeo"\)\) \{ showingDetails = true \}/);
    assert.match(row, /\.accessibilityAction\(\.default\) \{ onPlay\(video\) \}/);
    assert.match(row, /NativeYouTubeVideoDetailsScreen\(video: video\)/);
    const player = read('NativeYouTubePlayer.swift');
    assert.match(player, /Button\("Detalles del vídeo"\) \{ detailsVideo = currentVideo \}/);
    assert.match(player, /NativeYouTubeTimeProgress\(elapsed: engine.currentTime, duration: engine.duration\)/);
    assert.doesNotMatch(player, /Tiempo: %d de %d segundos|Duración: %d segundos/);
});
test('native details fetch verified metadata without sign-in, offer selectable description and safe links', () => {
    const detail = read('NativeYouTubeVideoDetails.swift');
    assert.match(detail, /\/video-details/);
    assert.match(detail, /guard result.id == video.id/);
    assert.match(detail, /Text\(verbatim: descriptionText\).textSelection\(\.enabled\)/);
    assert.match(detail, /Button\("Copiar descripción"\)/);
    assert.match(detail, /\["https", "http"\].contains/);
    assert.match(detail, /Información del catálogo; puede estar incompleta/);
    assert.doesNotMatch(detail, /NativeYouTubeOfficialPlayer|signIn\(/);
});
test('time converts total seconds into hours, minutes and seconds; VoiceOver uses full localized units', () => {
    const detail = read('NativeYouTubeVideoDetails.swift');
    assert.match(detail, /total \/ 3600, \(total % 3600\) \/ 60, total % 60/);
    assert.match(detail, /"%d:%02d:%02d"/);
    assert.match(detail, /"%d:%02d"/);
    assert.match(detail, /formatter.unitsStyle = \.full/);
    assert.match(detail, /NativeYouTubeTime.spoken\(position\), NativeYouTubeTime.spoken\(duration\)/);
    assert.match(read('NativeScreens.swift'), /Retoma el vídeo desde %@\./);
});
test('new video actions, details and time phrases are localized in all supported catalogs', () => {
    const keys = ["Detalles del vídeo","Tiempo: %@ de %@","Duración: %@","Continuar viendo desde %@.","Retoma el vídeo desde %@.","Abrir canal en YouTube","Cargando información del vídeo","Información del catálogo; puede estar incompleta.","Descripción del vídeo","Descripción no disponible","El creador no ha incluido una descripción.","Copiar descripción","Enlaces de la descripción"];
    for (const language of ['en','fr','de','it','pt']) {
        const catalog = read(language + '.lproj/Localizable.strings');
        for (const key of keys) assert.equal(catalog.split('"' + key + '" = ').length - 1, 1, language + ': ' + key);
    }
});
