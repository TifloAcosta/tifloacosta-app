package com.tifloacosta.app.reading;

import java.io.IOException;
import java.io.OutputStream;

public interface ReadingFileStore {
    long usableSpaceBytes();

    OutputStream openTemp(String tempName) throws IOException;

    boolean tempHasNonWhitespaceText(String tempName) throws IOException;

    String moveTempToItem(String tempName, String id) throws IOException;

    void deleteTemp(String tempName);

    void cleanupStaleTemps();

    String readUtf8(String relativePath) throws IOException;

    void deleteItemDirectory(String id);
}
