import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const expectedBranch = 'development/next-public-1.6-500200-20261121';
const mandatoryIDs = Array.from({ length: 34 }, (_, index) => index + 1).filter(id => id !== 21);
const deferredIDs = new Map([[12,'platform-limitation'],[14,'device-validation'],[15,'device-validation'],[19,'device-validation'],[22,'device-validation'],[23,'device-validation'],[25,'device-validation'],[33,'device-validation'],[34,'external-publication']]);
const isEvidence = a => Array.isArray(a) && a.length > 0 && a.every(x => typeof x === 'string' && x.trim().length > 0);
const validRun = x => Number.isSafeInteger(x) && x > 0;
const validCommit = x => typeof x === 'string' && /^[a-f0-9]{40}$/.test(x);
export const auditedPaths = ['ios-app-native/Sources','ios-app-native/ShareExtension','ios-app-native/LocalizationUITests','ios-app-native/localization-audit-project.yml','ios-app-native/project.yml','ios-app-native/tests','.github/workflows/ios-localization-ui-audit.yml'];

export function evaluateReadiness(manifest, mode = 'public', verifyAudit = () => false) {
  if (!['internal-beta','public'].includes(mode)) throw Error('Modo de validación desconocido.');
  if (manifest.version !== '1.7' || manifest.branch !== expectedBranch) throw Error('Versión o rama incorrecta.');
  const requirements = manifest.requirements;
  if (!Array.isArray(requirements) || requirements.length !== mandatoryIDs.length) throw Error('Inventario obligatorio incompleto.');
  const ids = requirements.map(item => item.id);
  if (new Set(ids).size !== ids.length || mandatoryIDs.some(id => !ids.includes(id)) ||
      requirements.some(item => !['partial','implemented'].includes(item.status))) throw Error('Identificadores o estados inválidos.');
  const incomplete = requirements.filter(item => item.status !== 'implemented');
  const audit = manifest.internalBeta?.linguisticAudit;
  const blockers = [];
  if (requirements.find(item => item.id === 11).status !== 'implemented' ||
      audit?.status !== 'validated' || !validCommit(audit.validatedCommit) ||
      !validRun(audit.integrationRun) || !validRun(audit.navigationRun) ||
      !isEvidence(audit.reviewEvidence) || !verifyAudit(audit)) {
    blockers.push('11: auditoría lingüística integral y evidencia vigente pendientes.');
  }
  if (mode === 'public') {
    for (const item of incomplete) blockers.push(item.id + ': ' + item.title);
    if (manifest.publicRelease?.status !== 'validated' || !isEvidence(manifest.publicRelease.deviceReviewEvidence)) {
      blockers.push('Pruebas físicas y aceptación pública pendientes.');
    }
    return { blockers, deferred: [], implemented: requirements.length - incomplete.length };
  }
  const deferred = manifest.internalBeta?.deferred;
  if (!Array.isArray(deferred) || new Set(deferred.map(x => x.id)).size !== deferred.length ||
      deferred.some(x => deferredIDs.get(x.id) !== x.kind || !x.reason?.trim() || !isEvidence(x.evidence))) {
    throw Error('Inventario de pendientes de beta inválido.');
  }
  const allowed = new Map(deferred.map(x => [x.id,x]));
  for (const item of incomplete) {
    if (item.id !== 11 && !allowed.has(item.id)) blockers.push(item.id + ': ' + item.title);
  }
  return { blockers, deferred: incomplete.filter(x => allowed.has(x.id)).map(x => allowed.get(x.id)), implemented: requirements.length - incomplete.length };
}

function git(args) { return execFileSync('git', args, {encoding:'utf8'}).trim(); }
function verifyCurrentAudit(audit) {
  // A validated record is tied to the reviewed sources and tests, not to an arbitrary later build.
  // The upload workflow checks the cited GitHub runs separately, with read-only permissions.
  try {
    return auditedPaths.every(p => git(['rev-parse','HEAD:'+p]) === git(['rev-parse',audit.validatedCommit+':'+p])) &&
      git(['status','--porcelain','--',...auditedPaths]) === '';
  } catch { return false; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && !['--internal-beta','--public'].includes(args[0]))) throw Error('Modo de validación desconocido.');
  const mode = args[0] === '--internal-beta' ? 'internal-beta' : 'public';
  const manifest = JSON.parse(fs.readFileSync(new URL('../release-readiness-1.7.json', import.meta.url), 'utf8'));
  const result = evaluateReadiness(manifest, mode, verifyCurrentAudit);
  console.log('TifloAcosta iOS 1.7: ' + result.implemented + ' de ' + mandatoryIDs.length + ' requisitos implementados. Modo: ' + mode);
  for (const item of result.deferred) console.log('PENDIENTE DE BETA ' + item.id + ': ' + item.reason);
  for (const blocker of result.blockers) console.error('BLOQUEO ' + blocker);
  if (result.blockers.length) throw Error('Beta 1.7 bloqueada o publicación no autorizable: controles pendientes.');
  console.log('Control de inventario y auditoría superado. No sustituye la firma ni la autorización expresa de distribución.');
}
