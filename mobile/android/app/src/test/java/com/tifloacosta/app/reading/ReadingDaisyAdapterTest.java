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

public class ReadingDaisyAdapterTest {
    private static final class Entry {
        final String name;
        final byte[] bytes;

        Entry(String name, String text) {
            this(name, text.getBytes(StandardCharsets.UTF_8));
        }

        Entry(String name, byte[] bytes) {
            this.name = name;
            this.bytes = bytes;
        }
    }

    @Test
    public void readsDaisy202TextAudioNavigationPagesAndSynchronization() throws Exception {
        File root = tempRoot();
        try {
            ReadingDaisyBook book = new ReadingDaisyAdapter().read(
                    new ByteArrayInputStream(zip(
                            new Entry("ncc.html", daisy202Ncc()),
                            new Entry("chapter.smil", daisy202Smil(true, true)),
                            new Entry("content.xhtml", contentXhtml()),
                            new Entry("audio/chapter1.mp3", new byte[]{1, 2, 3, 4})
                    )),
                    root
            );

            assertEquals("daisy2.02", book.getFormat());
            assertEquals("DAISY dos", book.getDocument().getTitle());
            assertEquals("Autora dos", book.getDocument().getAuthor());
            assertEquals("es", book.getDocument().getLanguage());
            assertTrue(book.hasText());
            assertTrue(book.hasAudio());
            assertTrue(book.isSynchronized());
            assertNotNull(findBlock(book.getDocument(), "Capítulo uno"));
            assertNotNull(findBlock(book.getDocument(), "Texto del capítulo."));
            assertEquals(1, book.getDocument().getNavigation().size());
            assertEquals("Capítulo uno", book.getDocument().getNavigation().get(0).getLabel());
            assertEquals(1, book.getDocument().getPageReferences().size());
            assertEquals("1", book.getDocument().getPageReferences().get(0).getLabel());
            assertEquals(1, book.getAudioTracks().size());
            assertEquals("audio/chapter1.mp3", book.getAudioTracks().get(0).getHref());
            assertEquals(1, book.getDocument().getMediaSyncReferences().size());
            ReadingStructuredDocument.MediaSyncReference sync = book.getDocument().getMediaSyncReferences().get(0);
            assertEquals("content.xhtml#p1", sync.getTextHref());
            assertEquals("audio/chapter1.mp3", sync.getAudioHref());
            assertEquals(1250L, sync.getClipBeginMs());
            assertEquals(3000L, sync.getClipEndMs());
        } finally {
            deleteTree(root);
        }
    }

    @Test
    public void readsDaisy3MetadataNcxDtbookPagesAndSynchronization() throws Exception {
        File root = tempRoot();
        try {
            ReadingDaisyBook book = new ReadingDaisyAdapter().read(
                    new ByteArrayInputStream(zip(
                            new Entry("book.opf", daisy3Opf(true)),
                            new Entry("navigation.ncx", daisy3Ncx()),
                            new Entry("book.xml", daisy3Dtbook()),
                            new Entry("chapter.smil", daisy3Smil()),
                            new Entry("audio/chapter.mp3", new byte[]{9, 8, 7})
                    )),
                    root
            );

            assertEquals("daisy3", book.getFormat());
            assertEquals("DAISY tres", book.getDocument().getTitle());
            assertEquals("Autor tres", book.getDocument().getAuthor());
            assertEquals("es-MX", book.getDocument().getLanguage());
            assertTrue(book.hasText());
            assertTrue(book.hasAudio());
            assertTrue(book.isSynchronized());
            assertNotNull(findBlock(book.getDocument(), "Sección principal"));
            assertNotNull(findBlock(book.getDocument(), "Contenido DAISY tres."));
            assertEquals("Sección principal", book.getDocument().getNavigation().get(0).getLabel());
            assertEquals("12", book.getDocument().getPageReferences().get(0).getLabel());
            assertEquals("audio/chapter.mp3", book.getAudioTracks().get(0).getHref());
            assertEquals(1, book.getDocument().getMediaSyncReferences().size());
        } finally {
            deleteTree(root);
        }
    }

    @Test
    public void exposesOnlyCapabilitiesThatActuallyExist() throws Exception {
        File audioRoot = tempRoot();
        File textRoot = tempRoot();
        try {
            ReadingDaisyBook audioOnly = new ReadingDaisyAdapter().read(
                    new ByteArrayInputStream(zip(
                            new Entry("ncc.html", daisy202Ncc()),
                            new Entry("chapter.smil", daisy202Smil(false, true)),
                            new Entry("audio/chapter1.mp3", new byte[]{1, 2, 3})
                    )),
                    audioRoot
            );
            assertFalse(audioOnly.hasText());
            assertTrue(audioOnly.hasAudio());
            assertFalse(audioOnly.isSynchronized());

            ReadingDaisyBook textOnly = new ReadingDaisyAdapter().read(
                    new ByteArrayInputStream(zip(
                            new Entry("book.opf", daisy3Opf(false)),
                            new Entry("navigation.ncx", daisy3Ncx()),
                            new Entry("book.xml", daisy3Dtbook())
                    )),
                    textRoot
            );
            assertTrue(textOnly.hasText());
            assertFalse(textOnly.hasAudio());
            assertFalse(textOnly.isSynchronized());
        } finally {
            deleteTree(audioRoot);
            deleteTree(textRoot);
        }
    }

    @Test
    public void rejectsMissingReferencedResources() throws Exception {
        File root = tempRoot();
        try {
            try {
                new ReadingDaisyAdapter().read(
                        new ByteArrayInputStream(zip(
                                new Entry("ncc.html", daisy202Ncc()),
                                new Entry("chapter.smil", daisy202Smil(true, true)),
                                new Entry("content.xhtml", contentXhtml())
                        )),
                        root
                );
                fail("Expected missing DAISY resource rejection");
            } catch (ReadingDaisyAdapter.DaisyException error) {
                assertEquals("missing-daisy-resource", error.getCode());
            }
        } finally {
            deleteTree(root);
        }
    }

    @Test
    public void rejectsProtectedDaisyPackages() throws Exception {
        File root = tempRoot();
        try {
            try {
                new ReadingDaisyAdapter().read(
                        new ByteArrayInputStream(zip(
                                new Entry("ncc.html", daisy202Ncc()),
                                new Entry("chapter.smil", daisy202Smil(false, true)),
                                new Entry("audio/chapter1.mp3", new byte[]{1}),
                                new Entry("META-INF/encryption.xml", "<encryption/>")
                        )),
                        root
                );
                fail("Expected protected DAISY rejection");
            } catch (ReadingDaisyAdapter.DaisyException error) {
                assertEquals("protected-daisy", error.getCode());
            }
        } finally {
            deleteTree(root);
        }
    }

    private static String daisy202Ncc() {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                + "<html xmlns=\"http://www.w3.org/1999/xhtml\"><head>"
                + "<title>DAISY dos</title>"
                + "<meta name=\"dc:title\" content=\"DAISY dos\"/>"
                + "<meta name=\"dc:creator\" content=\"Autora dos\"/>"
                + "<meta name=\"dc:language\" content=\"es\"/>"
                + "</head><body>"
                + "<h1><a href=\"chapter.smil#nav1\">Capítulo uno</a></h1>"
                + "<span class=\"page-normal\"><a href=\"chapter.smil#page1\">1</a></span>"
                + "</body></html>";
    }

    private static String daisy202Smil(boolean includeText, boolean includeAudio) {
        String text = includeText ? "<text src=\"content.xhtml#p1\"/>" : "";
        String audio = includeAudio
                ? "<audio src=\"audio/chapter1.mp3\" clip-begin=\"npt=1.250s\" clip-end=\"00:00:03.000\"/>"
                : "";
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                + "<smil xmlns=\"http://www.w3.org/2001/SMIL20/\"><body><seq>"
                + "<par id=\"nav1\">" + text + audio + "</par>"
                + "<par id=\"page1\">" + text + "</par>"
                + "</seq></body></smil>";
    }

    private static String contentXhtml() {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                + "<html xmlns=\"http://www.w3.org/1999/xhtml\"><body>"
                + "<h1 id=\"h1\">Capítulo uno</h1><p id=\"p1\">Texto del capítulo.</p>"
                + "</body></html>";
    }

    private static String daisy3Opf(boolean withAudio) {
        String smilManifest = withAudio
                ? "<item id=\"smil1\" href=\"chapter.smil\" media-type=\"application/smil+xml\"/>"
                + "<item id=\"audio1\" href=\"audio/chapter.mp3\" media-type=\"audio/mpeg\"/>"
                : "";
        String spine = withAudio ? "<itemref idref=\"smil1\"/>" : "<itemref idref=\"text1\"/>";
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                + "<package xmlns=\"http://openebook.org/namespaces/oeb-package/1.0/\" unique-identifier=\"uid\">"
                + "<metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\">"
                + "<dc:Title>DAISY tres</dc:Title><dc:Creator>Autor tres</dc:Creator><dc:Language>es-MX</dc:Language>"
                + "</metadata><manifest>"
                + "<item id=\"ncx\" href=\"navigation.ncx\" media-type=\"application/x-dtbncx+xml\"/>"
                + "<item id=\"text1\" href=\"book.xml\" media-type=\"application/x-dtbook+xml\"/>"
                + smilManifest
                + "</manifest><spine toc=\"ncx\">" + spine + "</spine></package>";
    }

    private static String daisy3Ncx() {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                + "<ncx xmlns=\"http://www.daisy.org/z3986/2005/ncx/\"><navMap>"
                + "<navPoint id=\"n1\" playOrder=\"1\"><navLabel><text>Sección principal</text></navLabel>"
                + "<content src=\"book.xml#section1\"/></navPoint>"
                + "</navMap><pageList><pageTarget id=\"p12\" type=\"normal\" value=\"12\">"
                + "<navLabel><text>12</text></navLabel><content src=\"book.xml#page12\"/>"
                + "</pageTarget></pageList></ncx>";
    }

    private static String daisy3Dtbook() {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                + "<dtbook xmlns=\"http://www.daisy.org/z3986/2005/dtbook/\" xml:lang=\"es-MX\"><book><bodymatter>"
                + "<level1 id=\"section1\"><h1>Sección principal</h1>"
                + "<p id=\"t1\">Contenido DAISY tres.</p><pagenum id=\"page12\">12</pagenum>"
                + "</level1></bodymatter></book></dtbook>";
    }

    private static String daisy3Smil() {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                + "<smil xmlns=\"http://www.w3.org/2001/SMIL20/\"><body><seq>"
                + "<par><text src=\"book.xml#t1\"/><audio src=\"audio/chapter.mp3\" clipBegin=\"0:00:02.000\" clipEnd=\"0:00:05.500\"/></par>"
                + "</seq></body></smil>";
    }

    private static ReadingStructuredDocument.Block findBlock(ReadingStructuredDocument document, String text) {
        for (ReadingStructuredDocument.Block block : document.getBlocks()) {
            if (text.equals(block.getText())) return block;
        }
        return null;
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

    private static File tempRoot() throws IOException {
        return Files.createTempDirectory("reading-daisy-test-").toFile();
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
