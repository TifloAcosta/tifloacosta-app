package com.tifloacosta.app.reading;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.junit.Test;
import org.w3c.dom.Document;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

public class ReadingPackageExtractorTest {
    private static final class EntrySpec {
        final String name;
        final byte[] content;

        EntrySpec(String name, String content) {
            this(name, content.getBytes(StandardCharsets.UTF_8));
        }

        EntrySpec(String name, byte[] content) {
            this.name = name;
            this.content = content;
        }
    }

    private static byte[] zip(EntrySpec... entries) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(output)) {
            for (EntrySpec entry : entries) {
                zip.putNextEntry(new ZipEntry(entry.name));
                zip.write(entry.content);
                zip.closeEntry();
            }
        }
        return output.toByteArray();
    }

    private static File tempRoot() throws IOException {
        return Files.createTempDirectory("reading-package-test-").toFile();
    }

    private static void deleteTree(File file) {
        if (file == null || !file.exists()) return;
        File[] children = file.listFiles();
        if (children != null) {
            for (File child : children) deleteTree(child);
        }
        file.delete();
    }

    private static void assertEmpty(File directory) {
        File[] children = directory.listFiles();
        assertTrue(children == null || children.length == 0);
    }

    private static void expectPackageError(
            ReadingPackageExtractor extractor,
            byte[] archive,
            File root,
            List<String> required,
            String expectedCode
    ) throws Exception {
        try {
            extractor.extract(new ByteArrayInputStream(archive), root, required);
            fail("Expected package rejection: " + expectedCode);
        } catch (ReadingPackageExtractor.PackageException error) {
            assertEquals(expectedCode, error.getCode());
        }
        assertEmpty(root);
    }

    @Test
    public void extractsIntoUniqueChildOfCallerRootAndValidatesRequiredEntries() throws Exception {
        File root = tempRoot();
        try {
            ReadingPackageExtractor extractor = new ReadingPackageExtractor(
                    new ReadingPackageLimits(20, 8, 1024 * 1024)
            );
            byte[] archive = zip(
                    new EntrySpec("META-INF/container.xml", "<container/>") ,
                    new EntrySpec("OPS/content.xhtml", "<p>Hola</p>")
            );

            ReadingPackageExtractor.Extraction result = extractor.extract(
                    new ByteArrayInputStream(archive),
                    root,
                    Arrays.asList("META-INF/container.xml", "OPS/content.xhtml")
            );

            assertEquals(root.getCanonicalFile(), result.getRoot().getParentFile().getCanonicalFile());
            assertTrue(new File(result.getRoot(), "META-INF/container.xml").isFile());
            assertTrue(new File(result.getRoot(), "OPS/content.xhtml").isFile());
            assertEquals(Arrays.asList("META-INF/container.xml", "OPS/content.xhtml"), result.getEntries());
        } finally {
            deleteTree(root);
        }
    }

    @Test
    public void rejectsParentTraversalAndCleansPartialExtraction() throws Exception {
        File root = tempRoot();
        try {
            ReadingPackageExtractor extractor = new ReadingPackageExtractor();
            byte[] archive = zip(
                    new EntrySpec("safe/first.txt", "safe"),
                    new EntrySpec("../escape.txt", "escape")
            );
            expectPackageError(extractor, archive, root, Collections.emptyList(), "unsafe-path");
            assertFalse(new File(root.getParentFile(), "escape.txt").exists());
        } finally {
            deleteTree(root);
        }
    }

    @Test
    public void rejectsAbsoluteAndDriveLetterPaths() throws Exception {
        File root = tempRoot();
        try {
            ReadingPackageExtractor extractor = new ReadingPackageExtractor();
            expectPackageError(
                    extractor,
                    zip(new EntrySpec("/absolute.txt", "x")),
                    root,
                    Collections.emptyList(),
                    "unsafe-path"
            );
            expectPackageError(
                    extractor,
                    zip(new EntrySpec("C:\\outside.txt", "x")),
                    root,
                    Collections.emptyList(),
                    "unsafe-path"
            );
        } finally {
            deleteTree(root);
        }
    }

    @Test
    public void rejectsDuplicateNormalizedPaths() throws Exception {
        File root = tempRoot();
        try {
            ReadingPackageExtractor extractor = new ReadingPackageExtractor();
            byte[] archive = zip(
                    new EntrySpec("OPS/chapter.xhtml", "one"),
                    new EntrySpec("OPS\\chapter.xhtml", "two")
            );
            expectPackageError(extractor, archive, root, Collections.emptyList(), "duplicate-entry");
        } finally {
            deleteTree(root);
        }
    }

    @Test
    public void rejectsNestedArchivesAndCleansPreviouslyWrittenFiles() throws Exception {
        File root = tempRoot();
        try {
            ReadingPackageExtractor extractor = new ReadingPackageExtractor();
            byte[] nested = zip(new EntrySpec("inside.txt", "nested"));
            byte[] archive = zip(
                    new EntrySpec("OPS/chapter.xhtml", "ok"),
                    new EntrySpec("OPS/nested.zip", nested)
            );
            expectPackageError(extractor, archive, root, Collections.emptyList(), "nested-archive");
        } finally {
            deleteTree(root);
        }
    }

    @Test
    public void enforcesEntryDepthAndExpandedByteLimits() throws Exception {
        File root = tempRoot();
        try {
            ReadingPackageExtractor entryLimited = new ReadingPackageExtractor(
                    new ReadingPackageLimits(1, 8, 1024)
            );
            expectPackageError(
                    entryLimited,
                    zip(new EntrySpec("one.txt", "1"), new EntrySpec("two.txt", "2")),
                    root,
                    Collections.emptyList(),
                    "too-many-entries"
            );

            ReadingPackageExtractor depthLimited = new ReadingPackageExtractor(
                    new ReadingPackageLimits(10, 2, 1024)
            );
            expectPackageError(
                    depthLimited,
                    zip(new EntrySpec("a/b/c.txt", "x")),
                    root,
                    Collections.emptyList(),
                    "too-deep"
            );

            ReadingPackageExtractor byteLimited = new ReadingPackageExtractor(
                    new ReadingPackageLimits(10, 8, 4)
            );
            expectPackageError(
                    byteLimited,
                    zip(new EntrySpec("large.txt", "12345")),
                    root,
                    Collections.emptyList(),
                    "too-large"
            );
        } finally {
            deleteTree(root);
        }
    }

    @Test
    public void missingRequiredEntryRejectsWholePackageAndCleansExtraction() throws Exception {
        File root = tempRoot();
        try {
            ReadingPackageExtractor extractor = new ReadingPackageExtractor();
            expectPackageError(
                    extractor,
                    zip(new EntrySpec("OPS/content.xhtml", "<p>Hola</p>")),
                    root,
                    Collections.singletonList("META-INF/container.xml"),
                    "missing-required-entry"
            );
        } finally {
            deleteTree(root);
        }
    }

    @Test
    public void safeXmlParserRejectsDoctypeAndExternalEntities() throws Exception {
        String hostile = "<?xml version=\"1.0\"?>"
                + "<!DOCTYPE doc [<!ENTITY xxe SYSTEM \"file:///etc/passwd\">]>"
                + "<doc>&xxe;</doc>";
        try {
            ReadingXml.parse(new ByteArrayInputStream(hostile.getBytes(StandardCharsets.UTF_8)));
            fail("DOCTYPE/XXE input must be rejected");
        } catch (IOException expected) {
            assertTrue(expected.getMessage().contains("invalid-xml"));
        }

        Document safe = ReadingXml.parse(new ByteArrayInputStream(
                "<root><item> Texto seguro </item></root>".getBytes(StandardCharsets.UTF_8)
        ));
        assertEquals("Texto seguro", ReadingXml.normalizedText(safe.getDocumentElement()));
    }

    @Test
    public void structuredDocumentDefensivelyCopiesSemanticCollections() {
        List<ReadingStructuredDocument.Block> blocks = new ArrayList<>();
        blocks.add(new ReadingStructuredDocument.Block(
                "b1", "heading", "Capítulo", 1, "chapter.xhtml#h1"
        ));
        List<ReadingStructuredDocument.NavigationItem> navigation = new ArrayList<>();
        navigation.add(new ReadingStructuredDocument.NavigationItem(
                "Capítulo", "chapter.xhtml#h1", 1
        ));
        List<ReadingStructuredDocument.PageReference> pages = new ArrayList<>();
        pages.add(new ReadingStructuredDocument.PageReference("1", "chapter.xhtml#p1"));
        List<ReadingStructuredDocument.MediaSyncReference> sync = new ArrayList<>();
        sync.add(new ReadingStructuredDocument.MediaSyncReference(
                "chapter.xhtml#p1", "audio/ch1.mp3", 1000L, 2500L
        ));

        ReadingStructuredDocument document = new ReadingStructuredDocument(
                "Libro", "Autora", "es", blocks, navigation, pages, sync
        );
        blocks.clear();
        navigation.clear();
        pages.clear();
        sync.clear();

        assertEquals("Libro", document.getTitle());
        assertEquals("Autora", document.getAuthor());
        assertEquals("es", document.getLanguage());
        assertEquals(1, document.getBlocks().size());
        assertEquals(1, document.getNavigation().size());
        assertEquals(1, document.getPageReferences().size());
        assertEquals(1, document.getMediaSyncReferences().size());

        try {
            document.getBlocks().clear();
            fail("Structured document blocks must be immutable");
        } catch (UnsupportedOperationException expected) {
            // Expected: callers cannot mutate parsed package structure.
        }
    }
}
