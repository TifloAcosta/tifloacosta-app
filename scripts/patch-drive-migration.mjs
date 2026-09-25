import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('./finalize-drive-migration.mjs', import.meta.url);
let source = await readFile(path, 'utf8');

const needle = `  await mkdir(mediaDir, { recursive: true });

  try {
    execFileSync('gdown', ['--folder', TONES_FOLDER, '--continue', '--retries', '4', '-O', mediaDir], { stdio: 'inherit', cwd: ROOT });`;

const replacement = `  await mkdir(mediaDir, { recursive: true });

  const dingTarget = path.join(mediaDir, 'Nokia', '22_Ding_dong.mp3');
  await mkdir(path.dirname(dingTarget), { recursive: true });
  try {
    downloadDriveFile('1DaQxtU59gjY7r7cmqHpvTEHUBRfSl9N7', dingTarget);
  } catch (error) {
    execFileSync('curl', [
      '-L', '--fail', '--retry', '4', '--retry-delay', '2',
      '-o', dingTarget,
      'https://drive.usercontent.google.com/download?id=1DaQxtU59gjY7r7cmqHpvTEHUBRfSl9N7&export=download&confirm=t'
    ], { stdio: 'inherit', cwd: ROOT });
  }

  try {
    execFileSync('gdown', ['--folder', TONES_FOLDER, '--continue', '--retries', '4', '-O', mediaDir], { stdio: 'inherit', cwd: ROOT });`;

if (!source.includes(needle)) throw new Error('Migration patch point was not found.');
source = source.replace(needle, replacement);
await writeFile(path, source, 'utf8');
console.log('Final ringtone recovery added to migration script.');
