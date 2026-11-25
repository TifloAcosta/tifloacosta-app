import { setTimeout } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

export async function waitForPagesArtifact({ list, id, pause = setTimeout, attempts = 8 }) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await pause(Math.min(2 ** attempt, 10) * 1000);
    const artifacts = await list();
    if (artifacts.some(item => String(item.id) === id && item.name === 'github-pages' && !item.expired)) {
      return;
    }
  }
  throw new Error('The uploaded github-pages artifact did not become visible before the retry limit.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ARTIFACT_ID: id, GITHUB_API_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID, GH_TOKEN } = process.env;
  if (!/^\d+$/.test(id ?? '') || !GH_TOKEN || !GITHUB_RUN_ID || !GITHUB_REPOSITORY) {
    throw new Error('Missing Pages artifact or workflow credentials.');
  }
  const url = new URL(`/repos/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}/artifacts`, GITHUB_API_URL);
  url.searchParams.set('name', 'github-pages');
  await waitForPagesArtifact({ id, list: async () => {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(8000)
    });
    if ([404, 429, 502, 503, 504].includes(response.status)) return [];
    if (!response.ok) throw new Error(`GitHub artifact lookup returned HTTP ${response.status}.`);
    return (await response.json()).artifacts;
  } });
  console.log('The uploaded Pages artifact is visible.');
}
