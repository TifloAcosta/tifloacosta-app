package com.tifloacosta.app.reading;

public final class ReadingImportSource {
    private final String displayName;
    private final String mimeType;
    private final Long declaredSizeBytes;

    public ReadingImportSource(String displayName, String mimeType, Long declaredSizeBytes) {
        this.displayName = displayName;
        this.mimeType = mimeType;
        this.declaredSizeBytes = declaredSizeBytes;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getMimeType() {
        return mimeType;
    }

    public Long getDeclaredSizeBytes() {
        return declaredSizeBytes;
    }
}
