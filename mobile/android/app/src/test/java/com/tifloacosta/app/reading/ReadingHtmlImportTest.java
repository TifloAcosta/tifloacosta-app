package com.tifloacosta.app.reading;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ReadingHtmlImportTest {
    private static ByteArrayInputStream input(String text) {
        return new ByteArrayInputStream(text.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    public void htmlExtensionIsImportedAsHtml() {
        Fixture fixture = new Fixture();

        ReadingImportResult result = fixture.service.importOne(
                new ReadingImportSource("manual.html", "application/octet-stream", null),
                input("<h1>Manual</h1><p>Contenido.</p>")
        );

        assertTrue(result.isImported());
        ReadingBookRecord record = fixture.repository.findById(result.getBookId());
        assertEquals("html", record.getFormat());
        assertEquals("manual", record.getTitle());
    }

    @Test
    public void htmExtensionIsImportedAsHtml() {
        Fixture fixture = new Fixture();

        ReadingImportResult result = fixture.service.importOne(
                new ReadingImportSource("manual.htm", null, null),
                input("<p>Contenido.</p>")
        );

        assertTrue(result.isImported());
        ReadingBookRecord record = fixture.repository.findById(result.getBookId());
        assertEquals("html", record.getFormat());
        assertEquals("manual", record.getTitle());
    }

    @Test
    public void textHtmlMimeIsImportedAsHtmlWithoutHtmlExtension() {
        Fixture fixture = new Fixture();

        ReadingImportResult result = fixture.service.importOne(
                new ReadingImportSource("documento", "text/html", null),
                input("<p>Contenido.</p>")
        );

        assertTrue(result.isImported());
        assertEquals("html", fixture.repository.findById(result.getBookId()).getFormat());
    }

    @Test
    public void txtImportRemainsTxt() {
        Fixture fixture = new Fixture();

        ReadingImportResult result = fixture.service.importOne(
                new ReadingImportSource("notas.txt", "text/plain", null),
                input("Texto normal.")
        );

        assertTrue(result.isImported());
        ReadingBookRecord record = fixture.repository.findById(result.getBookId());
        assertEquals("txt", record.getFormat());
        assertEquals("notas", record.getTitle());
    }

    private static final class Fixture {
        private final FakeRepository repository = new FakeRepository();
        private final FakeFileStore store = new FakeFileStore();
        private final ReadingImportService service = new ReadingImportService(repository, store, () -> 1000L);
    }

    private static final class FakeRepository implements ReadingBookRepository {
        private final Map<String, ReadingBookRecord> records = new HashMap<>();

        @Override
        public ReadingBookRecord findById(String id) {
            return records.get(id);
        }

        @Override
        public ReadingBookRecord findBySha256(String sha256) {
            for (ReadingBookRecord record : records.values()) {
                if (sha256.equals(record.getSha256())) return record;
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

        @Override
        public long usableSpaceBytes() {
            return Long.MAX_VALUE;
        }

        @Override
        public OutputStream openTemp(String tempName) {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            temps.put(tempName, output);
            return output;
        }

        @Override
        public boolean tempHasNonWhitespaceText(String tempName) {
            String text = new String(temps.get(tempName).toByteArray(), StandardCharsets.UTF_8);
            return !text.trim().isEmpty();
        }

        @Override
        public String moveTempToItem(String tempName, String id) {
            finalItems.put(id, temps.remove(tempName).toByteArray());
            return "items/" + id + "/source.txt";
        }

        @Override
        public void deleteTemp(String tempName) {
            temps.remove(tempName);
        }

        @Override
        public void cleanupStaleTemps() {
            temps.clear();
        }

        @Override
        public String readUtf8(String relativePath) {
            return "";
        }

        @Override
        public void deleteItemDirectory(String id) {
            finalItems.remove(id);
        }
    }
}
