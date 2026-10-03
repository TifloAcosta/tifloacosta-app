package com.tifloacosta.app.reading;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

public class ReadingPptxAdapterTest {
    @Test
    public void readsSlidesAltTextAndSpeakerNotesInOrder() throws Exception {
        byte[] packageBytes = zip(
                "ppt/presentation.xml", "<p:presentation xmlns:p=\"p\" xmlns:r=\"r\"><p:sldIdLst><p:sldId r:id=\"rId1\"/></p:sldIdLst></p:presentation>",
                "ppt/_rels/presentation.xml.rels", "<Relationships><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide\" Target=\"slides/slide1.xml\"/></Relationships>",
                "ppt/slides/slide1.xml", "<p:sld xmlns:p=\"p\" xmlns:a=\"a\"><p:cSld><p:spTree>"
                        + "<p:sp><p:nvSpPr><p:nvPr><p:ph type=\"title\"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Resultados</a:t></a:r></a:p></p:txBody></p:sp>"
                        + "<p:sp><p:nvSpPr><p:nvPr/></p:nvSpPr><p:txBody><a:p><a:r><a:t>Ventas al alza</a:t></a:r></a:p></p:txBody></p:sp>"
                        + "<p:pic><p:nvPicPr><p:cNvPr descr=\"Gráfico de barras con crecimiento\"/></p:nvPicPr></p:pic>"
                        + "</p:spTree></p:cSld></p:sld>",
                "ppt/slides/_rels/slide1.xml.rels", "<Relationships><Relationship Id=\"rIdN\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide\" Target=\"../notesSlides/notesSlide1.xml\"/></Relationships>",
                "ppt/notesSlides/notesSlide1.xml", "<p:notes xmlns:p=\"p\" xmlns:a=\"a\"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type=\"body\"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Explicar la subida anual</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>"
        );

        ReadingStructuredDocument document = new ReadingPptxAdapter().read(new ByteArrayInputStream(packageBytes));
        assertEquals(1, document.getNavigation().size());
        String all = join(document);
        assertTrue(all.contains("Resultados"));
        assertTrue(all.contains("Ventas al alza"));
        assertTrue(all.contains("Gráfico de barras con crecimiento"));
        assertTrue(all.contains("Explicar la subida anual"));
    }

    private static String join(ReadingStructuredDocument document) {
        StringBuilder out = new StringBuilder();
        for (ReadingStructuredDocument.Block block : document.getBlocks()) out.append(block.getText()).append("\n");
        return out.toString();
    }

    private static byte[] zip(String... parts) throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
            for (int i = 0; i < parts.length; i += 2) {
                zip.putNextEntry(new ZipEntry(parts[i]));
                zip.write(parts[i + 1].getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
        }
        return bytes.toByteArray();
    }
}
