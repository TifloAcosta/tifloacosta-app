import { readFileSync } from 'node:fs';
const COMMAND = /^\/tiflo testflight (dry-run|run) (feature\/[a-z0-9][a-z0-9._/-]{0,90}|release\/[a-z0-9][a-z0-9._/-]{0,90})$/;

export function validateCommand(event, { controlIssue }) {
  if (event.action !== 'created') throw Error('Invalid action');
  if (event.sender?.login !== 'TifloAcosta' || event.comment?.user?.login !== 'TifloAcosta') throw Error('Unauthorized author');
  if (!Number.isSafeInteger(controlIssue) || event.issue?.number !== controlIssue) throw Error('Invalid control issue');
  const match = COMMAND.exec(event.comment?.body?.trim() ?? '');
  if (!match) throw Error('Invalid command or branch');
  const branch = match[2];
  if (branch !== 'feature/mi-musica') throw Error('branch not allowlisted for TestFlight');
  if (branch.includes('..') || branch.includes('//') || branch.endsWith('/') || branch.endsWith('.')) throw Error('Invalid branch');
  if (!Number.isSafeInteger(event.comment?.id)) throw Error('Invalid comment ID');
  return { mode: match[1], branch, commentId: event.comment.id };
}

export function authorizeRealUpload(env) {
  if (env.ALLOW_REAL_UPLOAD !== 'true') throw Error('Real TestFlight dispatch disabled pending integration verification');
}

async function request(base, token, endpoint, options = {}) {
  const response = await fetch(`${base}${endpoint}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...options.headers }
  });
  if (!response.ok) throw Error(`GitHub API ${endpoint}: ${response.status} ${(await response.text()).slice(0, 300)}`);
  return response.status === 204 ? null : response.json();
}

export async function execute(event, env = process.env) {
  const command = validateCommand(event, { controlIssue: Number(env.CONTROL_ISSUE) });
  const token = env.GITHUB_TOKEN;
  const repo = env.GITHUB_REPOSITORY;
  if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repo ?? '')) throw Error('Missing GitHub context');
  const base = `${env.GITHUB_API_URL || 'https://api.github.com'}/repos/${repo}`;
  const reactions = await request(base, token, `/issues/comments/${command.commentId}/reactions?per_page=100`);
  if (reactions.some(r => ['eyes', 'rocket'].includes(r.content) && r.user?.login === 'github-actions[bot]')) throw Error('Duplicate or previously claimed command');
  await request(base, token, `/branches/${encodeURIComponent(command.branch)}`);
  if (command.mode === 'dry-run') {
    console.log(`DRY RUN: validated ${command.branch}; no TestFlight workflow triggered.`);
    return;
  }
  authorizeRealUpload(env);
  // Claim before dispatch: a failed acknowledgment must not permit a duplicate upload.
  await request(base, token, `/issues/comments/${command.commentId}/reactions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'eyes' })
  });
  await request(base, token, '/actions/workflows/ios-native-testflight-upload.yml/dispatches', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: command.branch })
  });
  await request(base, token, `/issues/comments/${command.commentId}/reactions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'rocket' })
  });
  console.log(`Dispatched TestFlight for ${command.branch}.`);
}

if (process.argv[1]?.endsWith('/chat-testflight-command.mjs')) {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  execute(event).catch(error => { console.error(error.message); process.exitCode = 1; });
}
