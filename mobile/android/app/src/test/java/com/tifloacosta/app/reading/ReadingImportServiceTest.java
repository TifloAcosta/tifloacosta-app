package com.tifloacosta.app.reading;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ReadingImportServiceTest {
    private static ByteArrayInputStream input(String text) {
        return new ByteArrayInputStream(text.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    public void duplicateBytesWithDifferentNameReturnExistingBook() {
        FakeRepository repository = new FakeRepository();
        FakeFileStore store = new FakeFileStore();
        ReadingImportService service = new ReadingImportService(repository, store, () -> 1000L);

        ReadingImportResult first = service.importOne(
                new ReadingImportSource("first.txt", "text/plain", 5L),
                input("hello")
        );
        ReadingImportResult second = service.importOne(
                new ReadingImportSource("renamed.txt", "text/plain", 5L),
                input("hello")
        );

        assertTrue(first.isImported());
        assertTrue(second.isDuplicate());
        assertEquals(first.getBookId(), second.getBookId());
        assertEquals(1, repository.records.size());
        assertEquals(1, store.finalItems.size());
        assertTrue(store.temps.isEmpty());
    }

    @Test
    public void unsupportedInputIsRejectedWithoutWriting() {
        FakeRepository repository = new FakeRepository();
        FakeFileStore store = new FakeFileStore();
        ReadingImportService service = new ReadingImportService(repository, store, () -> 1000L);

        ReadingImportResult result = service.importOne(
                new ReadingImportSource("book.pdf", "application/pdf", 10L),
                input("not a txt")
        );

        assertTrue(result.isRejected());
        assertEquals("unsupported", result.getReason());
        assertTrue(repository.records.isEmpty());
        assertTrue(store.temps.isEmpty());
    }

    @Test
    public void emptyAndBomOnlyTextAreRejected() {
        FakeRepository repository = new FakeRepository();
        FakeFileStore store = new FakeFileStore();
        ReadingImportService service = new ReadingImportService(repository, store, () -> 1000L);

        ReadingImportResult whitespace = service.importOne(
                new ReadingImportSource("empty.txt", "text/plain", null),
                input("  \n\t  ")
        );
        byte[] bomOnly = new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF, ' ', '\n'};
        ReadingImportResult bom = service.importOne(
                new ReadingImportSource("bom.txt", "text/plain", null),
                new ByteArrayInputStream(bomOnly)
        );

        assertTrue(whitespace.isRejected());
        assertEquals("empty", whitespace.getReason());
        assertTrue(bom.isRejected());
        assertEquals("empty", bom.getReason());
        assertTrue(repository.records.isEmpty());
        assertTrue(store.finalItems.isEmpty());
        assertTrue(store.temps.isEmpty());
    }

    @Test
    public void knownSizeRequiresSixteenMiBHeadroomBeforeWriting() {
        FakeRepository repository = new FakeRepository();
        FakeFileStore store = new FakeFileStore();
        long declared = 1024L;
        store.usableSpaceBytes = declared + ReadingImportService.REQUIRED_HEADROOM_BYTES - 1;
        ReadingImportService service = new ReadingImportService(repository, store, () -> 1000L);

        ReadingImportResult result = service.importOne(
                new ReadingImportSource("book.txt", "text/plain", declared),
                input("hello")
        );

        assertTrue(result.isRejected());
        assertEquals("insufficient-space", result.getReason());
        assertEquals(0, store.openCount);
        assertTrue(repository.records.isEmpty());
    }

    @Test
    public void repositoryInsertFailureRemovesFinalPrivateItem() {
        FakeRepository repository = new FakeRepository();
        repository.failInsert = true;
        FakeFileStore store = new FakeFileStore();
        ReadingImportService service = new ReadingImportService(repository, store, () -> 1000L);

        ReadingImportResult result = service.importOne(
                new ReadingImportSource("book.txt", "text/plain", null),
                input("hello")
        );

        assertTrue(result.isRejected());
        assertEquals("storage-error", result.getReason());
        assertTrue(store.finalItems.isEmpty());
        assertEquals(1, store.deletedItemIds.size());
        assertTrue(store.temps.isEmpty());
    }

    @Test
    public void staleTempCleanupIsDelegatedToPrivateStore() {
        FakeRepository repository = new FakeRepository();
        FakeFileStore store = new FakeFileStore();
        ReadingImportService service = new ReadingImportService(repository, store, () -> 1000L);

        service.cleanupStaleTemps();

        assertEquals(1, store.cleanupCount);
    }

    @Test
    public void oneFailedImportDoesNotInvalidateCompletedItem() {
        FakeRepository repository = new FakeRepository();
        FakeFileStore store = new FakeFileStore();
        ReadingImportService service = new ReadingImportService(repository, store, () -> 1000L);

        ReadingImportResult first = service.importOne(
                new ReadingImportSource("good.txt", "text/plain", null),
                input("first")
        );
        store.failNextMove = true;
        ReadingImportResult second = service.importOne(
                new ReadingImportSource("bad.txt", "text/plain", null),
                input("second")
        );

        assertTrue(first.isImported());
        assertTrue(second.isRejected());
        assertEquals("storage-error", second.getReason());
        assertEquals(1, repository.records.size());
        assertNotNull(repository.findById(first.getBookId()));
        assertEquals(1, store.finalItems.size());
    }

    private static final class FakeRepository implements ReadingBookRepository {
        private final Map<String, ReadingBookRecord> records = new HashMap<>();
        private boolean failInsert;

        @Override
        public ReadingBookRecord findById(String id) {
            return records.get(id);
        }

        @Override
        public ReadingBookRecord findBySha256(String sha256) {
            for (ReadingBookRecord record : records.values()) {
                if (sha256.equals(record.getSha256())) {
                    return record;
                }
            }
            return null;
        }

        @Override
        public List<ReadingBookRecord> list(ReadingBookQuery query) {
            return new ArrayList<>(records.values());
        }

        @Override
        public int count(ReadingBookQuery query) {
            return records.size();
        }

        @Override
        public ReadingBookRecord latestInProgress() {
            return null;
        }

        @Override
        public void insert(ReadingBookRecord record) {
            if (failInsert) {
                throw new IllegalStateException("insert failed");
            }
            records.put(record.getId(), record);
        }

        @Override
        public void updateProgress(String id, int blockIndex, double percent, String state, long lastReadAt) {
        }

        @Override
        public void delete(String id) {
            records.remove(id);
        }
    }

    private static final class FakeFileStore implements ReadingFileStore {
        private final Map<String, ByteArrayOutputStream> temps = new HashMap<>();
        private final Map<String, byte[]> finalItems = new HashMap<>();
        private final List<String> deletedItemIds = new ArrayList<>();
        private long usableSpaceBytes = Long.MAX_VALUE;
        private int cleanupCount;
        private int openCount;
        private boolean failNextMove;

        @Override
        public long usableSpaceBytes() {
            return usableSpaceBytes;
        }

        @Override
        public OutputStream openTemp(String tempName) {
            openCount++;
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            temps.put(tempName, output);
            return output;
        }

        @Override
        public boolean tempHasNonWhitespaceText(String tempName) {
            byte[] bytes = temps.get(tempName).toByteArray();
            int start = bytes.length >= 3 &&
                    (bytes[0] & 0xff) == 0xef &&
                    (bytes[1] & 0xff) == 0xbb &&
                    (bytes[2] & 0xff) == 0xbf ? 3 : 0;
            String text = new String(bytes, start, bytes.length - start, StandardCharsets.UTF_8);
            return !text.trim().isEmpty();
        }

        @Override
        public String moveTempToItem(String tempName, String id) throws IOException {
            if (failNextMove) {
                failNextMove = false;
                throw new IOException("move failed");
            }
            ByteArrayOutputStream output = temps.remove(tempName);
            byte[] bytes = output.toByteArray();
            finalItems.put(id, bytes);
            return "reading-library/items/" + id + "/source.txt";
        }

        @Override
        public void deleteTemp(String tempName) {
            temps.remove(tempName);
        }

        @Override
        public void cleanupStaleTemps() {
            cleanupCount++;
            temps.clear();
        }

        @Override
        public String readUtf8(String relativePath) {
            for (Map.Entry<String, byte[]> entry : finalItems.entrySet()) {
                if (relativePath.contains(entry.getKey())) {
                    return new String(entry.getValue(), StandardCharsets.UTF_8);
                }
            }
            return null;
        }

        @Override
        public void deleteItemDirectory(String id) {
            deletedItemIds.add(id);
            finalItems.remove(id);
        }
    }
}
