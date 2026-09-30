package com.tifloacosta.app.reading;

import android.content.Context;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;

public final class ReadingDerivedStore {
    private final File root;
    private final File itemsDirectory;

    public ReadingDerivedStore(Context context) {
        root = new File(context.getFilesDir(), "reading-library");
        itemsDirectory = new File(root, "items");
        ensureDirectory(root);
        ensureDirectory(itemsDirectory);
    }

    public String writeUtf8(String bookId, String fileName, String content) throws IOException {
        File file = safeDerivedFile(bookId, fileName);
        ensureDirectoryForIo(file.getParentFile());
        try (OutputStreamWriter writer = new OutputStreamWriter(
                new FileOutputStream(file, false),
                StandardCharsets.UTF_8
        )) {
            writer.write(content == null ? "" : content);
        }
        return "items/" + bookId + "/derived/" + fileName;
    }

    public String readUtf8(String relativePath) throws IOException {
        File file = safeRelativeDerivedFile(relativePath);
        StringBuilder text = new StringBuilder();
        try (InputStreamReader reader = new InputStreamReader(
                new FileInputStream(file),
                StandardCharsets.UTF_8
        )) {
            char[] buffer = new char[8192];
            int read;
            while ((read = reader.read(buffer)) != -1) text.append(buffer, 0, read);
        }
        return text.toString();
    }

    public void delete(String relativePath) throws IOException {
        File file = safeRelativeDerivedFile(relativePath);
        if (file.exists() && !file.delete()) throw new IOException("Unable to remove derived reading content");
    }

    private File safeDerivedFile(String bookId, String fileName) throws IOException {
        String cleanBookId = bookId == null ? "" : bookId.trim();
        if (cleanBookId.isEmpty() || !cleanBookId.matches("[A-Za-z0-9_-]+")) {
            throw new IOException("Invalid derived reading book id");
        }
        String cleanFileName = fileName == null ? "" : fileName.trim();
        if (cleanFileName.isEmpty() || !cleanFileName.matches("[A-Za-z0-9._-]+")) {
            throw new IOException("Invalid derived reading file name");
        }

        File derivedDirectory = new File(new File(itemsDirectory, cleanBookId), "derived");
        File file = new File(derivedDirectory, cleanFileName);
        String derivedPath = derivedDirectory.getCanonicalPath();
        String filePath = file.getCanonicalPath();
        if (!filePath.startsWith(derivedPath + File.separator)) {
            throw new IOException("Invalid derived reading path");
        }
        return file;
    }

    private File safeRelativeDerivedFile(String relativePath) throws IOException {
        String clean = relativePath == null ? "" : relativePath.trim();
        if (!clean.matches("items/[A-Za-z0-9_-]+/derived/[A-Za-z0-9._-]+")) {
            throw new IOException("Invalid derived reading relative path");
        }
        File file = new File(root, clean);
        String rootPath = root.getCanonicalPath();
        String filePath = file.getCanonicalPath();
        if (!filePath.startsWith(rootPath + File.separator)) {
            throw new IOException("Invalid derived reading library path");
        }
        return file;
    }

    private static void ensureDirectory(File directory) {
        if (directory.exists()) return;
        if (!directory.mkdirs() && !directory.exists()) {
            throw new IllegalStateException("Unable to create derived reading directory");
        }
    }

    private static void ensureDirectoryForIo(File directory) throws IOException {
        if (directory.exists()) return;
        if (!directory.mkdirs() && !directory.exists()) {
            throw new IOException("Unable to create derived reading directory");
        }
    }
}
