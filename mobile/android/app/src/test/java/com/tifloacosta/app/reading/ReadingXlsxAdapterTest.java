package com.tifloacosta.app.reading;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

public class ReadingXlsxAdapterTest {
    @Test
    public void readsSheetWithHeadersAsContextualRows() throws Exception {
        byte[] packageBytes = zip(
                "xl/workbook.xml", "<workbook xmlns:r=\"r\"><sheets><sheet name=\"Ventas\" r:id=\"rId1\"/></sheets></workbook>",
                "xl/_rels/workbook.xml.rels", "<Relationships><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/></Relationships>",
                "xl/sharedStrings.xml", "<sst><si><t>Producto</t></si><si><t>Enero</t></si><si><t>Ordenador</t></si></sst>",
                "xl/worksheets/sheet1.xml", "<worksheet><sheetData>"
                        + "<row r=\"1\"><c r=\"A1\" t=\"s\"><v>0</v></c><c r=\"B1\" t=\"s\"><v>1</v></c></row>"
                        + "<row r=\"2\"><c r=\"A2\" t=\"s\"><v>2</v></c><c r=\"B2\"><v>12</v></c></row>"
                        + "</sheetData></worksheet>"
        );

        ReadingStructuredDocument document = new ReadingXlsxAdapter().read(new ByteArrayInputStream(packageBytes));
        assertEquals(1, document.getNavigation().size());
        String all = join(document);
        assertTrue(all.contains("Ventas"));
        assertTrue(all.contains("Producto"));
        assertTrue(all.contains("Ordenador"));
        assertTrue(all.contains("Enero: 12"));
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
