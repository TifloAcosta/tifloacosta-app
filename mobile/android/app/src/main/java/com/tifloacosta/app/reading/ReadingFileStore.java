package com.tifloacosta.app.reading;

import java.io.IOException;
import java.io.OutputStream;

public interface ReadingFileStore {
    long usableSpaceBytes();

    OutputStream openTemp(String tempName) throws IOException;

    boolean tempHasNonWhitespaceText(String tempName) throws IOException;

    default boolean tempHasReadableText(String tempName, String format) throws IOException {
        return tempHasNonWhitespaceText(tempName);
    }

    String moveTempToItem(String tempName, String id) throws IOException;

    default String moveTempToItem(String tempName, String id, String format) throws IOException {
        return moveTempToItem(tempName, id);
    }

    void deleteTemp(String tempName);

    void cleanupStaleTemps();

    String readUtf8(String relativePath) throws IOException;

    void deleteItemDirectory(String id);
}
