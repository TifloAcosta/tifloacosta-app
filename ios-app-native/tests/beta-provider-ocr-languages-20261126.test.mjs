import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const keys = ["Buscar canciones o artistas","Buscando canciones","Abriendo recurso","Cargando pistas","Buscando grabaciones","Buscar artista o concierto","Rock","Pop","Jazz","Clásica","Electrónica","Folk","Ambient","Blues","Country","Latina","Programas hablados","Buscando en Jamendo","Buscar en Jamendo","Cargando podcasts y vídeos","Descargando episodio","Canal TifloAcosta","Importando suscripciones","Cargando episodios seguidos","España","México","Argentina","Colombia","Chile","Estados Unidos","Reino Unido","Francia","Alemania","Brasil","Italia","Portugal","Buscando emisoras","Buscar emisoras por nombre","Idioma del OCR","Precisión del OCR","Consultando biblioteca","Buscando en el catálogo","Actualizando novedades","Documentos y publicaciones","Presentaciones","Hojas de cálculo","Imágenes con OCR","Audiolibros y audio","DAISY","Archivos comprimidos","Orden","Esta canción ya no está disponible. Se conserva en tu lista.","No se pudo consultar la lista de idiomas.","Idiomas admitidos por el dispositivo: %@","Archivo %@ de %@","%@. Archivo %@ de %@","TXT, TEXT, MD, MARKDOWN, CSV, JSON, XML, LOG y SRT.","PDF con texto o escaneado mediante OCR; EPUB; HTML, HTM y RTF; DOCX, ODT y FB2 (texto sin imágenes incrustadas).","PPTX, PPSX y PPTM: lectura por diapositivas. Las presentaciones PPS y PPT antiguas todavía no están admitidas.","XLSX y XLSM: lectura por hojas, filas y columnas, incluidas cadenas compartidas. Los archivos XLS antiguos todavía no están admitidos.","JPG, JPEG, PNG, HEIC, HEIF, TIF y TIFF.","MP3, M4A, M4B, AAC, WAV, AIF, AIFF, CAF y FLAC. Pistas consecutivas dentro de un ZIP de audiolibro, ordenadas naturalmente por sus nombres.","MP4, M4V y MOV con audio o vídeo compatibles con el reproductor de Apple.","Libros DAISY empaquetados en ZIP o con extensión DAISY. Lectura de texto y pistas de audio; la navegación SMIL completa sigue en desarrollo.","ZIP con pistas de audio o libros DAISY. No se admiten ZIP arbitrarios, RAR, 7Z ni CBR/CBZ."];
test('Beta: service filters, prompts and format help are translated in five languages', () => {
 for (const lang of ['en','fr','de','it','pt']) {
  const strings = read(lang + '.lproj/Localizable.strings');
  for (const key of keys) assert.ok(strings.includes(JSON.stringify(key) + ' = '), lang + ': ' + key);
 }
});
test('Beta: music providers preserve the native appearance and localized category labels', () => {
 for (const n of ['NativeRadioBrowser','NativeJamendoMusic','NativeAppleMusic','NativeAudiusMusic','NativeInternetArchiveMusic']) assert.ok(read(n + '.swift').includes('.tifloScreenSurface()'),n);
 assert.ok(read('NativeRadioBrowser.swift').includes('Text(MusicLocalized.message($0.title)).tag($0.id)'));
 assert.ok(read('NativeJamendoMusic.swift').includes('NavigationLink(MusicLocalized.message(genre.title))'));
 assert.ok(read('NativeReaderSettings.swift').includes('Text(LocalizedStringKey(group.details))'));
 assert.ok(read('NativeShareInbox.swift').includes('MusicLocalized.format("%@. Archivo %@ de %@"'));
});
