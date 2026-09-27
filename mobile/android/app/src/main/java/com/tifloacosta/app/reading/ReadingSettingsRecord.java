package com.tifloacosta.app.reading;

public final class ReadingSettingsRecord {
    private final String scope;
    private final String bookId;
    private final String key;
    private final String value;
    private final long updatedAt;

    public ReadingSettingsRecord(String scope, String bookId, String key, String value, long updatedAt) {
        this.scope = scope;
        this.bookId = bookId;
        this.key = key;
        this.value = value;
        this.updatedAt = updatedAt;
    }

    public String getScope() { return scope; }
    public String getBookId() { return bookId; }
    public String getKey() { return key; }
    public String getValue() { return value; }
    public long getUpdatedAt() { return updatedAt; }
}
