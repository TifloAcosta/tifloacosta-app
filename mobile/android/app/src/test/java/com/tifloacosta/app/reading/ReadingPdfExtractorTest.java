package com.tifloacosta.app.reading;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;

public class ReadingPdfExtractorTest {
    private static InputStream input() {
        return new ByteArrayInputStream("pdf-bytes".getBytes(StandardCharsets.UTF_8));
    }

    @Test
    public void readableBackendResultMapsMetadataAndOrderedRealPages() {
        ReadingPdfExtractor extractor = new ReadingPdfExtractor((source, password) ->
                new ReadingPdfExtractor.BackendDocument(
                        "Manual accesible",
                        "TifloAcosta",
                        "es",
                        3,
                        false,
                        Arrays.asList(
                                new ReadingPdfResult.Page(1, "Primera página."),
                                new ReadingPdfResult.Page(2, ""),
                                new ReadingPdfResult.Page(3, "Tercera página.")
                        )
                )
        );

        ReadingPdfResult result = extractor.inspect(input(), "");

        assertEquals("readable", result.getStatus());
        assertEquals("Manual accesible", result.getTitle());
        assertEquals("TifloAcosta", result.getAuthor());
        assertEquals("es", result.getLanguage());
        assertEquals(3, result.getPageCount());
        assertFalse(result.isOrderReliable());
        assertEquals(3, result.getPages().size());
        assertEquals(1, result.getPages().get(0).getNumber());
        assertEquals("Primera página.", result.getPages().get(0).getText());
        assertEquals(2, result.getPages().get(1).getNumber());
        assertEquals(3, result.getPages().get(2).getNumber());
    }

    @Test
    public void passwordFailureMapsToExplicitStateWithoutEchoingPassword() {
        ReadingPdfExtractor extractor = new ReadingPdfExtractor((source, password) -> {
            throw new ReadingPdfExtractor.PasswordRequiredException();
        });

        String secret = "clave-super-secreta";
        ReadingPdfResult result = extractor.inspect(input(), secret);

        assertEquals("password-required", result.getStatus());
        assertTrue(result.getPages().isEmpty());
        assertFalse(result.toString().contains(secret));
    }

    @Test
    public void validPdfWithoutReadableTextMapsToNoTextAndKeepsPageCount() {
        ReadingPdfExtractor extractor = new ReadingPdfExtractor((source, password) ->
                new ReadingPdfExtractor.BackendDocument(
                        "Escaneado",
                        "",
                        "es",
                        2,
                        true,
                        Arrays.asList(
                                new ReadingPdfResult.Page(1, "  \n\t"),
                                new ReadingPdfResult.Page(2, "")
                        )
                )
        );

        ReadingPdfResult result = extractor.inspect(input(), "");

        assertEquals("no-text", result.getStatus());
        assertEquals(2, result.getPageCount());
        assertTrue(result.getPages().isEmpty());
    }

    @Test
    public void parseFailureMapsToInvalidWithoutThrowing() {
        ReadingPdfExtractor extractor = new ReadingPdfExtractor((source, password) -> {
            throw new IOException("broken pdf");
        });

        ReadingPdfResult result = extractor.inspect(input(), "");

        assertEquals("invalid", result.getStatus());
        assertTrue(result.getPages().isEmpty());
    }

    @Test
    public void nullBackendResultIsInvalidAndNeverInventsPdfStructure() {
        ReadingPdfExtractor extractor = new ReadingPdfExtractor((source, password) -> null);

        ReadingPdfResult result = extractor.inspect(input(), "");

        assertNotNull(result);
        assertEquals("invalid", result.getStatus());
        assertEquals(Collections.emptyList(), result.getPages());
    }
}
