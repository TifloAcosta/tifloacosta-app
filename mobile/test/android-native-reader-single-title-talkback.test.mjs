import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../../android-native-prototype/app/src/main/java/com/tifloacosta/nativeprototype/NativeTifloLector.kt', import.meta.url), 'utf8');

test('each library book has one accessible title, progress and adjustable actions', () => {
  assert.match(source, /val readingStatus = when \{/);
  assert.match(source, /OutlinedButton\(onClick = \{ run\(action\) \},[\s\S]*?clearAndSetSemantics \{/);
  assert.match(source, /contentDescription = book\.title[\s\S]*?stateDescription = readingStatus/);
  assert.match(source, /ReaderUnits\.percent\(book\.offset, book\.length\)/);
  assert.match(source, /progressBarRangeInfo = ProgressBarRangeInfo\([\s\S]*?setProgress \{/);
  assert.match(source, /customActions = actions\.mapIndexed/);
  assert.match(source, /onClick\(label = if \(english\) "Perform selected book action"/);
});
test('reading screen title does not repeat visible text or lose native actions', () => {
  assert.match(source, /\.clickable \{ execute\(selectedAction\) \}\.clearAndSetSemantics \{/);
  assert.match(source, /contentDescription = book\.title/);
  assert.match(source, /onClick\(label = if \(english\) "Perform selected reading action"/);
  assert.match(source, /CustomAccessibilityAction\(label\) \{ execute\(i\); true \}/);
});
