import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const required = ["Escribe al menos dos caracteres para buscar en YouTube.","Buscando en YouTube.","No se encontraron resultados.","%d resultados encontrados hasta el momento.","Quitar de Ver después","Guardar para ver después","Conectando con Google","La actualización está en curso.","Recurso guardado para leer después.","Recurso retirado de Leer después.","Actualizando recursos","Vídeos cortos, menos de cuatro minutos","En directo","Con subtítulos","Tipo de resultados","Buscando en YouTube","Seguir canal sin cuenta Google","No se pudieron consultar algunos canales: %@","Consultando canales seguidos","No hay suscripciones disponibles. Comprueba tu sesión y actualiza las suscripciones.","Sigue un canal desde los resultados de YouTube para ver aquí sus novedades.","Novedades de suscripciones","Novedades de canales","Cargando suscripciones","Cargando vídeos","No se obtuvo permiso para guardar copias en la carpeta seleccionada.","Copia automática","Ninguna canción en reproducción","Buscar canciones","%@, %@, Apple Music","%@, %@, Audius","%@, %@, Jamendo","No se pudo completar el fragmento de voz.","No se pudo completar el fragmento DAISY.","Terminar selección","Información de cada documento con VoiceOver","Filtrar documentos","El nombre de la carpeta está vacío, repetido o es demasiado largo.","No hay documentos seleccionados para mover.","No se pudo crear la carpeta. Comprueba que el nombre no esté vacío, repetido o sea demasiado largo.","Vídeo no disponible.","No se pudo reproducir el vídeo con el reproductor de Apple.","No disponible","Comienzo del documento","Preparando exportación…","DAISY 2.02 audio","Conversión completada. Archivo guardado en la biblioteca.","Exportación cancelada.","Selecciona el formato y el motor.","Seleccionar pista","Modo de navegación","Apagado automático","Ir a posición","Páginas, diapositivas y hojas","Bloques de lectura","Pausa después de coma","Pausa después de punto y coma","Pausa después de dos puntos","Pausa después de punto, interrogación o exclamación","Pausa después de salto de párrafo","Velocidad de voz","Tono de lectura","Pausas por puntuación","Normal, 1,00 veces","%.2f veces","%.2f segundos","Predeterminada del sistema","Voz personal","mejorada","estándar","Motor de lectura predeterminado","Motor de lectura de esta obra","Voz Gemini predeterminada","Voz Gemini de esta obra","Mostrar voces","Voz del sistema","Tamaño de letra","Espacio entre líneas","Texto reforzado","Unidad de avance","Generados %d de %d fragmentos","Error al exportar: %@","«%@» guardado en TifloLector.","No se pudo guardar «%@»: %@","Selecciona una carpeta en Archivos para descargar «%@».","No se pudo descargar «%@»: %@"];
test('Final beta: dynamic selectors, progress and error labels in all five translations', () => {
  for (const lang of ['en','fr','de','it','pt']) {
    const catalog = source(lang + '.lproj/Localizable.strings');
    for (const key of required) assert.ok(catalog.includes(JSON.stringify(key) + ' = '), lang + ': ' + key);
  }
});
test('Final beta: newly introduced screens inherit the shared native appearance', () => {
  for (const file of ["NativeAudiocinematecaBrowser","NativeAudiocinematecaAccount","NativeTapeTerritory","NativeMoviesForTheBlind","NativeRaiPlaySoundScreen","NativeAcoustIDAccount","NativeMyMusic","NativeCloudFolderBrowserScreen","NativeCloudGooglePickerScreen","NativeBackupManagementScreen","NativeDocumentConversionScreen","NativeYouTubeVideoDetails"]) {
    const swift = source(file + '.swift');
    assert.ok(swift.includes('.tifloScreenSurface()'), file);
  }
});
test('Final beta: channel error decisions are independent of the language of the UI', () => {
  const screen = source('NativeScreens.swift');
  assert.ok(screen.includes('if store.searchFailed {'));
  assert.ok(!screen.includes('error.contains("resultados encontrados")'));
  assert.ok(source('NativeYouTubePlayer.swift').includes('MusicLocalized.format("%d resultados encontrados hasta el momento.", count)'));
});
test('Final beta: cancelled cinema searches reset counters and accumulated result arrays before rerunning', () => {
  const swift = source('NativeAccessibleCinema.swift');
  const search = swift.slice(swift.indexOf('func performRemoteSearch'), swift.indexOf('if spanishFilter, let account'));
  for (const key of ['consultedCatalogues = 0','driveResults = []','tapeResults = []','movieResults = []','unavailableSources = []','partialSources = []']) assert.ok(search.includes(key),key);
});
