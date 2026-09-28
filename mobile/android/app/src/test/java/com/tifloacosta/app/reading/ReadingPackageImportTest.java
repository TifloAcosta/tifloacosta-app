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

public class ReadingPackageImportTest {
    @Test
    public void importsDaisyZipAsOneDaisyBookAndKeepsThePackagePrivate() throws Exception {
        File root = Files.createTempDirectory("reading-zip-daisy-").toFile();
        try {
            FakeRepository repository = new FakeRepository();
            DiskFileStore store = new DiskFileStore(root);
            ReadingImportService service = new ReadingImportService(repository, store, () -> 1234L);

            ReadingImportResult result = service.importOne(
                    new ReadingImportSource("libro.zip", "application/zip", null),
                    new ByteArrayInputStream(daisyTextZip())
            );

            assertTrue(result.isImported());
            ReadingBookRecord record = repository.findById(result.getBookId());
            assertNotNull(record);
            assertEquals("daisy2.02", record.getFormat());
            assertEquals("DAISY ZIP", record.getTitle());
            assertEquals("Autora", record.getAuthor());
            assertEquals("es", record.getLanguage());
            assertEquals("application/zip", record.getMimeType());
            assertTrue(record.getRelativePath().endsWith("/source.zip"));
        } finally {
            deleteTree(root);
        }
    }

    @Test
    public void importsCoherentAudioZipAsOneBookWithOrderedTracks() throws Exception {
        File root = Files.createTempDirectory("reading-zip-audio-").toFile();
        try {
            FakeRepository repository = new FakeRepository();
            DiskFileStore store = new DiskFileStore(root);
            ReadingAudioProbe probe = file -> ReadingAudioProbe.Result.readable(60_000L, null, null, null);
            ReadingImportService service = new ReadingImportService(repository, store, () -> 1234L, null, probe);

            ReadingImportResult result = service.importOne(
                    new ReadingImportSource("audiolibro.zip", "application/zip", null),
                    new ByteArrayInputStream(zip(
                            entry("02-final.mp3", "audio-two"),
                            entry("01-inicio.mp3", "audio-one")
                    ))
            );

            assertTrue(result.isImported());
            ReadingBookRecord record = repository.findById(result.getBookId());
            assertNotNull(record);
            assertEquals("audio", record.getFormat());
            List<ReadingAudioTrackRecord> tracks = repository.listAudioTracks(record.getId());
            assertEquals(2, tracks.size());
            assertEquals("01-inicio.mp3", tracks.get(0).getOriginalName());
            assertEquals("02-final.mp3", tracks.get(1).getOriginalName());
            assertTrue(tracks.get(0).getRelativePath().endsWith("track-0000.mp3"));
            assertTrue(tracks.get(1).getRelativePath().endsWith("track-0001.mp3"));
        } finally {
            deleteTree(root);
        }
    }

    @Test
    public void rejectsAmbiguousMixedZipWithoutVisibleBook() throws Exception {
        File root = Files.createTempDirectory("reading-zip-mixed-").toFile();
        try {
            FakeRepository repository = new FakeRepository();
            DiskFileStore store = new DiskFileStore(root);
            ReadingAudioProbe probe = file -> ReadingAudioProbe.Result.readable(10_000L, null, null, null);
            ReadingImportService service = new ReadingImportService(repository, store, () -> 1234L, null, probe);

            ReadingImportResult result = service.importOne(
                    new ReadingImportSource("mezcla.zip", "application/zip", null),
                    new ByteArrayInputStream(zip(
                            entry("01.mp3", "audio"),
                            entry("notas.txt", "no pertenece al audiolibro")
                    ))
            );

            assertTrue(result.isRejected());
            assertEquals("ambiguous-zip", result.getReason());
            assertTrue(repository.records.isEmpty());
        } finally {
            deleteTree(root);
        }
    }

    @Test
    public void rejectsRecursiveZipWithoutVisibleBook() throws Exception {
        File root = Files.createTempDirectory("reading-zip-recursive-").toFile();
        try {
            FakeRepository repository = new FakeRepository();
            DiskFileStore store = new DiskFileStore(root);
            ReadingImportService service = new ReadingImportService(repository, store, () -> 1234L);
            byte[] nested = zip(entry("inside.txt", "nested"));

            ReadingImportResult result = service.importOne(
                    new ReadingImportSource("recursivo.zip", "application/zip", null),
                    new ByteArrayInputStream(zip(new Entry("nested.zip", nested)))
            );

            assertTrue(result.isRejected());
            assertEquals("nested-archive", result.getReason());
            assertTrue(repository.records.isEmpty());
        } finally {
            deleteTree(root);
        }
    }

    private static byte[] daisyTextZip() throws IOException {
        return zip(
                entry("ncc.html",
                        "<?xml version=\"1.0\"?><html xmlns=\"http://www.w3.org/1999/xhtml\"><head>"
                                + "<meta name=\"dc:title\" content=\"DAISY ZIP\"/>"
                                + "<meta name=\"dc:creator\" content=\"Autora\"/>"
                                + "<meta name=\"dc:language\" content=\"es\"/>"
                                + "</head><body><h1><a href=\"chapter.smil#n1\">Capítulo</a></h1></body></html>"),
                entry("chapter.smil",
                        "<?xml version=\"1.0\"?><smil xmlns=\"http://www.w3.org/2001/SMIL20/\"><body><seq>"
                                + "<par id=\"n1\"><text src=\"content.xhtml#p1\"/></par>"
                                + "</seq></body></smil>"),
                entry("content.xhtml",
                        "<?xml version=\"1.0\"?><html xmlns=\"http://www.w3.org/1999/xhtml\"><body>"
                                + "<h1>Capítulo</h1><p id=\"p1\">Contenido.</p></body></html>")
        );
    }

    private static Entry entry(String name, String text) {
        return new Entry(name, text.getBytes(StandardCharsets.UTF_8));
    }

    private static byte[] zip(Entry... entries) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(output)) {
            for (Entry entry : entries) {
                zip.putNextEntry(new ZipEntry(entry.name));
                zip.write(entry.bytes);
                zip.closeEntry();
            }
        }
        return output.toByteArray();
    }

    private static void deleteTree(File file) {
        if (file == null || !file.exists()) return;
        File[] children = file.listFiles();
        if (children != null) for (File child : children) deleteTree(child);
        file.delete();
    }

    private static final class Entry {
        final String name;
        final byte[] bytes;
        Entry(String name, byte[] bytes) {
            this.name = name;
            this.bytes = bytes;
        }
    }

    private static final class FakeRepository implements ReadingBookRepository {
        final Map<String, ReadingBookRecord> records = new HashMap<>();
        final Map<String, List<ReadingAudioTrackRecord>> tracks = new HashMap<>();

        @Override public ReadingBookRecord findById(String id) { return records.get(id); }
        @Override public ReadingBookRecord findBySha256(String sha256) {
            for (ReadingBookRecord record : records.values()) if (sha256.equals(record.getSha256())) return record;
            return null;
        }
        @Override public List<ReadingBookRecord> list(ReadingBookQuery query) { return new ArrayList<>(records.values()); }
        @Override public int count(ReadingBookQuery query) { return records.size(); }
        @Override public ReadingBookRecord latestInProgress() { return null; }
        @Override public void insert(ReadingBookRecord record) { records.put(record.getId(), record); }
        @Override public void updateProgress(String id, int blockIndex, double percent, String state, long lastReadAt) { }
        @Override public void insertAudioTracks(String bookId, List<ReadingAudioTrackRecord> values) {
            tracks.put(bookId, new ArrayList<>(values));
        }
        @Override public List<ReadingAudioTrackRecord> listAudioTracks(String bookId) {
            List<ReadingAudioTrackRecord> values = tracks.get(bookId);
            return values == null ? new ArrayList<>() : new ArrayList<>(values);
        }
        @Override public void delete(String id) {
            records.remove(id);
            tracks.remove(id);
        }
    }

    private static final class DiskFileStore implements ReadingFileStore {
        final File root;
        final File temp;
        final File items;

        DiskFileStore(File root) {
            this.root = root;
            temp = new File(root, "tmp");
            items = new File(root, "items");
            temp.mkdirs();
            items.mkdirs();
        }

        @Override public long usableSpaceBytes() { return Long.MAX_VALUE; }
        @Override public OutputStream openTemp(String tempName) throws IOException {
            return new FileOutputStream(new File(temp, tempName));
        }
        @Override public InputStream openTempInput(String tempName) throws IOException {
            return new FileInputStream(new File(temp, tempName));
        }
        @Override public File tempFile(String tempName) { return new File(temp, tempName); }
        @Override public boolean tempHasNonWhitespaceText(String tempName) { return true; }
        @Override public String moveTempToItem(String tempName, String id) throws IOException {
            return moveTempToItem(tempName, id, "txt", "txt");
        }
        @Override public String moveTempToItem(String tempName, String id, String format, String sourceExtension) throws IOException {
            File directory = new File(items, id);
            if (!directory.mkdirs() && !directory.isDirectory()) throw new IOException("item directory");
            String extension = sourceExtension == null ? format : sourceExtension;
            File source = new File(temp, tempName);
            File destination = new File(directory, "source." + extension);
            if (!source.renameTo(destination)) throw new IOException("move failed");
            return "items/" + id + "/source." + extension;
        }
        @Override public String moveTempToAudioTrack(String tempName, String id, int trackIndex, String sourceExtension) throws IOException {
            File directory = new File(items, id);
            if (!directory.mkdirs() && !directory.isDirectory()) throw new IOException("item directory");
            File source = new File(temp, tempName);
            String extension = sourceExtension == null ? "mp3" : sourceExtension;
            String name = String.format(Locale.ROOT, "track-%04d.%s", trackIndex, extension);
            File destination = new File(directory, name);
            if (!source.renameTo(destination)) throw new IOException("move failed");
            return "items/" + id + "/" + name;
        }
        @Override public void deleteTemp(String tempName) { new File(temp, tempName).delete(); }
        @Override public void cleanupStaleTemps() { }
        @Override public String readUtf8(String relativePath) { return ""; }
        @Override public void deleteItemDirectory(String id) { deleteTree(new File(items, id)); }
    }
}
