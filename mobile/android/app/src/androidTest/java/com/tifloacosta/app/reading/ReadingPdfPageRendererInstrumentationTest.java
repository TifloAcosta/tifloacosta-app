package com.tifloacosta.app.reading;

import android.content.Context;
import android.graphics.Bitmap;

import androidx.test.platform.app.InstrumentationRegistry;

import com.tom_roush.pdfbox.pdmodel.PDDocument;
import com.tom_roush.pdfbox.pdmodel.PDPage;
import com.tom_roush.pdfbox.pdmodel.common.PDRectangle;

import org.junit.Test;

import java.io.File;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

public final class ReadingPdfPageRendererInstrumentationTest {
    @Test
    public void rendersOneRealPrivatePdfPageWithinBounds() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        File itemDirectory = new File(context.getFilesDir(), "reading-library/items/ocr-render-test");
        assertTrue(itemDirectory.mkdirs() || itemDirectory.isDirectory());
        File pdf = new File(itemDirectory, "source.pdf");

        try (PDDocument document = new PDDocument()) {
            document.addPage(new PDPage(new PDRectangle(1200, 600)));
            document.addPage(new PDPage(new PDRectangle(600, 1200)));
            document.save(pdf);
        }

        ReadingPdfPageRenderer renderer = new ReadingPdfPageRenderer(context);
        ReadingPdfPageRenderer.RenderedPage page = renderer.renderPage(
                "items/ocr-render-test/source.pdf",
                "",
                0,
                1000
        );

        assertEquals(0, page.getPageIndex());
        assertTrue(page.getWidth() <= 1000);
        assertTrue(page.getHeight() <= 1000);
        assertNotNull(page.getImage());
        assertTrue(page.getImage() instanceof Bitmap);
        ((Bitmap) page.getImage()).recycle();
    }
}
