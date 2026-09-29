package com.tifloacosta.app.reading;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;

import org.junit.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

public class ReadingEpubNoteNavigationTest {
    @Test
    public void noteInsideAsideKeepsTheTargetUsedByItsSourceLink() throws Exception {
        File root = Files.createTempDirectory("reading-epub-note-").toFile();
        try {
            ReadingStructuredDocument document = new ReadingEpubAdapter().read(
                    new ByteArrayInputStream(epub()),
                    root
            );

            ReadingStructuredDocument.Block source = findBlock(document, "Texto con nota");
            ReadingStructuredDocument.Block note = findBlock(document, "Contenido de la nota");

            assertNotNull(source);
            assertNotNull(note);
            assertEquals(1, source.getLinks().size());
            assertEquals("OPS/chapter.xhtml#note", source.getLinks().get(0).getHref());
            assertEquals("OPS/chapter.xhtml#note", note.getHref());
        } finally {
            deleteTree(root);
        }
    }

    private static byte[] epub() throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(output)) {
            entry(zip, "mimetype", "application/epub+zip");
            entry(zip, "META-INF/container.xml",
                    "<?xml version=\"1.0\"?>"
                            + "<container xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\" version=\"1.0\">"
                            + "<rootfiles><rootfile full-path=\"OPS/package.opf\" media-type=\"application/oebps-package+xml\"/>"
                            + "</rootfiles></container>");
            entry(zip, "OPS/package.opf",
                    "<?xml version=\"1.0\"?>"
                            + "<package xmlns=\"http://www.idpf.org/2007/opf\" version=\"3.0\">"
                            + "<metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\"><dc:title>Notas</dc:title></metadata>"
                            + "<manifest><item id=\"c1\" href=\"chapter.xhtml\" media-type=\"application/xhtml+xml\"/></manifest>"
                            + "<spine><itemref idref=\"c1\"/></spine></package>");
            entry(zip, "OPS/chapter.xhtml",
                    "<?xml version=\"1.0\"?><html xmlns=\"http://www.w3.org/1999/xhtml\"><body>"
                            + "<p id=\"source\">Texto con <a href=\"#note\">nota</a></p>"
                            + "<aside id=\"note\"><p>Contenido de la nota</p></aside>"
                            + "</body></html>");
        }
        return output.toByteArray();
    }

    private static void entry(ZipOutputStream zip, String name, String content) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    private static ReadingStructuredDocument.Block findBlock(ReadingStructuredDocument document, String text) {
        for (ReadingStructuredDocument.Block block : document.getBlocks()) {
            if (text.equals(block.getText())) return block;
        }
        return null;
    }

    private static void deleteTree(File file) {
        if (file == null || !file.exists()) return;
        File[] children = file.listFiles();
        if (children != null) {
            for (File child : children) deleteTree(child);
        }
        file.delete();
    }
}
