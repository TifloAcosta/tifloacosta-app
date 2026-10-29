import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const list = await readFile(new URL('../../android-native-prototype/app/src/main/java/com/tifloacosta/nativeprototype/NativeYouTubeListRow.kt', import.meta.url), 'utf8');
const screen = await readFile(new URL('../../android-native-prototype/app/src/main/java/com/tifloacosta/nativeprototype/NativePrototypeActivity.kt', import.meta.url), 'utf8');

test('native video titles expose the same TalkBack selector as reader titles', () => {
  assert.match(screen, /NativeYouTubeListRow\(/);
  assert.match(list, /progressBarRangeInfo = ProgressBarRangeInfo/);
  assert.match(list, /setProgress \{/);
  assert.match(list, /customActions = actions\.map/);
  assert.match(list, /onClick = \{ runAction\(actions\[selected\]\.first\) \}/);
});
test('account actions work on the video list without entering playback', () => {
  for (const action of ['play', 'like', 'subscribe', 'comment', 'share', 'youtube']) {
    assert.ok(list.includes('"'+action+'"'), action);
  }
  assert.match(list, /account\.authenticated/);
  assert.match(list, /account\.act\(id, videoId\)/);
  assert.match(list, /account\.act\("comment", videoId, commentText\)/);
  assert.match(list, /commentText\.isNotBlank\(\)/);
  assert.match(list, /Intent\.ACTION_SEND/);
});
test('the native YouTube player and account remain unchanged', () => {
  assert.match(screen, /NativeYouTubePlayer\(/);
  assert.match(screen, /account = account/);
  assert.match(screen, /onAuthorize = onSignIn/);
  assert.match(screen, /onPlay = \{/);
});
