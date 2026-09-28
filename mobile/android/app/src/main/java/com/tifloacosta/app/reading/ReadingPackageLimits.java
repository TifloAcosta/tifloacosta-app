package com.tifloacosta.app.reading;

public final class ReadingPackageLimits {
    public static final int DEFAULT_MAX_ENTRIES = 4096;
    public static final int DEFAULT_MAX_DEPTH = 32;
    public static final long DEFAULT_MAX_EXPANDED_BYTES = 256L * 1024L * 1024L;

    private final int maxEntries;
    private final int maxDepth;
    private final long maxExpandedBytes;

    public ReadingPackageLimits(int maxEntries, int maxDepth, long maxExpandedBytes) {
        if (maxEntries <= 0) throw new IllegalArgumentException("maxEntries must be positive");
        if (maxDepth <= 0) throw new IllegalArgumentException("maxDepth must be positive");
        if (maxExpandedBytes <= 0) throw new IllegalArgumentException("maxExpandedBytes must be positive");
        this.maxEntries = maxEntries;
        this.maxDepth = maxDepth;
        this.maxExpandedBytes = maxExpandedBytes;
    }

    public static ReadingPackageLimits defaults() {
        return new ReadingPackageLimits(DEFAULT_MAX_ENTRIES, DEFAULT_MAX_DEPTH, DEFAULT_MAX_EXPANDED_BYTES);
    }

    public int getMaxEntries() {
        return maxEntries;
    }

    public int getMaxDepth() {
        return maxDepth;
    }

    public long getMaxExpandedBytes() {
        return maxExpandedBytes;
    }
}
