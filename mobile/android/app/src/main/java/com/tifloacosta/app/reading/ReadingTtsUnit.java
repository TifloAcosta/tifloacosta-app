package com.tifloacosta.app.reading;

public final class ReadingTtsUnit {
    private final int blockIndex;
    private final int unitIndex;
    private final String text;

    public ReadingTtsUnit(int blockIndex, int unitIndex, String text) {
        if (blockIndex < 0) throw new IllegalArgumentException("blockIndex must be non-negative");
        if (unitIndex < 0) throw new IllegalArgumentException("unitIndex must be non-negative");
        if (text == null || text.trim().isEmpty()) throw new IllegalArgumentException("text is required");
        this.blockIndex = blockIndex;
        this.unitIndex = unitIndex;
        this.text = text;
    }

    public int getBlockIndex() {
        return blockIndex;
    }

    public int getUnitIndex() {
        return unitIndex;
    }

    public String getText() {
        return text;
    }
}
