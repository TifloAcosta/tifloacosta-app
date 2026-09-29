package com.tifloacosta.app.reading;

import org.junit.Test;

import java.io.IOException;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

public final class ReadingPdfPageRendererTest {
    @Test
    public void rendersOnlyRequestedPageAndClampsLargestDimension() throws Exception {
        FakeBackend backend = new FakeBackend(3, 2400, 1200);
        ReadingPdfPageRenderer renderer = new ReadingPdfPageRenderer(backend);

        ReadingPdfPageRenderer.RenderedPage page = renderer.renderPage(
                "items/book-1/source.pdf",
                "",
                1,
                1600
        );

        assertEquals(1, backend.renderedPageIndex);
        assertEquals(1600, page.getWidth());
        assertEquals(800, page.getHeight());
        assertEquals(1, backend.openCount);
        assertEquals(1, backend.closeCount);
    }

    @Test
    public void rejectsOutOfRangePageBeforeRendering() throws Exception {
        FakeBackend backend = new FakeBackend(2, 1000, 1000);
        ReadingPdfPageRenderer renderer = new ReadingPdfPageRenderer(backend);

        try {
            renderer.renderPage("items/book-1/source.pdf", "", 2, 1600);
            fail("Expected invalid page index");
        } catch (IllegalArgumentException expected) {
            assertTrue(expected.getMessage().contains("pageIndex"));
        }

        assertEquals(-1, backend.renderedPageIndex);
        assertEquals(1, backend.closeCount);
    }

    @Test
    public void clampsRequestedMaximumToSafeBounds() throws Exception {
        FakeBackend backend = new FakeBackend(1, 8000, 4000);
        ReadingPdfPageRenderer renderer = new ReadingPdfPageRenderer(backend);

        ReadingPdfPageRenderer.RenderedPage page = renderer.renderPage(
                "items/book-1/source.pdf",
                "",
                0,
                Integer.MAX_VALUE
        );

        assertTrue(page.getWidth() <= ReadingPdfPageRenderer.MAX_DIMENSION);
        assertTrue(page.getHeight() <= ReadingPdfPageRenderer.MAX_DIMENSION);
        assertEquals(1, backend.closeCount);
    }

    @Test
    public void closesBackendDocumentWhenRenderFails() throws Exception {
        FakeBackend backend = new FakeBackend(1, 1200, 800);
        backend.failRender = true;
        ReadingPdfPageRenderer renderer = new ReadingPdfPageRenderer(backend);

        try {
            renderer.renderPage("items/book-1/source.pdf", "", 0, 1200);
            fail("Expected render failure");
        } catch (IOException expected) {
            assertEquals("render failed", expected.getMessage());
        }

        assertEquals(1, backend.closeCount);
    }

    private static final class FakeBackend implements ReadingPdfPageRenderer.Backend {
        private final int pageCount;
        private final int sourceWidth;
        private final int sourceHeight;
        private int openCount;
        private int closeCount;
        private int renderedPageIndex = -1;
        private boolean failRender;

        FakeBackend(int pageCount, int sourceWidth, int sourceHeight) {
            this.pageCount = pageCount;
            this.sourceWidth = sourceWidth;
            this.sourceHeight = sourceHeight;
        }

        @Override
        public ReadingPdfPageRenderer.Document open(String relativePath, String password) {
            openCount++;
            return new ReadingPdfPageRenderer.Document() {
                @Override
                public int getPageCount() {
                    return pageCount;
                }

                @Override
                public ReadingPdfPageRenderer.PageSize getPageSize(int pageIndex) {
                    return new ReadingPdfPageRenderer.PageSize(sourceWidth, sourceHeight);
                }

                @Override
                public Object render(int pageIndex, int width, int height) throws IOException {
                    renderedPageIndex = pageIndex;
                    if (failRender) throw new IOException("render failed");
                    return new Object();
                }

                @Override
                public void close() {
                    closeCount++;
                }
            };
        }
    }
}
