package com.tifloacosta.app.reading;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class ReadingPdfResult {
    public static final String STATUS_READABLE = "readable";
    public static final String STATUS_PASSWORD_REQUIRED = "password-required";
    public static final String STATUS_NO_TEXT = "no-text";
    public static final String STATUS_INVALID = "invalid";

    private final String status;
    private final String title;
    private final String author;
    private final String language;
    private final int pageCount;
    private final boolean orderReliable;
    private final List<Page> pages;

    private ReadingPdfResult(
            String status,
            String title,
            String author,
            String language,
            int pageCount,
            boolean orderReliable,
            List<Page> pages
    ) {
        this.status = status;
        this.title = clean(title);
        this.author = clean(author);
        this.language = clean(language);
        this.pageCount = Math.max(0, pageCount);
        this.orderReliable = orderReliable;
        this.pages = Collections.unmodifiableList(new ArrayList<>(pages == null ? Collections.emptyList() : pages));
    }

    public static ReadingPdfResult readable(
            String title,
            String author,
            String language,
            int pageCount,
            boolean orderReliable,
            List<Page> pages
    ) {
        return new ReadingPdfResult(
                STATUS_READABLE,
                title,
                author,
                language,
                pageCount,
                orderReliable,
                pages
        );
    }

    public static ReadingPdfResult passwordRequired() {
        return new ReadingPdfResult(
                STATUS_PASSWORD_REQUIRED,
                "",
                "",
                "",
                0,
                false,
                Collections.emptyList()
        );
    }

    public static ReadingPdfResult noText(int pageCount) {
        return new ReadingPdfResult(
                STATUS_NO_TEXT,
                "",
                "",
                "",
                pageCount,
                false,
                Collections.emptyList()
        );
    }

    public static ReadingPdfResult invalid() {
        return new ReadingPdfResult(
                STATUS_INVALID,
                "",
                "",
                "",
                0,
                false,
                Collections.emptyList()
        );
    }

    public String getStatus() {
        return status;
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

    public List<Page> getPages() {
        return pages;
    }

    @Override
    public String toString() {
        return "ReadingPdfResult{" +
                "status='" + status + '\'' +
                ", pageCount=" + pageCount +
                ", pages=" + pages.size() +
                '}';
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    public static final class Page {
        private final int number;
        private final String text;

        public Page(int number, String text) {
            this.number = Math.max(1, number);
            this.text = text == null ? "" : text;
        }

        public int getNumber() {
            return number;
        }

        public String getText() {
            return text;
        }
    }
}
