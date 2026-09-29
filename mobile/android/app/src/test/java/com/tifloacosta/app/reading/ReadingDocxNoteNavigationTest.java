package com.tifloacosta.app.reading;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
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

public class ReadingDocxNoteNavigationTest {
    @Test
    public void footnoteKeepsSourceLinkAndStableTarget() throws Exception {
        File root = Files.createTempDirectory("reading-docx-note-").toFile();
        try {
            ReadingStructuredDocument document = new ReadingDocxAdapter().read(
                    new ByteArrayInputStream(docx()),
                    root
            );

            ReadingStructuredDocument.Block source = findBlock(document, "Con nota");
            ReadingStructuredDocument.Block note = findBlock(document, "Texto de la nota");

            assertNotNull(source);
            assertNotNull(note);
            assertEquals(1, source.getLinks().size());
            assertEquals("#footnote-2", source.getLinks().get(0).getHref());
            assertFalse(source.getLinks().get(0).isExternal());
            assertEquals("#footnote-2", note.getHref());
        } finally {
            deleteTree(root);
        }
    }

    private static byte[] docx() throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(output)) {
            entry(zip, "[Content_Types].xml",
                    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                            + "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">"
                            + "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>"
                            + "<Default Extension=\"xml\" ContentType=\"application/xml\"/>"
                            + "<Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>"
                            + "<Override PartName=\"/word/footnotes.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml\"/>"
                            + "</Types>");
            entry(zip, "_rels/.rels",
                    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                            + "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
                            + "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/>"
                            + "</Relationships>");
            entry(zip, "word/document.xml",
                    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                            + "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">"
                            + "<w:body><w:p><w:r><w:t>Con nota</w:t></w:r>"
                            + "<w:r><w:footnoteReference w:id=\"2\"/></w:r></w:p></w:body></w:document>");
            entry(zip, "word/footnotes.xml",
                    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                            + "<w:footnotes xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">"
                            + "<w:footnote w:id=\"2\"><w:p><w:r><w:t>Texto de la nota</w:t></w:r></w:p></w:footnote>"
                            + "</w:footnotes>");
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
