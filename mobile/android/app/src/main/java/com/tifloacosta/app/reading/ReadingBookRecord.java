package com.tifloacosta.app.reading;

public final class ReadingBookRecord {
    private final String id;
    private final String sha256;
    private final String title;
    private final String author;
    private final String language;
    private final String format;
    private final String mimeType;
    private final String relativePath;
    private final long sizeBytes;
    private final long importedAt;
    private final Long lastReadAt;
    private final String state;
    private final int blockIndex;
    private final int unitIndex;
    private final String anchorText;
    private final int mediaTrackIndex;
    private final long mediaPositionMs;
    private final double percent;

    public ReadingBookRecord(
            String id,
            String sha256,
            String title,
            String format,
            String mimeType,
            String relativePath,
            long sizeBytes,
            long importedAt,
            Long lastReadAt,
            String state,
            int blockIndex,
            double percent
    ) {
        this(
                id,
                sha256,
                title,
                "",
                "",
                format,
                mimeType,
                relativePath,
                sizeBytes,
                importedAt,
                lastReadAt,
                state,
                blockIndex,
                0,
                null,
                0,
                0L,
                percent
        );
    }

    public ReadingBookRecord(
            String id,
            String sha256,
            String title,
            String format,
            String mimeType,
            String relativePath,
            long sizeBytes,
            long importedAt,
            Long lastReadAt,
            String state,
            int blockIndex,
            int unitIndex,
            String anchorText,
            double percent
    ) {
        this(
                id,
                sha256,
                title,
                "",
                "",
                format,
                mimeType,
                relativePath,
                sizeBytes,
                importedAt,
                lastReadAt,
                state,
                blockIndex,
                unitIndex,
                anchorText,
                0,
                0L,
                percent
        );
    }

    public ReadingBookRecord(
            String id,
            String sha256,
            String title,
            String format,
            String mimeType,
            String relativePath,
            long sizeBytes,
            long importedAt,
            Long lastReadAt,
            String state,
            int blockIndex,
            int unitIndex,
            String anchorText,
            int mediaTrackIndex,
            long mediaPositionMs,
            double percent
    ) {
        this(
                id,
                sha256,
                title,
                "",
                "",
                format,
                mimeType,
                relativePath,
                sizeBytes,
                importedAt,
                lastReadAt,
                state,
                blockIndex,
                unitIndex,
                anchorText,
                mediaTrackIndex,
                mediaPositionMs,
                percent
        );
    }

    public ReadingBookRecord(
            String id,
            String sha256,
            String title,
            String author,
            String language,
            String format,
            String mimeType,
            String relativePath,
            long sizeBytes,
            long importedAt,
            Long lastReadAt,
            String state,
            int blockIndex,
            int unitIndex,
            String anchorText,
            int mediaTrackIndex,
            long mediaPositionMs,
            double percent
    ) {
        this.id = id;
        this.sha256 = sha256;
        this.title = title;
        this.author = author == null ? "" : author;
        this.language = language == null ? "" : language;
        this.format = format;
        this.mimeType = mimeType;
        this.relativePath = relativePath;
        this.sizeBytes = sizeBytes;
        this.importedAt = importedAt;
        this.lastReadAt = lastReadAt;
        this.state = state;
        this.blockIndex = blockIndex;
        this.unitIndex = unitIndex;
        this.anchorText = anchorText;
        this.mediaTrackIndex = mediaTrackIndex;
        this.mediaPositionMs = mediaPositionMs;
        this.percent = percent;
    }

    public String getId() { return id; }
    public String getSha256() { return sha256; }
    public String getTitle() { return title; }
    public String getAuthor() { return author; }
    public String getLanguage() { return language; }
    public String getFormat() { return format; }
    public String getMimeType() { return mimeType; }
    public String getRelativePath() { return relativePath; }
    public long getSizeBytes() { return sizeBytes; }
    public long getImportedAt() { return importedAt; }
    public Long getLastReadAt() { return lastReadAt; }
    public String getState() { return state; }
    public int getBlockIndex() { return blockIndex; }
    public int getUnitIndex() { return unitIndex; }
    public String getAnchorText() { return anchorText; }
    public int getMediaTrackIndex() { return mediaTrackIndex; }
    public long getMediaPositionMs() { return mediaPositionMs; }
    public double getPercent() { return percent; }
}
