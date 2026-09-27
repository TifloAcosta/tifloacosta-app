package com.tifloacosta.app.reading;

import android.content.Context;

import com.tom_roush.pdfbox.android.PDFBoxResourceLoader;
import com.tom_roush.pdfbox.pdmodel.PDDocument;
import com.tom_roush.pdfbox.pdmodel.PDDocumentCatalog;
import com.tom_roush.pdfbox.pdmodel.PDDocumentInformation;
import com.tom_roush.pdfbox.pdmodel.encryption.InvalidPasswordException;
import com.tom_roush.pdfbox.text.PDFTextStripper;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

public final class PdfBoxReadingPdfBackend implements ReadingPdfExtractor.Backend {
    private static final Object INIT_LOCK = new Object();
    private static volatile boolean initialized;

    public PdfBoxReadingPdfBackend(Context context) {
        if (context == null) throw new IllegalArgumentException("Android context is required");
        initialize(context.getApplicationContext());
    }

    @Override
    public ReadingPdfExtractor.BackendDocument read(InputStream source, String password)
            throws IOException, ReadingPdfExtractor.PasswordRequiredException {
        String transientPassword = password == null ? "" : password;
        try (PDDocument document = PDDocument.load(source, transientPassword)) {
            PDDocumentInformation information = document.getDocumentInformation();
            PDDocumentCatalog catalog = document.getDocumentCatalog();
            int pageCount = document.getNumberOfPages();
            List<ReadingPdfResult.Page> pages = new ArrayList<>(pageCount);

            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            for (int pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
                stripper.setStartPage(pageNumber);
                stripper.setEndPage(pageNumber);
                pages.add(new ReadingPdfResult.Page(pageNumber, stripper.getText(document)));
            }

            return new ReadingPdfExtractor.BackendDocument(
                    information == null ? "" : information.getTitle(),
                    information == null ? "" : information.getAuthor(),
                    catalog == null ? "" : catalog.getLanguage(),
                    pageCount,
                    false,
                    pages
            );
        } catch (InvalidPasswordException error) {
            throw new ReadingPdfExtractor.PasswordRequiredException();
        }
    }

    private static void initialize(Context context) {
        if (initialized) return;
        synchronized (INIT_LOCK) {
            if (initialized) return;
            PDFBoxResourceLoader.init(context);
            initialized = true;
        }
    }
}
