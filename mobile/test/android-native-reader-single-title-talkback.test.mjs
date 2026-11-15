import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../../android-native-prototype/app/src/main/java/com/tifloacosta/nativeprototype/NativeTifloLector.kt', import.meta.url), 'utf8');

test('each library book has one accessible title, progress and adjustable actions', () => {
  assert.match(source, /val readingStatus = when \{/);
  assert.match(source, /OutlinedButton\(onClick = \{ run\(action\) \},[\s\S]*?clearAndSetSemantics \{/);
  assert.ok(source.includes('contentDescription = NativeReaderRowPresentation.label(book, readingStatus, talkBackDetail, uiLanguage)'));
  assert.ok(source.includes('stateDescription = actions[action]'));
  assert.ok(!source.includes('Text(readingStatus + if (book.id in queuedIds)'));
  assert.match(source, /ReaderUnits\.percent\(book\.offset, book\.length\)/);
  assert.match(source, /progressBarRangeInfo = ProgressBarRangeInfo\([\s\S]*?setProgress \{/);
  assert.match(source, /customActions = actions\.mapIndexed/);
  assert.match(source, /onClick\(label = NativeReaderLibraryStrings\.get\(uiLanguage, "bookAction"\)/);
});
test('reading screen title does not repeat visible text or lose native actions', () => {
  assert.match(source, /\.clickable \{ execute\(selectedAction\) \}\.clearAndSetSemantics \{/);
  assert.ok(source.includes('contentDescription = book.title'));
  assert.match(source, /onClick\(label = NativeReaderInlineStrings\.get\(uiLanguage, "readingAction"\)/);
  assert.match(source, /CustomAccessibilityAction\(label\) \{ execute\(i\); true \}/);
});
