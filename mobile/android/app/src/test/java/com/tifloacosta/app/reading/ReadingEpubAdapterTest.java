package com.tifloacosta.app.reading;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.junit.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

public class ReadingEpubAdapterTest {
    private static final class EntrySpec {
        final String name;
        final String content;

        EntrySpec(String name, String content) {
            this.name = name;
            this.content = content;
        }
    }

    private static byte[] epub(EntrySpec... entries) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(output)) {
            for (EntrySpec entry : entries) {
                zip.putNextEntry(new ZipEntry(entry.name));
                zip.write(entry.content.getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
        }
        return output.toByteArray();
    }

    private static File tempRoot() throws IOException {
        return Files.createTempDirectory("reading-epub-test-").toFile();
    }

    private static void deleteTree(File file) {
        if (file == null || !file.exists()) return;
        File[] children = file.listFiles();
        if (children != null) {
            for (File child : children) deleteTree(child);
        }
        file.delete();
    }

    private static EntrySpec container(String opfPath) {
        return new EntrySpec(
                "META-INF/container.xml",
                "<?xml version=\"1.0\"?>"
                        + "<container xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\" version=\"1.0\">"
                        + "<rootfiles><rootfile full-path=\"" + opfPath + "\" media-type=\"application/oebps-package+xml\"/>"
                        + "</rootfiles></container>"
        );
    }

    private static EntrySpec packageOpf() {
        return new EntrySpec(
                "OPS/package.opf",
                "<?xml version=\"1.0\"?>"
                        + "<package xmlns=\"http://www.idpf.org/2007/opf\" version=\"3.0\" unique-identifier=\"bookid\">"
                        + "<metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\">"
                        + "<dc:identifier id=\"bookid\">urn:test</dc:identifier>"
                        + "<dc:title>Libro EPUB</dc:title><dc:creator>Ana Ejemplo</dc:creator><dc:language>es</dc:language>"
                        + "</metadata>"
                        + "<manifest>"
                        + "<item id=\"nav\" href=\"nav.xhtml\" media-type=\"application/xhtml+xml\" properties=\"nav\"/>"
                        + "<item id=\"c1\" href=\"chapter1.xhtml\" media-type=\"application/xhtml+xml\" media-overlay=\"sm1\"/>"
                        + "<item id=\"c2\" href=\"chapter2.xhtml\" media-type=\"application/xhtml+xml\"/>"
                        + "<item id=\"sm1\" href=\"overlay.smil\" media-type=\"application/smil+xml\"/>"
                        + "</manifest>"
                        + "<spine><itemref idref=\"c2\"/><itemref idref=\"c1\"/></spine>"
                        + "</package>"
        );
    }

    private static byte[] validBook() throws IOException {
        return epub(
                new EntrySpec("mimetype", "application/epub+zip"),
                container("OPS/package.opf"),
                packageOpf(),
                new EntrySpec(
                        "OPS/chapter1.xhtml",
                        "<?xml version=\"1.0\"?><html xmlns=\"http://www.w3.org/1999/xhtml\"><body>"
                                + "<h1 id=\"h1\">Primero en archivo</h1>"
                                + "<p id=\"p1\">Texto con <a href=\"#note\">nota interna</a> y "
                                + "<a href=\"https://example.com/recurso\">enlace externo</a>.</p>"
                                + "<ul><li>Elemento de lista</li></ul>"
                                + "<table><tr><td>Celda accesible</td></tr></table>"
                                + "<p><img src=\"cover.jpg\" alt=\"Descripción de portada\"/></p>"
                                + "<p><img src=\"decorative.jpg\"/></p>"
                                + "<aside id=\"note\"><p>Contenido de la nota</p></aside>"
                                + "<script>window.evil = true;</script>"
                                + "</body></html>"
                ),
                new EntrySpec(
                        "OPS/chapter2.xhtml",
                        "<?xml version=\"1.0\"?><html xmlns=\"http://www.w3.org/1999/xhtml\"><body>"
                                + "<h2 id=\"h2\">Primero en lectura</h2><p>Capítulo dos.</p>"
                                + "</body></html>"
                ),
                new EntrySpec(
                        "OPS/nav.xhtml",
                        "<?xml version=\"1.0\"?><html xmlns=\"http://www.w3.org/1999/xhtml\" "
                                + "xmlns:epub=\"http://www.idpf.org/2007/ops\"><body>"
                                + "<nav epub:type=\"toc\"><ol><li><a href=\"chapter2.xhtml#h2\">Capítulo 2</a></li>"
                                + "<li><a href=\"chapter1.xhtml#h1\">Capítulo 1</a></li></ol></nav>"
                                + "<nav epub:type=\"page-list\"><ol><li><a href=\"chapter1.xhtml#p1\">7</a></li></ol></nav>"
                                + "</body></html>"
                ),
                new EntrySpec(
                        "OPS/overlay.smil",
                        "<?xml version=\"1.0\"?><smil xmlns=\"http://www.w3.org/ns/SMIL\"><body><seq>"
                                + "<par><text src=\"chapter1.xhtml#p1\"/><audio src=\"audio/ch1.mp3\" "
                                + "clipBegin=\"1.5s\" clipEnd=\"3.25s\"/></par>"
                                + "</seq></body></smil>"
                )
        );
    }

    @Test
    public void parsesMetadataSpineOrderSemanticBlocksNavigationPagesAndOverlay() throws Exception {
        File root = tempRoot();
        try {
            ReadingEpubAdapter adapter = new ReadingEpubAdapter();
            ReadingStructuredDocument document = adapter.read(
                    new ByteArrayInputStream(validBook()), root
            );

            assertEquals("Libro EPUB", document.getTitle());
            assertEquals("Ana Ejemplo", document.getAuthor());
            assertEquals("es", document.getLanguage());

            List<ReadingStructuredDocument.Block> blocks = document.getBlocks();
            assertEquals("Primero en lectura", blocks.get(0).getText());
            assertEquals("heading", blocks.get(0).getType());
            assertEquals(2, blocks.get(0).getLevel());
            assertTrue(blocks.stream().anyMatch(block -> "list-item".equals(block.getType()) && "Elemento de lista".equals(block.getText())));
            assertTrue(blocks.stream().anyMatch(block -> "table-cell".equals(block.getType()) && "Celda accesible".equals(block.getText())));
            assertTrue(blocks.stream().anyMatch(block -> block.getText().contains("nota interna") && block.getText().contains("enlace externo")));
            assertTrue(blocks.stream().anyMatch(block -> block.getText().contains("Descripción de portada")));
            assertTrue(blocks.stream().anyMatch(block -> block.getText().contains("Contenido de la nota")));
            assertTrue(blocks.stream().noneMatch(block -> block.getText().contains("window.evil")));

            assertEquals(2, document.getNavigation().size());
            assertEquals("Capítulo 2", document.getNavigation().get(0).getLabel());
            assertEquals("OPS/chapter2.xhtml#h2", document.getNavigation().get(0).getHref());
            assertEquals(1, document.getPageReferences().size());
            assertEquals("7", document.getPageReferences().get(0).getLabel());
            assertEquals("OPS/chapter1.xhtml#p1", document.getPageReferences().get(0).getHref());
            assertEquals(1, document.getMediaSyncReferences().size());
            assertEquals("OPS/chapter1.xhtml#p1", document.getMediaSyncReferences().get(0).getTextHref());
            assertEquals("OPS/audio/ch1.mp3", document.getMediaSyncReferences().get(0).getAudioHref());
            assertEquals(1500L, document.getMediaSyncReferences().get(0).getClipBeginMs());
            assertEquals(3250L, document.getMediaSyncReferences().get(0).getClipEndMs());
        } finally {
            deleteTree(root);
        }
    }

    @Test
    public void missingImageAltDoesNotInventReadableText() throws Exception {
        File root = tempRoot();
        try {
            ReadingEpubAdapter adapter = new ReadingEpubAdapter();
            ReadingStructuredDocument document = adapter.read(
                    new ByteArrayInputStream(validBook()), root
            );
            assertTrue(document.getBlocks().stream().noneMatch(block -> block.getText().contains("decorative.jpg")));
        } finally {
            deleteTree(root);
        }
    }

    @Test
    public void rejectsInvalidPackageAndProtectedEpub() throws Exception {
        File root = tempRoot();
        try {
            ReadingEpubAdapter adapter = new ReadingEpubAdapter();
            try {
                adapter.read(new ByteArrayInputStream(epub(
                        new EntrySpec("OPS/chapter.xhtml", "<html xmlns=\"http://www.w3.org/1999/xhtml\"><body><p>x</p></body></html>")
                )), root);
                fail("Missing META-INF/container.xml must be rejected");
            } catch (ReadingEpubAdapter.EpubException error) {
                assertEquals("invalid-epub", error.getCode());
            }

            try {
                adapter.read(new ByteArrayInputStream(epub(
                        new EntrySpec("mimetype", "application/epub+zip"),
                        container("OPS/package.opf"),
                        packageOpf(),
                        new EntrySpec("OPS/chapter1.xhtml", "<html xmlns=\"http://www.w3.org/1999/xhtml\"><body><p>x</p></body></html>"),
                        new EntrySpec("OPS/chapter2.xhtml", "<html xmlns=\"http://www.w3.org/1999/xhtml\"><body><p>y</p></body></html>"),
                        new EntrySpec("OPS/nav.xhtml", "<html xmlns=\"http://www.w3.org/1999/xhtml\"><body/></html>"),
                        new EntrySpec("OPS/overlay.smil", "<smil xmlns=\"http://www.w3.org/ns/SMIL\"><body/></smil>"),
                        new EntrySpec("META-INF/encryption.xml", "<encryption/>")
                )), root);
                fail("Protected EPUB must be rejected");
            } catch (ReadingEpubAdapter.EpubException error) {
                assertEquals("protected-epub", error.getCode());
            }
        } finally {
            deleteTree(root);
        }
    }
}
