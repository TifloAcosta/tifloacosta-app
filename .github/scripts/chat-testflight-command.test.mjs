import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCommand } from './chat-testflight-command.mjs';

const event = { action: 'created', sender: { login: 'TifloAcosta' }, issue: { number: 345 }, comment: { id: 567, body: '/tiflo testflight dry-run feature/mi-musica', user: { login: 'TifloAcosta' } } };
const check = (changes = {}) => validateCommand({ ...event, ...changes }, { controlIssue: 345 });

test('accepts exact dry-run request from owner in control issue', () => {
  assert.deepEqual(check(), { mode: 'dry-run', branch: 'feature/mi-musica', commentId: 567 });
});
test('rejects a different author even when sender is owner', () => {
  assert.throws(() => check({ comment: { ...event.comment, user: { login: 'stranger' } } }), /author/);
});
test('rejects a different issue', () => {
  assert.throws(() => check({ issue: { ...event.issue, number: 124 } }), /issue/);
});
test('rejects a malformed or extra command', () => {
  assert.throws(() => check({ comment: { ...event.comment, body: '/tiflo testflight dry-run feature/mi-musica; bad' } }), /command/);
});
test('rejects unexpected or unsafe branches', () => {
  assert.throws(() => check({ comment: { ...event.comment, body: '/tiflo testflight run main' } }), /branch/);
  assert.throws(() => check({ comment: { ...event.comment, body: '/tiflo testflight run feature/unreviewed' } }), /branch/);
});
test('rejects duplicate delivery and non-created actions', () => {
  assert.throws(() => check({ action: 'edited' }), /action/);
});
