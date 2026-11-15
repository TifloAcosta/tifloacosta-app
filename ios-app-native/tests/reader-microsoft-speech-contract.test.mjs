import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../Sources/', import.meta.url);
const settings = readFileSync(new URL('NativeReaderSettings.swift', root), 'utf8');
const microsoft = readFileSync(new URL('NativeMicrosoftSpeech.swift', root), 'utf8');
const reader = readFileSync(new URL('NativeTifloLector.swift', root), 'utf8');

test('Azure aparece únicamente entre los ajustes del modo de voz y está identificado como experimental', () => {
  assert.match(settings, /if presentationMode == 0 \{[\s\S]*?Section\("Microsoft Azure Speech, prueba experimental"\)/);
  assert.match(settings, /NativeAzureSpeechSettings\(\)/);
  assert.match(microsoft, /todavía no cambia el motor de lectura de documentos/);
});

test('el usuario elige explícitamente voces del iPhone o Azure y comprueba las credenciales antes de usar el servicio', () => {
  assert.match(microsoft, /native-reading-speech-provider/);
  assert.match(microsoft, /"Voces de iOS", "Microsoft Azure Speech"/);
  assert.match(microsoft, /static func isConfigured\(/);
});

test('Azure usa HTTPS oficial, credenciales en Keychain y ninguna clave incrustada', () => {
  assert.match(microsoft, /import Security/);
  assert.match(microsoft, /SecItemCopyMatching/);
  assert.match(microsoft, /SecItemAdd/);
  assert.match(microsoft, /tts\.speech\.microsoft\.com\/cognitiveservices\/voices\/list/);
  assert.match(microsoft, /tts\.speech\.microsoft\.com\/cognitiveservices\/v1/);
  assert.match(microsoft, /Ocp-Apim-Subscription-Key/);
  assert.match(microsoft, /validatedRegion\(region\)/);
  assert.doesNotMatch(microsoft, /https:\/\/[^\s]*edge-tts/);
});

test('un documento Azure se fragmenta y solo inicia una petición con credenciales válidas', () => {
  assert.match(microsoft, /static func nextChunk\(/);
  assert.match(reader, /func playAzure\(/);
  assert.match(reader, /NativeAzureSpeechService\.isConfigured\(/);
  assert.match(reader, /NativeAzureSpeechService\.synthesize\(/);
});

test('la pausa, cancelación y progreso se aplican también al audio de Azure', () => {
  assert.match(reader, /azureTask\?\.cancel\(\)/);
  assert.match(reader, /azureGeneration/);
  assert.match(reader, /azurePendingData/);
  assert.match(reader, /azureCompletedCharacters/);
  assert.match(reader, /azureChunkCharacters/);
});
