import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const reader=readFileSync(new URL('../Sources/NativeTifloLector.swift',import.meta.url),'utf8');
const extract=(start,end)=>reader.slice(reader.indexOf(start),reader.indexOf(end,reader.indexOf(start)));
test('reading controls keep Play/Pause then Back/Forward, without Stop',()=>{
 const controls=extract('private var playbackRow: some View','private var trackButtons: some View');
 assert.match(controls,/Button\(speech\.isPlaying \? "Pausar" : "Reproducir"\)/);
 assert.match(controls,/Button\("Retroceder"\)/);
 assert.match(controls,/Button\("Avanzar"\)/);
 assert.doesNotMatch(controls,/Button\("Detener"\)/);
});
test('main reading order includes navigation, bookmark, timer, information; audio and visual last',()=>{
 const controls=extract('private var quickControls: some View','private func readerFragment(at index: Int)');
 const labels=['playbackRow','title: "Navegación"','Button("Añadir marca")','Button("Marcas guardadas")','title: "Apagado automático"','Button("Información")','Button("Audio")','Button("Visual")'];
 let offset=-1;
 for(const name of labels){const next=controls.indexOf(name);assert.ok(next>offset,name+' occurs in order');offset=next;}
 assert.doesNotMatch(controls,/Text\(progressDescription\)/);
});
test('information screen presents progress and page or block information',()=>{
 const screen=extract('.sheet(isPresented: $showDocumentInformation)','sheet(isPresented: $showSavedMarks)');
 assert.match(screen,/Text\(progressDescription\)/);
 assert.match(screen,/Text\(pageProgressDescription\)/);
 assert.match(reader,/Quedan \\(remaining\\) páginas/);
 assert.match(reader,/Bloque aproximado/);
});
