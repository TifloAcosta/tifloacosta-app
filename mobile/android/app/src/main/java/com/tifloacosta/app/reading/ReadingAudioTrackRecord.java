package com.tifloacosta.app.reading;

public final class ReadingAudioTrackRecord {
    private final String bookId;
    private final int trackIndex;
    private final String relativePath;
    private final String originalName;
    private final String title;
    private final long durationMs;
    private final Integer embeddedTrackNumber;
    private final long sizeBytes;

    public ReadingAudioTrackRecord(
            String bookId,
            int trackIndex,
            String relativePath,
            String originalName,
            String title,
            long durationMs,
            Integer embeddedTrackNumber,
            long sizeBytes
    ) {
        this.bookId = bookId;
        this.trackIndex = Math.max(0, trackIndex);
        this.relativePath = relativePath;
        this.originalName = originalName;
        this.title = title;
        this.durationMs = Math.max(0L, durationMs);
        this.embeddedTrackNumber = embeddedTrackNumber == null || embeddedTrackNumber <= 0
                ? null
                : embeddedTrackNumber;
        this.sizeBytes = Math.max(0L, sizeBytes);
    }

    public String getBookId() { return bookId; }
    public int getTrackIndex() { return trackIndex; }
    public String getRelativePath() { return relativePath; }
    public String getOriginalName() { return originalName; }
    public String getTitle() { return title; }
    public long getDurationMs() { return durationMs; }
    public Integer getEmbeddedTrackNumber() { return embeddedTrackNumber; }
    public long getSizeBytes() { return sizeBytes; }
}
