package com.tifloacosta.app.reading;

public final class ReadingMarkRecord {
    private final String id;
    private final String bookId;
    private final String type;
    private final int blockIndex;
    private final int unitIndex;
    private final String excerpt;
    private final String reference;
    private final long createdAt;

    public ReadingMarkRecord(
            String id,
            String bookId,
            String type,
            int blockIndex,
            int unitIndex,
            String excerpt,
            String reference,
            long createdAt
    ) {
        this.id = id;
        this.bookId = bookId;
        this.type = type;
        this.blockIndex = blockIndex;
        this.unitIndex = unitIndex;
        this.excerpt = excerpt;
        this.reference = reference;
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public String getBookId() { return bookId; }
    public String getType() { return type; }
    public int getBlockIndex() { return blockIndex; }
    public int getUnitIndex() { return unitIndex; }
    public String getExcerpt() { return excerpt; }
    public String getReference() { return reference; }
    public long getCreatedAt() { return createdAt; }
}
