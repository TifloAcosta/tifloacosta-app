package com.tifloacosta.app.reading;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

public class ReadingDaisyDoctypeCompatibilityTest {
    @Test
    public void acceptsStandardPackageAndDtbookDoctypesWithoutLoadingExternalDtds() throws Exception {
        File root = Files.createTempDirectory("reading-daisy-doctype-").toFile();
        try {
            byte[] archive = zip(
                    "book.opf",
                    "<?xml version=\"1.0\"?>"
                            + "<!DOCTYPE package PUBLIC \"+//ISBN 0-9673008-1-9//DTD OEB 1.2 Package//EN\" \"http://openebook.org/dtds/oeb-1.2/oebpkg12.dtd\">"
                            + "<package xmlns=\"http://openebook.org/namespaces/oeb-package/1.0/\">"
                            + "<metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\">"
                            + "<dc:Title>Libro DAISY</dc:Title><dc:Language>es</dc:Language>"
                            + "</metadata><manifest>"
                            + "<item id=\"text\" href=\"book.xml\" media-type=\"application/x-dtbook+xml\"/>"
                            + "</manifest><spine><itemref idref=\"text\"/></spine></package>",
                    "book.xml",
                    "<?xml version=\"1.0\"?>"
                            + "<!DOCTYPE dtbook PUBLIC \"-//NISO//DTD dtbook 2005-3//EN\" \"http://www.daisy.org/z3986/2005/dtbook-2005-3.dtd\">"
                            + "<dtbook xmlns=\"http://www.daisy.org/z3986/2005/dtbook/\" xml:lang=\"es\">"
                            + "<book><bodymatter><level1><h1>Capítulo</h1><p>Contenido.</p></level1></bodymatter></book>"
                            + "</dtbook>"
            );

            ReadingDaisyBook book = new ReadingDaisyAdapter().read(new ByteArrayInputStream(archive), root);

            assertEquals("daisy3", book.getFormat());
            assertTrue(book.hasText());
            assertEquals("Libro DAISY", book.getDocument().getTitle());
        } finally {
            deleteTree(root);
        }
    }

    private static byte[] zip(String... nameAndContent) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(output)) {
            for (int index = 0; index < nameAndContent.length; index += 2) {
                zip.putNextEntry(new ZipEntry(nameAndContent[index]));
                zip.write(nameAndContent[index + 1].getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
        }
        return output.toByteArray();
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
