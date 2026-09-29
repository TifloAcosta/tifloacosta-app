package com.tifloacosta.app.reading;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

public class ReadingEpub2CompatibilityTest {
    private static final class Entry {
        final String name;
        final String content;

        Entry(String name, String content) {
            this.name = name;
            this.content = content;
        }
    }

    private static byte[] epub(Entry... entries) throws IOException {
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
        return Files.createTempDirectory("reading-epub2-test-").toFile();
    }

    private static void deleteTree(File file) {
        if (file == null || !file.exists()) return;
        File[] children = file.listFiles();
        if (children != null) {
            for (File child : children) deleteTree(child);
        }
        file.delete();
    }

    @Test
    public void acceptsStandardEpub2XhtmlAndNcxDoctypesWithoutLoadingExternalDtds() throws Exception {
        File root = tempRoot();
        try {
            byte[] bytes = epub(
                    new Entry("mimetype", "application/epub+zip"),
                    new Entry(
                            "META-INF/container.xml",
                            "<?xml version=\"1.0\"?>"
                                    + "<container xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\" version=\"1.0\">"
                                    + "<rootfiles><rootfile full-path=\"OEBPS/content.opf\" media-type=\"application/oebps-package+xml\"/>"
                                    + "</rootfiles></container>"
                    ),
                    new Entry(
                            "OEBPS/content.opf",
                            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                                    + "<package xmlns=\"http://www.idpf.org/2007/opf\" version=\"2.0\" unique-identifier=\"bookid\">"
                                    + "<metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\">"
                                    + "<dc:identifier id=\"bookid\">urn:epub2</dc:identifier>"
                                    + "<dc:title>EPUB 2 clásico</dc:title><dc:language>es</dc:language>"
                                    + "</metadata>"
                                    + "<manifest>"
                                    + "<item id=\"ncx\" href=\"toc.ncx\" media-type=\"application/x-dtbncx+xml\"/>"
                                    + "<item id=\"chapter\" href=\"chapter.xhtml\" media-type=\"application/xhtml+xml\"/>"
                                    + "</manifest>"
                                    + "<spine toc=\"ncx\"><itemref idref=\"chapter\"/></spine>"
                                    + "</package>"
                    ),
                    new Entry(
                            "OEBPS/chapter.xhtml",
                            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                                    + "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.1//EN\" \"http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd\">"
                                    + "<html xmlns=\"http://www.w3.org/1999/xhtml\"><body>"
                                    + "<h1 id=\"chapter\">Capítulo clásico</h1><p>Texto EPUB 2.</p>"
                                    + "</body></html>"
                    ),
                    new Entry(
                            "OEBPS/toc.ncx",
                            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                                    + "<!DOCTYPE ncx PUBLIC \"-//NISO//DTD ncx 2005-1//EN\" \"http://www.daisy.org/z3986/2005/ncx-2005-1.dtd\">"
                                    + "<ncx xmlns=\"http://www.daisy.org/z3986/2005/ncx/\" version=\"2005-1\">"
                                    + "<navMap><navPoint id=\"n1\" playOrder=\"1\">"
                                    + "<navLabel><text>Capítulo clásico</text></navLabel>"
                                    + "<content src=\"chapter.xhtml#chapter\"/>"
                                    + "</navPoint></navMap></ncx>"
                    )
            );

            ReadingStructuredDocument document = new ReadingEpubAdapter().read(
                    new ByteArrayInputStream(bytes),
                    root
            );

            assertEquals("EPUB 2 clásico", document.getTitle());
            assertEquals("Capítulo clásico", document.getBlocks().get(0).getText());
            assertEquals(1, document.getNavigation().size());
            assertEquals("Capítulo clásico", document.getNavigation().get(0).getLabel());
            assertEquals("OEBPS/chapter.xhtml#chapter", document.getNavigation().get(0).getHref());
        } finally {
            deleteTree(root);
        }
    }
}
