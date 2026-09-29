package com.tifloacosta.app.reading;

public final class ReadingQueueRecord {
    private final ReadingBookRecord book;
    private final int queueIndex;
    private final long addedAt;

    public ReadingQueueRecord(ReadingBookRecord book, int queueIndex, long addedAt) {
        if (book == null) throw new IllegalArgumentException("Queue record requires a book");
        if (queueIndex < 0) throw new IllegalArgumentException("Queue index must not be negative");
        this.book = book;
        this.queueIndex = queueIndex;
        this.addedAt = Math.max(0L, addedAt);
    }

    public ReadingBookRecord getBook() { return book; }
    public int getQueueIndex() { return queueIndex; }
    public long getAddedAt() { return addedAt; }
}
