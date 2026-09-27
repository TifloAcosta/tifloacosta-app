package com.tifloacosta.app.reading;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ReadingAudioImportServiceTest {
    @Test
    public void approvedAudioExtensionsImportAsOneAudioFormatAndPreservePrivateExtension() {
        String[] extensions = {"mp3", "m4a", "m4b", "aac", "ogg", "opus", "flac", "wav"};
        for (int index = 0; index < extensions.length; index++) {
            String extension = extensions[index];
            FakeRepository repository = new FakeRepository();
            FakeFileStore store = new FakeFileStore();
            FakeAudioProbe probe = new FakeAudioProbe(ReadingAudioProbe.Result.readable(60_000L, null, null, null));
            ReadingImportService service = new ReadingImportService(repository, store, () -> 1000L, null, probe);

            ReadingImportResult result = service.importOne(
                    new ReadingImportSource("Libro." + extension.toUpperCase(), "application/octet-stream", null),
                    bytes("audio-" + index)
            );

            assertTrue("Expected import for ." + extension, result.isImported());
            ReadingBookRecord record = repository.findById(result.getBookId());
            assertNotNull(record);
            assertEquals("audio", record.getFormat());
            assertEquals("Libro", record.getTitle());
            assertTrue(record.getRelativePath().endsWith("/source." + extension));
            assertEquals(extension, store.lastSourceExtension);
            assertEquals(1, probe.inspectCount);
        }
    }

    @Test
    public void approvedMimeWithoutExtensionUsesCanonicalPrivateExtension() {
        FakeRepository repository = new FakeRepository();
        FakeFileStore store = new FakeFileStore();
        ReadingImportService service = new ReadingImportService(
                repository,
                store,
                () -> 1000L,
                null,
                new FakeAudioProbe(ReadingAudioProbe.Result.readable(10_000L, null, null, null))
        );

        ReadingImportResult result = service.importOne(
                new ReadingImportSource("grabacion", "audio/mpeg", null),
                bytes("mp3-data")
        );

        assertTrue(result.isImported());
        ReadingBookRecord record = repository.findById(result.getBookId());
        assertEquals("audio/mpeg", record.getMimeType());
        assertTrue(record.getRelativePath().endsWith("/source.mp3"));
    }

    @Test
    public void embeddedAudioTitleWinsWithoutInventingMissingArtistOrAlbum() {
        FakeRepository repository = new FakeRepository();
        FakeFileStore store = new FakeFileStore();
        ReadingAudioProbe.Result info = ReadingAudioProbe.Result.readable(
                120_000L,
                "  Título interno  ",
                null,
                ""
        );
        ReadingImportService service = new ReadingImportService(
                repository,
                store,
                () -> 1000L,
                null,
                new FakeAudioProbe(info)
        );

        ReadingImportResult result = service.importOne(
                new ReadingImportSource("nombre-archivo.m4b", "audio/mp4", null),
                bytes("m4b-data")
        );

        assertTrue(result.isImported());
        assertEquals("Título interno", repository.findById(result.getBookId()).getTitle());
        assertEquals(120_000L, info.getDurationMs());
        assertEquals(null, info.getArtist());
        assertEquals(null, info.getAlbum());
    }

    @Test
    public void unreadableAudioIsRejectedAndLeavesNoPrivateItemOrDatabaseRow() {
        FakeRepository repository = new FakeRepository();
        FakeFileStore store = new FakeFileStore();
        FakeAudioProbe probe = new FakeAudioProbe(ReadingAudioProbe.Result.invalid());
        ReadingImportService service = new ReadingImportService(repository, store, () -> 1000L, null, probe);

        ReadingImportResult result = service.importOne(
                new ReadingImportSource("roto.mp3", "audio/mpeg", null),
                bytes("not-really-audio")
        );

        assertTrue(result.isRejected());
        assertEquals("invalid-audio", result.getReason());
        assertTrue(repository.records.isEmpty());
        assertTrue(store.finalItems.isEmpty());
        assertTrue(store.temps.isEmpty());
        assertEquals(1, probe.inspectCount);
    }

    @Test
    public void duplicateAudioBytesReturnExistingBookAndCleanSecondTemp() {
        FakeRepository repository = new FakeRepository();
        FakeFileStore store = new FakeFileStore();
        FakeAudioProbe probe = new FakeAudioProbe(ReadingAudioProbe.Result.readable(10_000L, null, null, null));
        ReadingImportService service = new ReadingImportService(repository, store, () -> 1000L, null, probe);

        ReadingImportResult first = service.importOne(
                new ReadingImportSource("uno.mp3", "audio/mpeg", null),
                bytes("same-audio")
        );
        ReadingImportResult second = service.importOne(
                new ReadingImportSource("dos.mp3", "audio/mpeg", null),
                bytes("same-audio")
        );

        assertTrue(first.isImported());
        assertTrue(second.isDuplicate());
        assertEquals(first.getBookId(), second.getBookId());
        assertEquals(1, repository.records.size());
        assertEquals(1, store.finalItems.size());
        assertTrue(store.temps.isEmpty());
    }

    @Test
    public void knownAudioSizeStillRequiresPrivateStorageHeadroomBeforeProbeOrWrite() {
        FakeRepository repository = new FakeRepository();
        FakeFileStore store = new FakeFileStore();
        FakeAudioProbe probe = new FakeAudioProbe(ReadingAudioProbe.Result.readable(10_000L, null, null, null));
        long declared = 4096L;
        store.usableSpaceBytes = declared + ReadingImportService.REQUIRED_HEADROOM_BYTES - 1L;
        ReadingImportService service = new ReadingImportService(repository, store, () -> 1000L, null, probe);

        ReadingImportResult result = service.importOne(
                new ReadingImportSource("sin-espacio.flac", "audio/flac", declared),
                bytes("flac-data")
        );

        assertTrue(result.isRejected());
        assertEquals("insufficient-space", result.getReason());
        assertEquals(0, store.openCount);
        assertEquals(0, probe.inspectCount);
    }

    private static ByteArrayInputStream bytes(String value) {
        return new ByteArrayInputStream(value.getBytes(StandardCharsets.UTF_8));
    }

    private static final class FakeAudioProbe implements ReadingAudioProbe {
        private final Result result;
        private int inspectCount;

        private FakeAudioProbe(Result result) {
            this.result = result;
        }

        @Override
        public Result inspect(File file) {
            inspectCount++;
            return result;
        }
    }

    private static final class FakeRepository implements ReadingBookRepository {
        private final Map<String, ReadingBookRecord> records = new HashMap<>();

        @Override
        public ReadingBookRecord findById(String id) { return records.get(id); }

        @Override
        public ReadingBookRecord findBySha256(String sha256) {
            for (ReadingBookRecord record : records.values()) {
                if (sha256.equals(record.getSha256())) return record;
            }
            return null;
        }

        @Override
        public List<ReadingBookRecord> list(ReadingBookQuery query) { return new ArrayList<>(records.values()); }

        @Override
        public int count(ReadingBookQuery query) { return records.size(); }

        @Override
        public ReadingBookRecord latestInProgress() { return null; }

        @Override
        public void insert(ReadingBookRecord record) { records.put(record.getId(), record); }

        @Override
        public void updateProgress(String id, int blockIndex, double percent, String state, long lastReadAt) { }

        @Override
        public void delete(String id) { records.remove(id); }
    }

    private static final class FakeFileStore implements ReadingFileStore {
        private final Map<String, ByteArrayOutputStream> temps = new HashMap<>();
        private final Map<String, byte[]> finalItems = new HashMap<>();
        private long usableSpaceBytes = Long.MAX_VALUE;
        private int openCount;
        private String lastSourceExtension;

        @Override
        public long usableSpaceBytes() { return usableSpaceBytes; }

        @Override
        public OutputStream openTemp(String tempName) {
            openCount++;
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            temps.put(tempName, output);
            return output;
        }

        @Override
        public File tempFile(String tempName) {
            return new File(tempName);
        }

        @Override
        public boolean tempHasNonWhitespaceText(String tempName) { return false; }

        @Override
        public String moveTempToItem(String tempName, String id) throws IOException {
            return moveTempToItem(tempName, id, "txt", "txt");
        }

        @Override
        public String moveTempToItem(String tempName, String id, String format, String sourceExtension) throws IOException {
            ByteArrayOutputStream output = temps.remove(tempName);
            if (output == null) throw new IOException("missing temp");
            finalItems.put(id, output.toByteArray());
            lastSourceExtension = sourceExtension;
            return "items/" + id + "/source." + sourceExtension;
        }

        @Override
        public void deleteTemp(String tempName) { temps.remove(tempName); }

        @Override
        public void cleanupStaleTemps() { temps.clear(); }

        @Override
        public String readUtf8(String relativePath) { return null; }

        @Override
        public void deleteItemDirectory(String id) { finalItems.remove(id); }
    }
}
