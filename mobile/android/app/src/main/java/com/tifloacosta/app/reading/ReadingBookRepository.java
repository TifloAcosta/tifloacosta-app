package com.tifloacosta.app.reading;

import java.util.List;

public interface ReadingBookRepository {
    ReadingBookRecord findById(String id);
    ReadingBookRecord findBySha256(String sha256);
    List<ReadingBookRecord> list(ReadingBookQuery query);
    int count(ReadingBookQuery query);
    ReadingBookRecord latestInProgress();
    void insert(ReadingBookRecord record);
    void updateProgress(String id, int blockIndex, double percent, String state, long lastReadAt);

    default void updateProgress(
            String id,
            int blockIndex,
            int unitIndex,
            String anchorText,
            double percent,
            String state,
            long lastReadAt
    ) {
        updateProgress(id, blockIndex, percent, state, lastReadAt);
    }

    default void updateProgress(
            String id,
            int blockIndex,
            int unitIndex,
            String anchorText,
            int mediaTrackIndex,
            long mediaPositionMs,
            double percent,
            String state,
            long lastReadAt
    ) {
        updateProgress(id, blockIndex, unitIndex, anchorText, percent, state, lastReadAt);
    }

    default void insertAudioTracks(String bookId, List<ReadingAudioTrackRecord> tracks) {
        throw new UnsupportedOperationException("Reading audio tracks are not supported by this repository");
    }

    default List<ReadingAudioTrackRecord> listAudioTracks(String bookId) {
        throw new UnsupportedOperationException("Reading audio tracks are not supported by this repository");
    }

    default void insertMark(ReadingMarkRecord record) {
        throw new UnsupportedOperationException("Reading marks are not supported by this repository");
    }

    default List<ReadingMarkRecord> listMarks(String bookId, String type) {
        throw new UnsupportedOperationException("Reading marks are not supported by this repository");
    }

    default void deleteMark(String id) {
        throw new UnsupportedOperationException("Reading marks are not supported by this repository");
    }

    default ReadingSettingsRecord getReadingSetting(String scope, String bookId, String key) {
        throw new UnsupportedOperationException("Reading settings are not supported by this repository");
    }

    default void setReadingSetting(ReadingSettingsRecord record) {
        throw new UnsupportedOperationException("Reading settings are not supported by this repository");
    }

    default void resetBookReadingSettings(String bookId) {
        throw new UnsupportedOperationException("Reading settings are not supported by this repository");
    }

    void delete(String id);
}
