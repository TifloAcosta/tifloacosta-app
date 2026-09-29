package com.tifloacosta.app.reading;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

public class ReadingDocxImportServiceTest {
    @Test
    public void importsDocxWithMetadataMimeAndPrivateDocxExtension() throws Exception {
        File root = Files.createTempDirectory("reading-docx-import-").toFile();
        try {
            FakeRepository repository = new FakeRepository();
            DiskFileStore store = new DiskFileStore(root);
            ReadingImportService service = new ReadingImportService(repository, store, () -> 1234L);

            ReadingImportResult result = service.importOne(
                    new ReadingImportSource(
                            "manual.docx",
                            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                            null
                    ),
                    new ByteArrayInputStream(docx(false))
            );

            assertTrue(result.isImported());
            ReadingBookRecord record = repository.findById(result.getBookId());
            assertNotNull(record);
            assertEquals("docx", record.getFormat());
            assertEquals("Manual accesible", record.getTitle());
            assertEquals("Autor prueba", record.getAuthor());
            assertEquals("es", record.getLanguage());
            assertEquals(
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    record.getMimeType()
            );
            assertTrue(record.getRelativePath().endsWith("/source.docx"));
        } finally {
            deleteTree(root);
        }
    }

    @Test
    public void propagatesMacroEnabledDocxRejection() throws Exception {
        File root = Files.createTempDirectory("reading-docx-macro-").toFile();
        try {
            FakeRepository repository = new FakeRepository();
            DiskFileStore store = new DiskFileStore(root);
            ReadingImportService service = new ReadingImportService(repository, store, () -> 1234L);

            ReadingImportResult result = service.importOne(
                    new ReadingImportSource("macro.docx", null, null),
                    new ByteArrayInputStream(docx(true))
            );

            assertTrue(result.isRejected());
            assertEquals("macro-enabled-docx", result.getReason());
            assertTrue(repository.records.isEmpty());
        } finally {
            deleteTree(root);
        }
    }

    private static byte[] docx(boolean macroEnabled) throws IOException {
        String mainType = macroEnabled
                ? "application/vnd.ms-word.document.macroEnabled.main+xml"
                : "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(output)) {
            add(zip, "[Content_Types].xml",
                    "<?xml version=\"1.0\"?>"
                            + "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">"
                            + "<Override PartName=\"/word/document.xml\" ContentType=\"" + mainType + "\"/>"
                            + "<Override PartName=\"/docProps/core.xml\" ContentType=\"application/vnd.openxmlformats-package.core-properties+xml\"/>"
                            + "</Types>");
            add(zip, "_rels/.rels",
                    "<?xml version=\"1.0\"?>"
                            + "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
                            + "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/>"
                            + "<Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties\" Target=\"docProps/core.xml\"/>"
                            + "</Relationships>");
            add(zip, "docProps/core.xml",
                    "<?xml version=\"1.0\"?>"
                            + "<cp:coreProperties xmlns:cp=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\">"
                            + "<dc:title>Manual accesible</dc:title><dc:creator>Autor prueba</dc:creator><dc:language>es</dc:language>"
                            + "</cp:coreProperties>");
            add(zip, "word/document.xml",
                    "<?xml version=\"1.0\"?>"
                            + "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">"
                            + "<w:body><w:p><w:r><w:t>Contenido accesible</w:t></w:r></w:p></w:body>"
                            + "</w:document>");
        }
        return output.toByteArray();
    }

    private static void add(ZipOutputStream zip, String name, String content) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    private static void deleteTree(File file) {
        if (file == null || !file.exists()) return;
        File[] children = file.listFiles();
        if (children != null) {
            for (File child : children) deleteTree(child);
        }
        file.delete();
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
        public List<ReadingBookRecord> list(ReadingBookQuery query) {
            return new ArrayList<>(records.values());
        }

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

    private static final class DiskFileStore implements ReadingFileStore {
        private final File root;
        private final File temp;
        private final File items;

        private DiskFileStore(File root) {
            this.root = root;
            this.temp = new File(root, "tmp");
            this.items = new File(root, "items");
            temp.mkdirs();
            items.mkdirs();
        }

        @Override
        public long usableSpaceBytes() { return Long.MAX_VALUE; }

        @Override
        public OutputStream openTemp(String tempName) throws IOException {
            return new FileOutputStream(new File(temp, tempName));
        }

        @Override
        public InputStream openTempInput(String tempName) throws IOException {
            return new FileInputStream(new File(temp, tempName));
        }

        @Override
        public File tempFile(String tempName) { return new File(temp, tempName); }

        @Override
        public boolean tempHasNonWhitespaceText(String tempName) { return true; }

        @Override
        public String moveTempToItem(String tempName, String id) throws IOException {
            return moveTempToItem(tempName, id, "txt", "txt");
        }

        @Override
        public String moveTempToItem(String tempName, String id, String format, String sourceExtension) throws IOException {
            File directory = new File(items, id);
            if (!directory.mkdirs() && !directory.isDirectory()) throw new IOException("item directory");
            String extension = sourceExtension == null ? format : sourceExtension;
            File source = new File(temp, tempName);
            File destination = new File(directory, "source." + extension);
            if (!source.renameTo(destination)) throw new IOException("move failed");
            return "items/" + id + "/source." + extension;
        }

        @Override
        public void deleteTemp(String tempName) { new File(temp, tempName).delete(); }

        @Override
        public void cleanupStaleTemps() { }

        @Override
        public String readUtf8(String relativePath) { return ""; }

        @Override
        public void deleteItemDirectory(String id) { deleteTree(new File(items, id)); }
    }
}
