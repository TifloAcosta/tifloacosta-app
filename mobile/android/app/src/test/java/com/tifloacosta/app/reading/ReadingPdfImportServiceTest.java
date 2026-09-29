package com.tifloacosta.app.reading;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ReadingPdfImportServiceTest {
    private static ByteArrayInputStream input(String text) {
        return new ByteArrayInputStream(text.getBytes(StandardCharsets.UTF_8));
    }

    private static ReadingPdfExtractor readablePdf() {
        return new ReadingPdfExtractor((source, password) ->
                new ReadingPdfExtractor.BackendDocument(
                        "Título interno",
                        "Autor",
                        "es",
                        2,
                        false,
                        Arrays.asList(
                                new ReadingPdfResult.Page(1, "Primera página."),
                                new ReadingPdfResult.Page(2, "Segunda página.")
                        )
                )
        );
    }

    private static ReadingPdfExtractor passwordPdf() {
        return new ReadingPdfExtractor((source, password) -> {
            throw new ReadingPdfExtractor.PasswordRequiredException();
        });
    }

    private static ReadingPdfExtractor noTextPdf() {
        return new ReadingPdfExtractor((source, password) ->
                new ReadingPdfExtractor.BackendDocument(
                        "Escaneado",
                        "",
                        "es",
                        2,
                        false,
                        Arrays.asList(
                                new ReadingPdfResult.Page(1, "  \n"),
                                new ReadingPdfResult.Page(2, "")
                        )
                )
        );
    }

    private static ReadingPdfExtractor invalidPdf() {
        return new ReadingPdfExtractor((source, password) -> {
            throw new IOException("invalid pdf");
        });
    }

    @Test
    public void pdfExtensionImportsPrivatePdfAndStripsDisplayExtension() {
        FakeRepository repository = new FakeRepository();
        FakeFileStore store = new FakeFileStore();
        ReadingImportService service = new ReadingImportService(
                repository,
                store,
                () -> 1000L,
                readablePdf()
        );

        ReadingImportResult result = service.importOne(
                new ReadingImportSource("manual.PDF", "application/octet-stream", null),
                input("same-pdf-bytes")
        );

        assertTrue(result.isImported());
        ReadingBookRecord record = repository.findById(result.getBookId());
        assertNotNull(record);
        assertEquals("pdf", record.getFormat());
        assertEquals("manual", record.getTitle());
        assertEquals("application/pdf", record.getMimeType());
        assertTrue(record.getRelativePath().endsWith("/source.pdf"));
    }

    @Test
    public void applicationPdfMimeImportsWithoutFilenameExtension() {
        FakeRepository repository = new FakeRepository();
        FakeFileStore store = new FakeFileStore();
        ReadingImportService service = new ReadingImportService(
                repository,
                store,
                () -> 1000L,
                readablePdf()
        );

        ReadingImportResult result = service.importOne(
                new ReadingImportSource("documento", "application/pdf", null),
                input("pdf-mime-bytes")
        );

        assertTrue(result.isImported());
        ReadingBookRecord record = repository.findById(result.getBookId());
        assertEquals("pdf", record.getFormat());
        assertEquals("documento", record.getTitle());
        assertEquals("application/pdf", record.getMimeType());
    }

    @Test
    public void passwordRequiredPdfImportsEncryptedOriginalWithoutPasswordPersistence() {
        FakeRepository repository = new FakeRepository();
        FakeFileStore store = new FakeFileStore();
        ReadingImportService service = new ReadingImportService(
                repository,
                store,
                () -> 1000L,
                passwordPdf()
        );

        ReadingImportResult result = service.importOne(
                new ReadingImportSource("protegido.pdf", "application/pdf", null),
                input("encrypted-pdf-bytes")
        );

        assertTrue(result.isImported());
        ReadingBookRecord record = repository.findById(result.getBookId());
        assertNotNull(record);
        assertEquals("pdf", record.getFormat());
        assertTrue(record.getRelativePath().endsWith("/source.pdf"));
        assertEquals("protegido", record.getTitle());
    }

    @Test
    public void noTextPdfRejectsAndRollsBackPrivateTempState() {
        FakeRepository repository = new FakeRepository();
        FakeFileStore store = new FakeFileStore();
        ReadingImportService service = new ReadingImportService(
                repository,
                store,
                () -> 1000L,
                noTextPdf()
        );

        ReadingImportResult result = service.importOne(
                new ReadingImportSource("escaneado.pdf", "application/pdf", null),
                input("scanned-pdf-bytes")
        );

        assertTrue(result.isRejected());
        assertEquals("pdf-no-text", result.getReason());
        assertTrue(repository.records.isEmpty());
        assertTrue(store.temps.isEmpty());
        assertTrue(store.finalItems.isEmpty());
    }

    @Test
    public void invalidPdfRejectsAndRollsBackWithoutCreatingBook() {
        FakeRepository repository = new FakeRepository();
        FakeFileStore store = new FakeFileStore();
        ReadingImportService service = new ReadingImportService(
                repository,
                store,
                () -> 1000L,
                invalidPdf()
        );

        ReadingImportResult result = service.importOne(
                new ReadingImportSource("roto.pdf", "application/pdf", null),
                input("not-a-real-pdf")
        );

        assertTrue(result.isRejected());
        assertEquals("invalid-pdf", result.getReason());
        assertTrue(repository.records.isEmpty());
        assertTrue(store.temps.isEmpty());
        assertTrue(store.finalItems.isEmpty());
    }

    @Test
    public void duplicatePdfBytesReturnExistingBookWithoutSecondPrivateCopy() {
        FakeRepository repository = new FakeRepository();
        FakeFileStore store = new FakeFileStore();
        ReadingImportService service = new ReadingImportService(
                repository,
                store,
                () -> 1000L,
                readablePdf()
        );

        ReadingImportResult first = service.importOne(
                new ReadingImportSource("primero.pdf", "application/pdf", null),
                input("same-pdf-bytes")
        );
        ReadingImportResult second = service.importOne(
                new ReadingImportSource("renombrado.pdf", "application/pdf", null),
                input("same-pdf-bytes")
        );

        assertTrue(first.isImported());
        assertTrue(second.isDuplicate());
        assertEquals(first.getBookId(), second.getBookId());
        assertEquals(1, repository.records.size());
        assertEquals(1, store.finalItems.size());
        assertTrue(store.temps.isEmpty());
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

        public InputStream openTempInput(String tempName) throws IOException {
            ByteArrayOutputStream output = temps.get(tempName);
            if (output == null) throw new IOException("missing temp");
            return new ByteArrayInputStream(output.toByteArray());
        }

        @Override
        public boolean tempHasNonWhitespaceText(String tempName) throws IOException {
            return tempHasReadableText(tempName, "txt");
        }

        @Override
        public boolean tempHasReadableText(String tempName, String format) throws IOException {
            byte[] bytes = temps.get(tempName).toByteArray();
            try (InputStreamReader reader = new InputStreamReader(
                    new ByteArrayInputStream(bytes),
                    StandardCharsets.UTF_8
            )) {
                return ReadingContentValidator.hasReadableText(reader, format);
            }
        }

        @Override
        public String moveTempToItem(String tempName, String id) throws IOException {
            return moveTempToItem(tempName, id, "txt");
        }

        @Override
        public String moveTempToItem(String tempName, String id, String format) throws IOException {
            ByteArrayOutputStream output = temps.remove(tempName);
            if (output == null) throw new IOException("missing temp");
            finalItems.put(id, output.toByteArray());
            String extension = "html".equals(format) ? "html" : "pdf".equals(format) ? "pdf" : "txt";
            return "items/" + id + "/source." + extension;
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
            return null;
        }

        @Override
        public void deleteItemDirectory(String id) {
            finalItems.remove(id);
        }
    }
}
