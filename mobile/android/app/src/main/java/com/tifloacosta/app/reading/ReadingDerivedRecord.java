package com.tifloacosta.app.reading;

public final class ReadingDerivedRecord {
    private final String bookId;
    private final String kind;
    private final String variantKey;
    private final String relativePath;
    private final String sourceSha256;
    private final String sourceLanguage;
    private final String targetLanguage;
    private final String engine;
    private final String engineVersion;
    private final String status;
    private final int completedUnits;
    private final int totalUnits;
    private final long updatedAt;

    public ReadingDerivedRecord(
            String bookId,
            String kind,
            String variantKey,
            String relativePath,
            String sourceSha256,
            String sourceLanguage,
            String targetLanguage,
            String engine,
            String engineVersion,
            String status,
            int completedUnits,
            int totalUnits,
            long updatedAt
    ) {
        this.bookId = bookId;
        this.kind = kind;
        this.variantKey = variantKey;
        this.relativePath = relativePath;
        this.sourceSha256 = sourceSha256;
        this.sourceLanguage = sourceLanguage;
        this.targetLanguage = targetLanguage;
        this.engine = engine;
        this.engineVersion = engineVersion;
        this.status = status;
        this.completedUnits = completedUnits;
        this.totalUnits = totalUnits;
        this.updatedAt = updatedAt;
    }

    public String getBookId() { return bookId; }
    public String getKind() { return kind; }
    public String getVariantKey() { return variantKey; }
    public String getRelativePath() { return relativePath; }
    public String getSourceSha256() { return sourceSha256; }
    public String getSourceLanguage() { return sourceLanguage; }
    public String getTargetLanguage() { return targetLanguage; }
    public String getEngine() { return engine; }
    public String getEngineVersion() { return engineVersion; }
    public String getStatus() { return status; }
    public int getCompletedUnits() { return completedUnits; }
    public int getTotalUnits() { return totalUnits; }
    public long getUpdatedAt() { return updatedAt; }
}
