package com.tifloacosta.app.reading;

import org.junit.Test;

import java.util.Arrays;
import java.util.Collections;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public final class ReadingOcrServiceTest {
    @Test
    public void recognizesOnePageAndPreservesBlocks() {
        FakePageSource pages = new FakePageSource();
        FakeRecognizer recognizer = new FakeRecognizer(
                new ReadingOcrService.Recognition("First block\nSecond block", Arrays.asList("First block", "Second block"))
        );
        ReadingOcrService service = new ReadingOcrService(pages, script -> recognizer);

        ReadingOcrService.Result result = service.recognizePdfPage(
                "items/book-1/source.pdf", "", 7, "latin"
        );

        assertEquals("ok", result.getStatus());
        assertEquals(7, result.getPageIndex());
        assertEquals("First block\nSecond block", result.getText());
        assertEquals(Arrays.asList("First block", "Second block"), result.getBlocks());
        assertEquals(7, pages.pageIndex);
        assertTrue(pages.closed);
        assertTrue(recognizer.closed);
    }

    @Test
    public void reportsEmptyWithoutInventingText() {
        FakePageSource pages = new FakePageSource();
        FakeRecognizer recognizer = new FakeRecognizer(
                new ReadingOcrService.Recognition("   ", Collections.emptyList())
        );
        ReadingOcrService service = new ReadingOcrService(pages, script -> recognizer);

        ReadingOcrService.Result result = service.recognizePdfPage(
                "items/book-1/source.pdf", "", 0, "japanese"
        );

        assertEquals("empty", result.getStatus());
        assertEquals("", result.getText());
        assertTrue(result.getBlocks().isEmpty());
        assertTrue(pages.closed);
        assertTrue(recognizer.closed);
    }

    @Test
    public void reportsModelUnavailableAndStillCleansResources() {
        FakePageSource pages = new FakePageSource();
        FakeRecognizer recognizer = new FakeRecognizer(null);
        recognizer.modelUnavailable = true;
        ReadingOcrService service = new ReadingOcrService(pages, script -> recognizer);

        ReadingOcrService.Result result = service.recognizePdfPage(
                "items/book-1/source.pdf", "", 2, "chinese"
        );

        assertEquals("model-unavailable", result.getStatus());
        assertEquals("", result.getText());
        assertTrue(pages.closed);
        assertTrue(recognizer.closed);
    }

    @Test
    public void rejectsUnsupportedScriptBeforeRendering() {
        FakePageSource pages = new FakePageSource();
        ReadingOcrService service = new ReadingOcrService(pages, script -> {
            throw new AssertionError("Recognizer must not be created");
        });

        ReadingOcrService.Result result = service.recognizePdfPage(
                "items/book-1/source.pdf", "", 1, "cyrillic"
        );

        assertEquals("unsupported-script", result.getStatus());
        assertFalse(pages.rendered);
    }

    @Test
    public void reportsGenericErrorAndCleansPageAndRecognizer() {
        FakePageSource pages = new FakePageSource();
        FakeRecognizer recognizer = new FakeRecognizer(null);
        recognizer.fail = true;
        ReadingOcrService service = new ReadingOcrService(pages, script -> recognizer);

        ReadingOcrService.Result result = service.recognizePdfPage(
                "items/book-1/source.pdf", "secret", 4, "devanagari"
        );

        assertEquals("error", result.getStatus());
        assertTrue(pages.closed);
        assertTrue(recognizer.closed);
    }

    private static final class FakePageSource implements ReadingOcrService.PageSource {
        private boolean rendered;
        private boolean closed;
        private int pageIndex = -1;

        @Override
        public ReadingOcrService.PageImage render(String relativePath, String password, int requestedPageIndex) {
            rendered = true;
            pageIndex = requestedPageIndex;
            return new ReadingOcrService.PageImage() {
                @Override
                public Object getImage() {
                    return new Object();
                }

                @Override
                public void close() {
                    closed = true;
                }
            };
        }
    }

    private static final class FakeRecognizer implements ReadingOcrService.Recognizer {
        private final ReadingOcrService.Recognition result;
        private boolean modelUnavailable;
        private boolean fail;
        private boolean closed;

        FakeRecognizer(ReadingOcrService.Recognition result) {
            this.result = result;
        }

        @Override
        public ReadingOcrService.Recognition recognize(Object image) throws Exception {
            if (modelUnavailable) {
                throw new ReadingOcrService.ModelUnavailableException("model unavailable");
            }
            if (fail) throw new IllegalStateException("recognition failed");
            return result;
        }

        @Override
        public void close() {
            closed = true;
        }
    }
}
