import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseReleaseRequest, artifactNames } from './release-request.mjs';
import { chooseNextVersionCode, collectVersionCodes, createGoogleAccessToken, createPlayReleaseClient } from './google-play-release.mjs';
import { buildReleaseInfo, buildGithubSummary, buildPlayNotes } from './release-report.mjs';
import { sendUpdateNotification } from './onesignal-release-notification.mjs';

export async function runRelease({
  request,
  state = {},
  publish = false,
  play,
  oneSignal,
  build,
  packageRelease,
  aabPath = ''
} = {}) {
  if (!request) throw new Error('Release request is required');
  if (publish && request.status !== 'completed') {
    throw new Error('Publishing requires request status completed');
  }
  if (!play) throw new Error('Google Play release client is required');
  if (typeof build !== 'function' || typeof packageRelease !== 'function') {
    throw new Error('Release build and packaging functions are required');
  }

  const edit = await play.createEdit();
  const editId = String(edit?.id || '').trim();
  if (!editId) throw new Error('Google Play did not return an edit id');

  const [tracksResult, bundlesResult] = await Promise.all([
    play.listTracks(editId),
    play.listBundles(editId)
  ]);
  const playCodes = collectVersionCodes({
    tracks: tracksResult?.tracks || [],
    bundles: bundlesResult?.bundles || []
  });
  const versionCode = chooseNextVersionCode({
    playCodes,
    localCode: Number(state?.lastSuccessfulVersionCode || 0)
  });
  const identity = { versionName: request.versionName, versionCode };

  await build(identity);
  const packaged = await packageRelease(identity);

  if (!publish) {
    return { ...identity, published: false, ...packaged };
  }

  if (!aabPath) throw new Error('Signed AAB path is required for publication');
  await play.uploadBundle(editId, aabPath);
  await play.updateTrack(editId, request.track, {
    versionName: request.versionName,
    versionCode,
    status: request.status,
    priority: request.priority,
    notes: request.notes
  });
  await play.validateEdit(editId);
  await play.commitEdit(editId);

  if (request.notifyUpdate) {
    if (typeof oneSignal !== 'function') throw new Error('OneSignal sender is required for update notification');
    await oneSignal({ versionName: request.versionName });
  }

  return { ...identity, published: true, ...packaged };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status ?? 'unknown'}`);
}

async function cli() {
  const publish = process.argv.includes('--publish');
  const mobileDir = fileURLToPath(new URL('../', import.meta.url));
  const androidDir = `${mobileDir}android`;
  const releaseDir = `${mobileDir}release`;
  const outDir = `${releaseDir}/out`;
  const request = parseReleaseRequest(JSON.parse(await readFile(`${releaseDir}/request.json`, 'utf8')));
  const state = JSON.parse(await readFile(`${releaseDir}/state.json`, 'utf8'));

  const serviceAccountRaw = String(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || '').trim();
  if (!serviceAccountRaw) throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is required');
  const serviceAccount = JSON.parse(serviceAccountRaw);
  const accessToken = await createGoogleAccessToken(serviceAccount);
  const play = createPlayReleaseClient({ packageName: 'com.tifloacosta.app', accessToken });

  let releaseAab = '';
  const result = await runRelease({
    request,
    state,
    publish,
    play,
    oneSignal: async ({ versionName }) => {
      const apiKey = String(process.env.ONESIGNAL_REST_API_KEY || '').trim();
      if (!apiKey) throw new Error('ONESIGNAL_REST_API_KEY is required when update notification is enabled');
      return sendUpdateNotification({
        appId: 'ed030723-7f6f-4745-8cd3-6938a9d04377',
        apiKey,
        versionName
      });
    },
    build: async ({ versionName, versionCode }) => {
      run('./gradlew', ['--no-daemon', 'assembleDebug', 'bundleRelease'], {
        cwd: androidDir,
        env: {
          ...process.env,
          TIFLO_ANDROID_VERSION_NAME: versionName,
          TIFLO_ANDROID_VERSION_CODE: String(versionCode)
        }
      });
      releaseAab = `${androidDir}/app/build/outputs/bundle/release/app-release.aab`;
    },
    packageRelease: async ({ versionName, versionCode }) => {
      await mkdir(outDir, { recursive: true });
      const names = artifactNames({ versionName, versionCode });
      const aabSource = `${androidDir}/app/build/outputs/bundle/release/app-release.aab`;
      const apkSource = `${androidDir}/app/build/outputs/apk/debug/app-debug.apk`;
      const aabTarget = `${outDir}/${names.aab}`;
      const apkTarget = `${outDir}/${names.apk}`;
      await copyFile(aabSource, aabTarget);
      await copyFile(apkSource, apkTarget);

      const checks = { tests: true, signing: true, aab: true, apk: true, oneSignal: true };
      const reportData = {
        versionName,
        versionCode,
        track: request.track,
        status: request.status,
        commit: process.env.GITHUB_SHA || '',
        checks,
        artifact: names.zip
      };
      await writeFile(`${outDir}/INFORMACION-COMPILACION.txt`, buildReleaseInfo(reportData), 'utf8');
      await writeFile(`${outDir}/notas-google-play.txt`, buildPlayNotes(request), 'utf8');
      if (process.env.GITHUB_STEP_SUMMARY) {
        await writeFile(process.env.GITHUB_STEP_SUMMARY, `${buildGithubSummary(reportData)}\n`, { flag: 'a' });
      }
      run('zip', ['-j', `${outDir}/${names.zip}`, aabTarget, apkTarget, `${outDir}/INFORMACION-COMPILACION.txt`, `${outDir}/notas-google-play.txt`]);
      return { artifact: `${outDir}/${names.zip}` };
    },
    get aabPath() { return releaseAab; }
  });

  if (publish) {
    await writeFile(`${releaseDir}/state.next.json`, JSON.stringify({
      lastSuccessfulVersionCode: result.versionCode,
      lastSuccessfulVersionName: result.versionName
    }, null, 2) + '\n', 'utf8');
  }
  console.log(`Android release prepared: ${result.versionName} code ${result.versionCode}; published=${result.published}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  cli().catch(error => {
    console.error(error?.message || String(error));
    process.exitCode = 1;
  });
}
