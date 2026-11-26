import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync(
  new URL('../release-readiness-1.7.json', import.meta.url), 'utf8'
));
const expectedBranch = 'development/next-public-1.6-500200-20261121';

if (manifest.version !== '1.7' || manifest.branch !== expectedBranch) {
  throw Error('La versión o rama del inventario no corresponde a la beta 1.7.');
}
const requirements = manifest.requirements;
const mandatoryIDs = Array.from({ length: 34 }, (_, index) => index + 1).filter(id => id !== 21);
if (!Array.isArray(requirements) || requirements.length < mandatoryIDs.length) {
  throw Error('El inventario de la versión 1.7 no conserva todos los requisitos obligatorios.');
}
const ids = requirements.map(item => item.id);
if (new Set(ids).size !== ids.length || mandatoryIDs.some(id => !ids.includes(id)) || ids.includes(21) || ids.some(id => !Number.isSafeInteger(id) || id < 1)) {
  throw Error('El inventario contiene identificadores inválidos, repetidos o requisitos obligatorios ausentes.');
}
const incomplete = requirements.filter(item => item.status !== 'implemented');
console.log('TifloAcosta iOS 1.7: ' + (requirements.length - incomplete.length)
  + ' de ' + requirements.length + ' requisitos marcados como implementados.');
if (incomplete.length > 0) {
  for (const item of incomplete) {
    console.error('PENDIENTE ' + item.id + ': ' + item.title + ' (' + item.status + ')');
  }
  throw Error('Beta 1.7 bloqueada: existen funciones acordadas sin implementar. '
    + 'No enviar a Apple hasta terminar el código y actualizar el inventario con evidencia.');
}
console.log('Inventario de funcionalidades completo. Continuar con los tests, Xcode y las pruebas en dispositivo.');
