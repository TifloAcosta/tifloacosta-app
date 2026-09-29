package com.tifloacosta.app.reading;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class ReadingPdfExtractor {
    public interface Backend {
        BackendDocument read(InputStream source, String password)
                throws IOException, PasswordRequiredException;
    }

    public static final class PasswordRequiredException extends IOException {
        public PasswordRequiredException() {
            super("PDF password required");
        }
    }

    public static final class BackendDocument {
        private final String title;
        private final String author;
        private final String language;
        private final int pageCount;
        private final boolean orderReliable;
        private final List<ReadingPdfResult.Page> pages;

        public BackendDocument(
                String title,
                String author,
                String language,
                int pageCount,
                boolean orderReliable,
                List<ReadingPdfResult.Page> pages
        ) {
            this.title = title == null ? "" : title;
            this.author = author == null ? "" : author;
            this.language = language == null ? "" : language;
            this.pageCount = Math.max(0, pageCount);
            this.orderReliable = orderReliable;
            this.pages = Collections.unmodifiableList(new ArrayList<>(
                    pages == null ? Collections.emptyList() : pages
            ));
        }

        public String getTitle() {
            return title;
        }

        public String getAuthor() {
            return author;
        }

        public String getLanguage() {
            return language;
        }

        public int getPageCount() {
            return pageCount;
        }

        public boolean isOrderReliable() {
            return orderReliable;
        }

        public List<ReadingPdfResult.Page> getPages() {
            return pages;
        }
    }

    private final Backend backend;

    public ReadingPdfExtractor(Backend backend) {
        if (backend == null) throw new IllegalArgumentException("PDF backend is required");
        this.backend = backend;
    }

    public ReadingPdfResult inspect(InputStream source, String password) {
        if (source == null) return ReadingPdfResult.invalid();
        String transientPassword = password == null ? "" : password;
        try {
            BackendDocument document = backend.read(source, transientPassword);
            if (document == null) return ReadingPdfResult.invalid();

            boolean hasReadableText = false;
            for (ReadingPdfResult.Page page : document.getPages()) {
                if (page != null && page.getText() != null && !page.getText().trim().isEmpty()) {
                    hasReadableText = true;
                    break;
                }
            }

            if (!hasReadableText) {
                return ReadingPdfResult.noText(document.getPageCount());
            }

            return ReadingPdfResult.readable(
                    document.getTitle(),
                    document.getAuthor(),
                    document.getLanguage(),
                    document.getPageCount(),
                    document.isOrderReliable(),
                    document.getPages()
            );
        } catch (PasswordRequiredException error) {
            return ReadingPdfResult.passwordRequired();
        } catch (IOException | RuntimeException error) {
            return ReadingPdfResult.invalid();
        }
    }
}
