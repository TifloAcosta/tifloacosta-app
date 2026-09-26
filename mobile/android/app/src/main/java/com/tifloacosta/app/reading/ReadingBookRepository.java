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
    void delete(String id);
}
