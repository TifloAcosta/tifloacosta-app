package com.tifloacosta.app.reading;

import java.util.Collections;
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

    default void updateBookMetadata(String id, String title, String author, String language, String state) {
        throw new UnsupportedOperationException("Reading metadata is not supported by this repository");
    }

    default List<ReadingQueueRecord> listQueue() {
        throw new UnsupportedOperationException("Reading queue is not supported by this repository");
    }

    default boolean addToQueue(String bookId) {
        throw new UnsupportedOperationException("Reading queue is not supported by this repository");
    }

    default boolean removeFromQueue(String bookId) {
        throw new UnsupportedOperationException("Reading queue is not supported by this repository");
    }

    default boolean moveQueueItem(String bookId, int targetIndex) {
        throw new UnsupportedOperationException("Reading queue is not supported by this repository");
    }

    default boolean isQueued(String bookId) {
        return false;
    }

    default int queueIndex(String bookId) {
        return -1;
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

    default List<ReadingSettingsRecord> listReadingSettings(String scope, String bookId) {
        return Collections.emptyList();
    }

    default void resetBookReadingSettings(String bookId) {
        throw new UnsupportedOperationException("Reading settings are not supported by this repository");
    }

    void delete(String id);
}
