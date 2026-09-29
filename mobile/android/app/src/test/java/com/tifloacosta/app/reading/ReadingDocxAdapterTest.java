package com.tifloacosta.app.reading;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.junit.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

public class ReadingDocxAdapterTest {
    private static final class Entry {
        final String name;
        final String content;

        Entry(String name, String content) {
            this.name = name;
            this.content = content;
        }
    }

    private static byte[] docx(Entry... entries) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(output)) {
            for (Entry entry : entries) {
                zip.putNextEntry(new ZipEntry(entry.name));
                zip.write(entry.content.getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
        }
        return output.toByteArray();
    }

    private static File tempRoot() throws IOException {
        return Files.createTempDirectory("reading-docx-test-").toFile();
    }

    private static void deleteTree(File file) {
        if (file == null || !file.exists()) return;
        File[] children = file.listFiles();
        if (children != null) {
            for (File child : children) deleteTree(child);
        }
        file.delete();
    }

    private static Entry contentTypes(boolean macroEnabled) {
        String mainType = macroEnabled
                ? "application/vnd.ms-word.document.macroEnabled.main+xml"
                : "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";
        return new Entry(
                "[Content_Types].xml",
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                        + "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">"
                        + "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>"
                        + "<Default Extension=\"xml\" ContentType=\"application/xml\"/>"
                        + "<Override PartName=\"/word/document.xml\" ContentType=\"" + mainType + "\"/>"
                        + "<Override PartName=\"/word/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml\"/>"
                        + "<Override PartName=\"/word/numbering.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml\"/>"
                        + "<Override PartName=\"/word/footnotes.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml\"/>"
                        + "<Override PartName=\"/word/endnotes.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml\"/>"
                        + "<Override PartName=\"/docProps/core.xml\" ContentType=\"application/vnd.openxmlformats-package.core-properties+xml\"/>"
                        + "</Types>"
        );
    }

    private static Entry rootRelationships() {
        return new Entry(
                "_rels/.rels",
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                        + "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
                        + "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/>"
                        + "<Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties\" Target=\"docProps/core.xml\"/>"
                        + "</Relationships>"
        );
    }

    private static Entry documentRelationships() {
        return new Entry(
                "word/_rels/document.xml.rels",
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                        + "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
                        + "<Relationship Id=\"rIdLink\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink\" Target=\"https://example.com/info\" TargetMode=\"External\"/>"
                        + "<Relationship Id=\"rIdStyles\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>"
                        + "<Relationship Id=\"rIdNumbering\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering\" Target=\"numbering.xml\"/>"
                        + "<Relationship Id=\"rIdFootnotes\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes\" Target=\"footnotes.xml\"/>"
                        + "<Relationship Id=\"rIdEndnotes\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/endnotes\" Target=\"endnotes.xml\"/>"
                        + "</Relationships>"
        );
    }

    private static Entry styles() {
        return new Entry(
                "word/styles.xml",
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                        + "<w:styles xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">"
                        + "<w:docDefaults><w:rPrDefault><w:rPr><w:lang w:val=\"es-ES\"/></w:rPr></w:rPrDefault></w:docDefaults>"
                        + "<w:style w:type=\"paragraph\" w:styleId=\"Heading1\"><w:name w:val=\"heading 1\"/></w:style>"
                        + "</w:styles>"
        );
    }

    private static Entry numbering() {
        return new Entry(
                "word/numbering.xml",
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                        + "<w:numbering xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">"
                        + "<w:abstractNum w:abstractNumId=\"7\"><w:lvl w:ilvl=\"0\"><w:numFmt w:val=\"bullet\"/><w:lvlText w:val=\"•\"/></w:lvl></w:abstractNum>"
                        + "<w:num w:numId=\"3\"><w:abstractNumId w:val=\"7\"/></w:num>"
                        + "</w:numbering>"
        );
    }

    private static Entry coreProperties() {
        return new Entry(
                "docProps/core.xml",
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                        + "<cp:coreProperties xmlns:cp=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\" "
                        + "xmlns:dc=\"http://purl.org/dc/elements/1.1/\">"
                        + "<dc:title>Documento accesible</dc:title><dc:creator>Autor de prueba</dc:creator><dc:language>es</dc:language>"
                        + "</cp:coreProperties>"
        );
    }

    private static Entry document() {
        return new Entry(
                "word/document.xml",
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                        + "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\" "
                        + "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" "
                        + "xmlns:wp=\"http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing\">"
                        + "<w:body>"
                        + "<w:p><w:pPr><w:pStyle w:val=\"Heading1\"/></w:pPr><w:r><w:t>Título uno</w:t></w:r></w:p>"
                        + "<w:p><w:pPr><w:numPr><w:ilvl w:val=\"0\"/><w:numId w:val=\"3\"/></w:numPr></w:pPr><w:r><w:t>Elemento de lista</w:t></w:r></w:p>"
                        + "<w:p><w:hyperlink r:id=\"rIdLink\"><w:r><w:t>Enlace externo</w:t></w:r></w:hyperlink>"
                        + "<w:r><w:t xml:space=\"preserve\"> y </w:t></w:r>"
                        + "<w:hyperlink w:anchor=\"seccion2\"><w:r><w:t>enlace interno</w:t></w:r></w:hyperlink></w:p>"
                        + "<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Celda accesible</w:t></w:r></w:p></w:tc></w:tr></w:tbl>"
                        + "<w:p><w:r><w:drawing><wp:inline><wp:docPr id=\"1\" name=\"Imagen 1\" descr=\"Portada accesible\"/></wp:inline></w:drawing></w:r></w:p>"
                        + "<w:p><w:r><w:t xml:space=\"preserve\">Cambio: </w:t></w:r>"
                        + "<w:ins><w:r><w:t>texto insertado</w:t></w:r></w:ins>"
                        + "<w:del><w:r><w:delText>texto eliminado</w:delText></w:r></w:del></w:p>"
                        + "<w:p><w:r><w:t>Con nota</w:t></w:r><w:r><w:footnoteReference w:id=\"2\"/></w:r>"
                        + "<w:r><w:endnoteReference w:id=\"3\"/></w:r></w:p>"
                        + "<w:p><w:bookmarkStart w:id=\"0\" w:name=\"seccion2\"/><w:r><w:t>Sección dos</w:t></w:r></w:p>"
                        + "</w:body></w:document>"
        );
    }

    private static Entry footnotes() {
        return new Entry(
                "word/footnotes.xml",
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                        + "<w:footnotes xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">"
                        + "<w:footnote w:id=\"-1\"><w:p><w:r><w:t>Separador</w:t></w:r></w:p></w:footnote>"
                        + "<w:footnote w:id=\"2\"><w:p><w:r><w:t>Texto del pie de página</w:t></w:r></w:p></w:footnote>"
                        + "</w:footnotes>"
        );
    }

    private static Entry endnotes() {
        return new Entry(
                "word/endnotes.xml",
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                        + "<w:endnotes xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">"
                        + "<w:endnote w:id=\"3\"><w:p><w:r><w:t>Texto de la nota final</w:t></w:r></w:p></w:endnote>"
                        + "</w:endnotes>"
        );
    }

    @Test
    public void readsSemanticContentMetadataRelationshipsNotesAltTextAndTrackedChanges() throws Exception {
        File root = tempRoot();
        try {
            byte[] bytes = docx(
                    contentTypes(false),
                    rootRelationships(),
                    documentRelationships(),
                    coreProperties(),
                    styles(),
                    numbering(),
                    document(),
                    footnotes(),
                    endnotes()
            );

            ReadingStructuredDocument result = new ReadingDocxAdapter().read(
                    new ByteArrayInputStream(bytes),
                    root
            );

            assertEquals("Documento accesible", result.getTitle());
            assertEquals("Autor de prueba", result.getAuthor());
            assertEquals("es", result.getLanguage());

            ReadingStructuredDocument.Block heading = findBlock(result, "Título uno");
            assertNotNull(heading);
            assertEquals("heading", heading.getType());
            assertEquals(1, heading.getLevel());

            ReadingStructuredDocument.Block listItem = findBlock(result, "Elemento de lista");
            assertNotNull(listItem);
            assertEquals("list-item", listItem.getType());

            ReadingStructuredDocument.Block tableCell = findBlock(result, "Celda accesible");
            assertNotNull(tableCell);
            assertEquals("table-cell", tableCell.getType());

            ReadingStructuredDocument.Block linkBlock = findBlockContaining(result, "Enlace externo");
            assertNotNull(linkBlock);
            assertEquals(2, linkBlock.getLinks().size());
            assertEquals("https://example.com/info", linkBlock.getLinks().get(0).getHref());
            assertTrue(linkBlock.getLinks().get(0).isExternal());
            assertEquals("#seccion2", linkBlock.getLinks().get(1).getHref());
            assertFalse(linkBlock.getLinks().get(1).isExternal());

            assertNotNull(findBlock(result, "Portada accesible"));

            ReadingStructuredDocument.Block tracked = findBlockContaining(result, "Cambio:");
            assertNotNull(tracked);
            assertTrue(tracked.getText().contains("texto insertado"));
            assertFalse(tracked.getText().contains("texto eliminado"));

            assertNotNull(findBlock(result, "Texto del pie de página"));
            assertNotNull(findBlock(result, "Texto de la nota final"));
        } finally {
            deleteTree(root);
        }
    }

    @Test
    public void rejectsMacroEnabledDocuments() throws Exception {
        File root = tempRoot();
        try {
            byte[] bytes = docx(
                    contentTypes(true),
                    rootRelationships(),
                    documentRelationships(),
                    document()
            );
            try {
                new ReadingDocxAdapter().read(new ByteArrayInputStream(bytes), root);
                fail("Expected macro-enabled DOCX rejection");
            } catch (ReadingDocxAdapter.DocxException error) {
                assertEquals("macro-enabled-docx", error.getCode());
            }
        } finally {
            deleteTree(root);
        }
    }

    @Test
    public void rejectsPackageWithoutOfficeDocumentRelationship() throws Exception {
        File root = tempRoot();
        try {
            byte[] bytes = docx(
                    contentTypes(false),
                    new Entry(
                            "_rels/.rels",
                            "<?xml version=\"1.0\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"/>"
                    ),
                    document()
            );
            try {
                new ReadingDocxAdapter().read(new ByteArrayInputStream(bytes), root);
                fail("Expected malformed DOCX rejection");
            } catch (ReadingDocxAdapter.DocxException error) {
                assertEquals("invalid-docx", error.getCode());
            }
        } finally {
            deleteTree(root);
        }
    }

    private static ReadingStructuredDocument.Block findBlock(ReadingStructuredDocument document, String text) {
        for (ReadingStructuredDocument.Block block : document.getBlocks()) {
            if (text.equals(block.getText())) return block;
        }
        return null;
    }

    private static ReadingStructuredDocument.Block findBlockContaining(ReadingStructuredDocument document, String text) {
        for (ReadingStructuredDocument.Block block : document.getBlocks()) {
            if (block.getText().contains(text)) return block;
        }
        return null;
    }
}
