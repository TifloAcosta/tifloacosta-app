package com.tifloacosta.app.reading;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.junit.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

public class ReadingBackupServiceTest {
    @Test
    public void completeAndSelectedExportContainOnlyRequestedBooksAndValidate() throws Exception {
        FakeRepository repository = new FakeRepository();
        FakeFileStore store = new FakeFileStore();
        addTextBook(repository, store, "one", "sha-one", "Uno", "Primero", "in-reading", 2, 25d);
        addTextBook(repository, store, "two", "sha-two", "Dos", "Segundo", "not-read", 0, 0d);
        ReadingBackupService service = new ReadingBackupService(repository, store, () -> 1234L);

        byte[] complete = exportAll(service);
        Map<String, byte[]> completeEntries = unzip(complete);
        assertTrue(completeEntries.containsKey("manifest.json"));
        assertEquals(3, completeEntries.size());
        ReadingRestorePlan completePlan = emptyService().planRestore(new ByteArrayInputStream(complete));
        assertEquals(2, completePlan.getAdditions().size());

        ByteArrayOutputStream selectedOut = new ByteArrayOutputStream();
        service.exportSelected(selectedOut, Collections.singletonList("one"));
        Map<String, byte[]> selectedEntries = unzip(selectedOut.toByteArray());
        assertEquals(2, selectedEntries.size());
        String manifest = new String(selectedEntries.get("manifest.json"), StandardCharsets.UTF_8);
        assertTrue(manifest.contains("\"version\":1"));
        assertTrue(manifest.contains("sha-one"));
        assertFalse(manifest.contains("sha-two"));
        ReadingRestorePlan selectedPlan = emptyService().planRestore(
                new ByteArrayInputStream(selectedOut.toByteArray())
        );
        assertEquals(1, selectedPlan.getAdditions().size());
    }

    @Test
    public void damagedContentIsRejectedBeforeLibraryMutation() throws Exception {
        FakeRepository sourceRepository = new FakeRepository();
        FakeFileStore sourceStore = new FakeFileStore();
        addTextBook(sourceRepository, sourceStore, "one", "sha-one", "Uno", "Original", "not-read", 0, 0d);
        ReadingBackupService source = new ReadingBackupService(sourceRepository, sourceStore, () -> 1L);
        byte[] backup = exportAll(source);
        Map<String, byte[]> entries = unzip(backup);
        for (String name : new ArrayList<>(entries.keySet())) {
            if (!"manifest.json".equals(name)) entries.put(name, "alterado".getBytes(StandardCharsets.UTF_8));
        }
        byte[] damaged = zip(entries);

        FakeRepository targetRepository = new FakeRepository();
        FakeFileStore targetStore = new FakeFileStore();
        ReadingBackupService target = new ReadingBackupService(targetRepository, targetStore, () -> 2L);
        try {
            target.planRestore(new ByteArrayInputStream(damaged));
            fail("Expected integrity rejection");
        } catch (ReadingBackupService.BackupException error) {
            assertEquals("integrity", error.getReason());
        }
        assertTrue(targetRepository.records.isEmpty());
        assertTrue(targetStore.finalFiles.isEmpty());
    }

    @Test
    public void restorePreflightRejectsInsufficientSpaceBeforeWriting() throws Exception {
        FakeRepository sourceRepository = new FakeRepository();
        FakeFileStore sourceStore = new FakeFileStore();
        addTextBook(sourceRepository, sourceStore, "one", "sha-one", "Uno", "1234567890", "not-read", 0, 0d);
        ReadingBackupService source = new ReadingBackupService(sourceRepository, sourceStore, () -> 1L);
        byte[] backup = exportAll(source);

        FakeRepository targetRepository = new FakeRepository();
        FakeFileStore targetStore = new FakeFileStore();
        targetStore.usable = 10L + ReadingBackupService.REQUIRED_HEADROOM_BYTES - 1L;
        ReadingBackupService target = new ReadingBackupService(targetRepository, targetStore, () -> 2L);
        try {
            target.planRestore(new ByteArrayInputStream(backup));
            fail("Expected insufficient-space rejection");
        } catch (ReadingBackupService.BackupException error) {
            assertEquals("insufficient-space", error.getReason());
        }
        assertTrue(targetRepository.records.isEmpty());
        assertEquals(0, targetStore.openTempCount);
    }

    @Test
    public void restoreIntoEmptyLibraryAddsContentMarksSettingsAndQueue() throws Exception {
        FakeRepository sourceRepository = new FakeRepository();
        FakeFileStore sourceStore = new FakeFileStore();
        ReadingBookRecord sourceBook = addTextBook(
                sourceRepository, sourceStore, "one", "sha-one", "Uno", "Contenido", "in-reading", 4, 44d
        );
        sourceRepository.insertMark(new ReadingMarkRecord(
                "mark-source", "one", "bookmark", 4, 1, "marca", "p4", 50L
        ));
        sourceRepository.setReadingSetting(new ReadingSettingsRecord(
                "book", "one", "visual.textSize", "125", 60L
        ));
        sourceRepository.addToQueue("one");
        ReadingBackupService source = new ReadingBackupService(sourceRepository, sourceStore, () -> 100L);
        byte[] backup = exportAll(source);

        FakeRepository targetRepository = new FakeRepository();
        FakeFileStore targetStore = new FakeFileStore();
        ReadingBackupService target = new ReadingBackupService(targetRepository, targetStore, () -> 200L);
        ReadingRestorePlan plan = target.planRestore(new ByteArrayInputStream(backup));
        assertEquals(1, plan.getAdditions().size());
        target.restore(new ByteArrayInputStream(backup), plan);

        ReadingBookRecord restored = targetRepository.findBySha256(sourceBook.getSha256());
        assertNotNull(restored);
        assertEquals("Uno", restored.getTitle());
        assertEquals("in-reading", restored.getState());
        assertEquals(4, restored.getBlockIndex());
        assertEquals("Contenido", targetStore.readUtf8(restored.getRelativePath()));
        assertEquals(1, targetRepository.listMarks(restored.getId(), null).size());
        assertEquals("125", targetRepository.getReadingSetting("book", restored.getId(), "visual.textSize").getValue());
        assertTrue(targetRepository.isQueued(restored.getId()));
    }

    @Test
    public void existingBookMergesMarksQueueAndStateButKeepsCurrentSettingsAndPositionUntilResolved() throws Exception {
        FakeRepository sourceRepository = new FakeRepository();
        FakeFileStore sourceStore = new FakeFileStore();
        addTextBook(sourceRepository, sourceStore, "backup", "same-sha", "Libro", "Mismo", "in-reading", 8, 80d);
        sourceRepository.insertMark(new ReadingMarkRecord(
                "backup-mark", "backup", "important", 8, 0, "copia", "b8", 80L
        ));
        sourceRepository.setReadingSetting(new ReadingSettingsRecord(
                "book", "backup", "visual.textSize", "140", 80L
        ));
        sourceRepository.setReadingSetting(new ReadingSettingsRecord(
                "book", "backup", "visual.lineSpacing", "1.5", 80L
        ));
        sourceRepository.addToQueue("backup");
        ReadingBackupService source = new ReadingBackupService(sourceRepository, sourceStore, () -> 100L);
        byte[] backup = exportAll(source);

        FakeRepository targetRepository = new FakeRepository();
        FakeFileStore targetStore = new FakeFileStore();
        ReadingBookRecord current = addTextBook(
                targetRepository, targetStore, "current", "same-sha", "Libro", "Mismo", "read", 3, 100d
        );
        targetRepository.insertMark(new ReadingMarkRecord(
                "current-mark", "current", "bookmark", 3, 0, "actual", "b3", 30L
        ));
        targetRepository.setReadingSetting(new ReadingSettingsRecord(
                "book", "current", "visual.textSize", "110", 90L
        ));
        ReadingBackupService target = new ReadingBackupService(targetRepository, targetStore, () -> 200L);

        ReadingRestorePlan plan = target.planRestore(new ByteArrayInputStream(backup));
        assertEquals(0, plan.getAdditions().size());
        assertEquals(1, plan.getDuplicates().size());
        assertEquals(1, plan.getPositionConflicts().size());
        target.restore(new ByteArrayInputStream(backup), plan);

        ReadingBookRecord merged = targetRepository.findById(current.getId());
        assertEquals("read", merged.getState());
        assertEquals(3, merged.getBlockIndex());
        assertEquals(2, targetRepository.listMarks("current", null).size());
        assertTrue(targetRepository.isQueued("current"));
        assertEquals("110", targetRepository.getReadingSetting("book", "current", "visual.textSize").getValue());
        assertEquals("1.5", targetRepository.getReadingSetting("book", "current", "visual.lineSpacing").getValue());

        ReadingRestorePlan useBackup = target.planRestore(new ByteArrayInputStream(backup));
        useBackup.resolvePosition("same-sha", ReadingRestorePlan.PositionChoice.USE_BACKUP);
        target.restore(new ByteArrayInputStream(backup), useBackup);
        assertEquals(8, targetRepository.findById("current").getBlockIndex());
        assertEquals("read", targetRepository.findById("current").getState());
    }

    private static ReadingBackupService emptyService() {
        return new ReadingBackupService(new FakeRepository(), new FakeFileStore(), () -> 9L);
    }

    private static byte[] exportAll(ReadingBackupService service) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        service.exportAll(output);
        return output.toByteArray();
    }

    private static ReadingBookRecord addTextBook(
            FakeRepository repository,
            FakeFileStore store,
            String id,
            String sha,
            String title,
            String text,
            String state,
            int blockIndex,
            double percent
    ) {
        String path = "items/" + id + "/source.txt";
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        ReadingBookRecord record = new ReadingBookRecord(
                id, sha, title, "Autor", "es", "txt", "text/plain", path,
                bytes.length, 10L, blockIndex == 0 ? null : 20L, state,
                blockIndex, 0, null, 0, 0L, percent
        );
        repository.insert(record);
        store.finalFiles.put(path, bytes);
        return record;
    }

    private static Map<String, byte[]> unzip(byte[] bytes) throws IOException {
        Map<String, byte[]> entries = new LinkedHashMap<>();
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            ZipEntry entry;
            byte[] buffer = new byte[1024];
            while ((entry = zip.getNextEntry()) != null) {
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                int read;
                while ((read = zip.read(buffer)) >= 0) {
                    if (read > 0) output.write(buffer, 0, read);
                }
                entries.put(entry.getName(), output.toByteArray());
            }
        }
        return entries;
    }

    private static byte[] zip(Map<String, byte[]> entries) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(output)) {
            for (Map.Entry<String, byte[]> entry : entries.entrySet()) {
                zip.putNextEntry(new ZipEntry(entry.getKey()));
                zip.write(entry.getValue());
                zip.closeEntry();
            }
        }
        return output.toByteArray();
    }

    private static final class FakeRepository implements ReadingBookRepository {
        private final Map<String, ReadingBookRecord> records = new LinkedHashMap<>();
        private final Map<String, List<ReadingMarkRecord>> marks = new HashMap<>();
        private final Map<String, ReadingSettingsRecord> settings = new LinkedHashMap<>();
        private final List<String> queue = new ArrayList<>();

        @Override public ReadingBookRecord findById(String id) { return records.get(id); }
        @Override public ReadingBookRecord findBySha256(String sha256) {
            for (ReadingBookRecord record : records.values()) if (sha256.equals(record.getSha256())) return record;
            return null;
        }
        @Override public List<ReadingBookRecord> list(ReadingBookQuery query) { return new ArrayList<>(records.values()); }
        @Override public int count(ReadingBookQuery query) { return records.size(); }
        @Override public ReadingBookRecord latestInProgress() { return null; }
        @Override public void insert(ReadingBookRecord record) { records.put(record.getId(), record); }
        @Override public void updateProgress(String id, int blockIndex, double percent, String state, long lastReadAt) {
            ReadingBookRecord old = records.get(id);
            updateProgress(id, blockIndex, old.getUnitIndex(), old.getAnchorText(), old.getMediaTrackIndex(), old.getMediaPositionMs(), percent, state, lastReadAt);
        }
        @Override public void updateProgress(String id, int blockIndex, int unitIndex, String anchorText, int mediaTrackIndex, long mediaPositionMs, double percent, String state, long lastReadAt) {
            ReadingBookRecord old = records.get(id);
            records.put(id, new ReadingBookRecord(
                    old.getId(), old.getSha256(), old.getTitle(), old.getAuthor(), old.getLanguage(), old.getFormat(), old.getMimeType(), old.getRelativePath(),
                    old.getSizeBytes(), old.getImportedAt(), lastReadAt, state, blockIndex, unitIndex, anchorText, mediaTrackIndex, mediaPositionMs, percent
            ));
        }
        @Override public void updateBookMetadata(String id, String title, String author, String language, String state) {
            ReadingBookRecord old = records.get(id);
            records.put(id, new ReadingBookRecord(
                    old.getId(), old.getSha256(), title, author, language, old.getFormat(), old.getMimeType(), old.getRelativePath(), old.getSizeBytes(),
                    old.getImportedAt(), old.getLastReadAt(), state, old.getBlockIndex(), old.getUnitIndex(), old.getAnchorText(), old.getMediaTrackIndex(), old.getMediaPositionMs(), old.getPercent()
            ));
        }
        @Override public void insertMark(ReadingMarkRecord record) { marks.computeIfAbsent(record.getBookId(), ignored -> new ArrayList<>()).add(record); }
        @Override public List<ReadingMarkRecord> listMarks(String bookId, String type) {
            List<ReadingMarkRecord> result = new ArrayList<>();
            for (ReadingMarkRecord mark : marks.getOrDefault(bookId, Collections.emptyList())) if (type == null || type.equals(mark.getType())) result.add(mark);
            return result;
        }
        @Override public void deleteMark(String id) {
            for (List<ReadingMarkRecord> list : marks.values()) list.removeIf(mark -> id.equals(mark.getId()));
        }
        @Override public ReadingSettingsRecord getReadingSetting(String scope, String bookId, String key) { return settings.get(scope + "|" + bookId + "|" + key); }
        @Override public void setReadingSetting(ReadingSettingsRecord record) { settings.put(record.getScope() + "|" + record.getBookId() + "|" + record.getKey(), record); }
        @Override public List<ReadingSettingsRecord> listReadingSettings(String scope, String bookId) {
            List<ReadingSettingsRecord> result = new ArrayList<>();
            for (ReadingSettingsRecord setting : settings.values()) if (scope.equals(setting.getScope()) && bookId.equals(setting.getBookId())) result.add(setting);
            return result;
        }
        @Override public List<ReadingQueueRecord> listQueue() {
            List<ReadingQueueRecord> result = new ArrayList<>();
            for (int i = 0; i < queue.size(); i++) result.add(new ReadingQueueRecord(records.get(queue.get(i)), i, i + 1L));
            return result;
        }
        @Override public boolean addToQueue(String bookId) { if (!queue.contains(bookId)) queue.add(bookId); return true; }
        @Override public boolean removeFromQueue(String bookId) { return queue.remove(bookId); }
        @Override public boolean moveQueueItem(String bookId, int targetIndex) { return false; }
        @Override public boolean isQueued(String bookId) { return queue.contains(bookId); }
        @Override public int queueIndex(String bookId) { return queue.indexOf(bookId); }
        @Override public List<ReadingAudioTrackRecord> listAudioTracks(String bookId) { return Collections.emptyList(); }
        @Override public void delete(String id) { records.remove(id); queue.remove(id); marks.remove(id); }
    }

    private static final class FakeFileStore implements ReadingFileStore {
        private final Map<String, byte[]> finalFiles = new LinkedHashMap<>();
        private final Map<String, ByteArrayOutputStream> temps = new HashMap<>();
        private long usable = Long.MAX_VALUE;
        private int openTempCount;

        @Override public long usableSpaceBytes() { return usable; }
        @Override public OutputStream openTemp(String tempName) {
            openTempCount++;
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            temps.put(tempName, output);
            return output;
        }
        @Override public InputStream openStoredInput(String relativePath) throws IOException {
            byte[] bytes = finalFiles.get(relativePath);
            if (bytes == null) throw new IOException("missing " + relativePath);
            return new ByteArrayInputStream(bytes);
        }
        @Override public boolean tempHasNonWhitespaceText(String tempName) { return true; }
        @Override public String moveTempToItem(String tempName, String id) {
            return moveTempToItem(tempName, id, "txt", "txt");
        }
        @Override public String moveTempToItem(String tempName, String id, String format, String sourceExtension) {
            String extension = sourceExtension == null || sourceExtension.isEmpty() ? format : sourceExtension;
            String path = "items/" + id + "/source." + extension;
            finalFiles.put(path, temps.remove(tempName).toByteArray());
            return path;
        }
        @Override public void deleteTemp(String tempName) { temps.remove(tempName); }
        @Override public void cleanupStaleTemps() { temps.clear(); }
        @Override public String readUtf8(String relativePath) { return new String(finalFiles.get(relativePath), StandardCharsets.UTF_8); }
        @Override public void deleteItemDirectory(String id) { finalFiles.keySet().removeIf(path -> path.startsWith("items/" + id + "/")); }
    }
}