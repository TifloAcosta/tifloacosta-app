package com.tifloacosta.app.reading;

import android.content.Context;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public final class AndroidReadingFileStore implements ReadingFileStore {
    private final File root;
    private final File tempDirectory;
    private final File itemsDirectory;

    public AndroidReadingFileStore(Context context) {
        root = new File(context.getFilesDir(), "reading-library");
        tempDirectory = new File(root, "tmp");
        itemsDirectory = new File(root, "items");
        ensureDirectory(root);
        ensureDirectory(tempDirectory);
        ensureDirectory(itemsDirectory);
    }

    @Override
    public long usableSpaceBytes() {
        ensureDirectory(root);
        return root.getUsableSpace();
    }

    @Override
    public OutputStream openTemp(String tempName) throws IOException {
        ensureDirectoryForIo(tempDirectory);
        return new FileOutputStream(safeTempFile(tempName), false);
    }

    @Override
    public InputStream openTempInput(String tempName) throws IOException {
        ensureDirectoryForIo(tempDirectory);
        return new FileInputStream(safeTempFile(tempName));
    }

    @Override
    public File tempFile(String tempName) throws IOException {
        ensureDirectoryForIo(tempDirectory);
        return safeTempFile(tempName);
    }

    public InputStream openStoredInput(String relativePath) throws IOException {
        return new FileInputStream(safeRelativeFile(relativePath));
    }

    @Override
    public boolean tempHasNonWhitespaceText(String tempName) throws IOException {
        return tempHasReadableText(tempName, "txt");
    }

    @Override
    public boolean tempHasReadableText(String tempName, String format) throws IOException {
        File file = safeTempFile(tempName);
        try (InputStreamReader reader = new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8)) {
            char[] buffer = new char[4096];
            int read;
            while ((read = reader.read(buffer)) != -1) {
                for (int index = 0; index < read; index++) {
                    if (!Character.isWhitespace(buffer[index])) return true;
                }
            }
        }
        return false;
    }

    @Override
    public String moveTempToItem(String tempName, String id) throws IOException {
        return moveTempToItem(tempName, id, "txt", "txt");
    }

    @Override
    public String moveTempToItem(String tempName, String id, String format) throws IOException {
        return moveTempToItem(tempName, id, format, format);
    }

    @Override
    public String moveTempToItem(
            String tempName,
            String id,
            String format,
            String sourceExtension
    ) throws IOException {
        String sourceName;
        if ("html".equals(format)) sourceName = "source.html";
        else if ("pdf".equals(format)) sourceName = "source.pdf";
        else if ("epub".equals(format)) sourceName = "source.epub";
        else if ("audio".equals(format)) sourceName = "source." + safeAudioExtension(sourceExtension);
        else sourceName = "source.txt";
        return moveTemp(tempName, id, sourceName);
    }

    @Override
    public String moveTempToAudioTrack(
            String tempName,
            String id,
            int trackIndex,
            String sourceExtension
    ) throws IOException {
        String sourceName = String.format(
                Locale.ROOT,
                "track-%04d.%s",
                Math.max(0, trackIndex) + 1,
                safeAudioExtension(sourceExtension)
        );
        return moveTemp(tempName, id, sourceName);
    }

    private String moveTemp(String tempName, String id, String sourceName) throws IOException {
        File source = safeTempFile(tempName);
        File itemDirectory = safeItemDirectory(id);
        ensureDirectoryForIo(itemDirectory);
        File destination = new File(itemDirectory, sourceName);
        if (!source.renameTo(destination)) {
            try (InputStream input = new FileInputStream(source); OutputStream output = new FileOutputStream(destination, false)) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            } catch (IOException error) {
                deleteRecursively(itemDirectory);
                throw error;
            }
            if (!source.delete()) {
                deleteRecursively(itemDirectory);
                throw new IOException("Unable to remove reading import temp file");
            }
        }
        return "items/" + id + "/" + sourceName;
    }

    @Override
    public void deleteTemp(String tempName) {
        try {
            File file = safeTempFile(tempName);
            if (file.exists() && !file.delete()) {
                throw new IllegalStateException("Unable to remove reading import temp file");
            }
        } catch (IOException error) {
            throw new IllegalStateException("Invalid reading temp file", error);
        }
    }

    @Override
    public void cleanupStaleTemps() {
        File[] files = tempDirectory.listFiles();
        if (files == null) return;
        for (File file : files) deleteRecursively(file);
    }

    @Override
    public String readUtf8(String relativePath) throws IOException {
        File file = safeRelativeFile(relativePath);
        StringBuilder text = new StringBuilder();
        try (InputStreamReader reader = new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8)) {
            char[] buffer = new char[8192];
            int read;
            while ((read = reader.read(buffer)) != -1) text.append(buffer, 0, read);
        }
        return text.toString();
    }

    @Override
    public void deleteItemDirectory(String id) {
        try {
            File directory = safeItemDirectory(id);
            if (!deleteRecursively(directory)) {
                throw new IllegalStateException("Unable to remove reading item");
            }
        } catch (IOException error) {
            throw new IllegalStateException("Invalid reading item", error);
        }
    }

    private File safeTempFile(String tempName) throws IOException {
        File file = new File(tempDirectory, tempName == null ? "" : tempName);
        String rootPath = tempDirectory.getCanonicalPath();
        String filePath = file.getCanonicalPath();
        if (!filePath.startsWith(rootPath + File.separator)) throw new IOException("Invalid reading temp path");
        return file;
    }

    private File safeItemDirectory(String id) throws IOException {
        String clean = id == null ? "" : id.trim();
        if (clean.isEmpty() || !clean.matches("[A-Za-z0-9_-]+")) throw new IOException("Invalid reading item id");
        File directory = new File(itemsDirectory, clean);
        String itemsPath = itemsDirectory.getCanonicalPath();
        String directoryPath = directory.getCanonicalPath();
        if (!directoryPath.startsWith(itemsPath + File.separator)) throw new IOException("Invalid reading item path");
        return directory;
    }

    private File safeRelativeFile(String relativePath) throws IOException {
        File file = new File(root, relativePath == null ? "" : relativePath);
        String rootPath = root.getCanonicalPath();
        String filePath = file.getCanonicalPath();
        if (!filePath.startsWith(rootPath + File.separator)) throw new IOException("Invalid reading library path");
        return file;
    }

    private static String safeAudioExtension(String extension) throws IOException {
        if (extension == null) throw new IOException("Missing reading audio extension");
        switch (extension.toLowerCase(Locale.ROOT)) {
            case "mp3":
            case "m4a":
            case "m4b":
            case "aac":
            case "ogg":
            case "opus":
            case "flac":
            case "wav": return extension.toLowerCase(Locale.ROOT);
            default: throw new IOException("Unsupported reading audio extension");
        }
    }

    private static void ensureDirectory(File directory) {
        if (!directory.exists() && !directory.mkdirs()) {
            throw new IllegalStateException("Unable to create reading library directory");
        }
    }

    private static void ensureDirectoryForIo(File directory) throws IOException {
        if (!directory.exists() && !directory.mkdirs()) {
            throw new IOException("Unable to create reading library directory");
        }
    }

    private static boolean deleteRecursively(File file) {
        if (!file.exists()) return true;
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) {
                    if (!deleteRecursively(child)) return false;
                }
            }
        }
        return file.delete();
    }
}