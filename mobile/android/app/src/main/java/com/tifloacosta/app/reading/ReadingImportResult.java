package com.tifloacosta.app.reading;

public final class ReadingImportResult {
    private static final String STATUS_IMPORTED = "imported";
    private static final String STATUS_DUPLICATE = "duplicate";
    private static final String STATUS_REJECTED = "rejected";

    private final String status;
    private final String bookId;
    private final String reason;

    private ReadingImportResult(String status, String bookId, String reason) {
        this.status = status;
        this.bookId = bookId;
        this.reason = reason;
    }

    public static ReadingImportResult imported(String bookId) {
        return new ReadingImportResult(STATUS_IMPORTED, bookId, null);
    }

    public static ReadingImportResult duplicate(String bookId) {
        return new ReadingImportResult(STATUS_DUPLICATE, bookId, null);
    }

    public static ReadingImportResult rejected(String reason) {
        return new ReadingImportResult(STATUS_REJECTED, null, reason);
    }

    public boolean isImported() {
        return STATUS_IMPORTED.equals(status);
    }

    public boolean isDuplicate() {
        return STATUS_DUPLICATE.equals(status);
    }

    public boolean isRejected() {
        return STATUS_REJECTED.equals(status);
    }

    public String getStatus() {
        return status;
    }

    public String getBookId() {
        return bookId;
    }

    public String getReason() {
        return reason;
    }
}
