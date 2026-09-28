package com.tifloacosta.app.reading;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

public final class ReadingPackageExtractor {
    private static final int BUFFER_SIZE = 8192;
    private final ReadingPackageLimits limits;

    public ReadingPackageExtractor() {
        this(ReadingPackageLimits.defaults());
    }

    public ReadingPackageExtractor(ReadingPackageLimits limits) {
        if (limits == null) throw new IllegalArgumentException("limits are required");
        this.limits = limits;
    }

    public Extraction extract(InputStream archive, File callerRoot, List<String> requiredEntries) throws IOException {
        if (archive == null) throw new IllegalArgumentException("archive is required");
        if (callerRoot == null) throw new IllegalArgumentException("callerRoot is required");

        ensureCallerRoot(callerRoot);
        File extractionRoot = createExtractionRoot(callerRoot);
        boolean success = false;
        try {
            List<String> entries = extractArchive(archive, extractionRoot);
            validateRequiredEntries(entries, requiredEntries);
            success = true;
            return new Extraction(extractionRoot, entries);
        } catch (PackageException error) {
            throw error;
        } catch (IOException error) {
            throw new PackageException("invalid-package", "Unable to extract reading package", error);
        } finally {
            if (!success) deleteTree(extractionRoot);
        }
    }

    private List<String> extractArchive(InputStream archive, File extractionRoot) throws IOException {
        List<String> entries = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        long expandedBytes = 0L;
        int entryCount = 0;
        String rootPath = extractionRoot.getCanonicalPath();
        String rootPrefix = rootPath + File.separator;

        try (ZipInputStream zip = new ZipInputStream(new BufferedInputStream(archive))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                entryCount++;
                if (entryCount > limits.getMaxEntries()) {
                    throw new PackageException("too-many-entries", "Package contains too many entries");
                }

                String normalized = normalizeEntryName(entry.getName());
                if (normalized.isEmpty()) {
                    zip.closeEntry();
                    continue;
                }
                if (!seen.add(normalized)) {
                    throw new PackageException("duplicate-entry", "Package contains duplicate entry: " + normalized);
                }
                if (depth(normalized) > limits.getMaxDepth()) {
                    throw new PackageException("too-deep", "Package entry is nested too deeply: " + normalized);
                }

                File destination = new File(extractionRoot, normalized.replace('/', File.separatorChar));
                String destinationPath = destination.getCanonicalPath();
                if (!destinationPath.startsWith(rootPrefix)) {
                    throw new PackageException("unsafe-path", "Package entry escapes extraction root: " + normalized);
                }

                if (entry.isDirectory()) {
                    if (!destination.exists() && !destination.mkdirs()) {
                        throw new IOException("Unable to create package directory: " + normalized);
                    }
                    zip.closeEntry();
                    continue;
                }

                if (looksLikeNestedArchiveName(normalized)) {
                    throw new PackageException("nested-archive", "Nested package archives are not supported: " + normalized);
                }

                File parent = destination.getParentFile();
                if (parent != null && !parent.exists() && !parent.mkdirs()) {
                    throw new IOException("Unable to create package directory: " + parent);
                }

                byte[] firstBytes = new byte[4];
                int firstCount = 0;
                try (FileOutputStream output = new FileOutputStream(destination, false)) {
                    byte[] buffer = new byte[BUFFER_SIZE];
                    int read;
                    while ((read = zip.read(buffer)) != -1) {
                        if (read == 0) continue;
                        for (int i = 0; i < read && firstCount < firstBytes.length; i++) {
                            firstBytes[firstCount++] = buffer[i];
                        }
                        expandedBytes += read;
                        if (expandedBytes > limits.getMaxExpandedBytes()) {
                            throw new PackageException("too-large", "Expanded package exceeds size limit");
                        }
                        output.write(buffer, 0, read);
                    }
                }

                if (hasZipSignature(firstBytes, firstCount)) {
                    throw new PackageException("nested-archive", "Nested package archives are not supported: " + normalized);
                }

                entries.add(normalized);
                zip.closeEntry();
            }
        }
        return Collections.unmodifiableList(entries);
    }

    private void validateRequiredEntries(List<String> entries, List<String> requiredEntries) throws PackageException {
        if (requiredEntries == null || requiredEntries.isEmpty()) return;
        Set<String> available = new HashSet<>(entries);
        for (String required : requiredEntries) {
            String normalized = normalizeEntryName(required);
            if (normalized.isEmpty() || !available.contains(normalized)) {
                throw new PackageException("missing-required-entry", "Required package entry is missing: " + required);
            }
        }
    }

    private static String normalizeEntryName(String rawName) throws PackageException {
        if (rawName == null) throw new PackageException("unsafe-path", "Package entry has no name");
        String name = rawName.replace('\\', '/').trim();
        if (name.isEmpty()) return "";
        if (name.startsWith("/") || hasDrivePrefix(name)) {
            throw new PackageException("unsafe-path", "Package contains an absolute path: " + rawName);
        }

        StringBuilder normalized = new StringBuilder();
        String[] parts = name.split("/", -1);
        for (String part : parts) {
            if (part.isEmpty() || ".".equals(part)) continue;
            if ("..".equals(part)) {
                throw new PackageException("unsafe-path", "Package contains parent traversal: " + rawName);
            }
            if (normalized.length() > 0) normalized.append('/');
            normalized.append(part);
        }
        return normalized.toString();
    }

    private static boolean hasDrivePrefix(String name) {
        return name.length() >= 2
                && Character.isLetter(name.charAt(0))
                && name.charAt(1) == ':';
    }

    private static int depth(String normalized) {
        if (normalized.isEmpty()) return 0;
        int depth = 1;
        for (int i = 0; i < normalized.length(); i++) {
            if (normalized.charAt(i) == '/') depth++;
        }
        return depth;
    }

    private static boolean looksLikeNestedArchiveName(String name) {
        String lower = name.toLowerCase(Locale.ROOT);
        return lower.endsWith(".zip") || lower.endsWith(".epub") || lower.endsWith(".docx") || lower.endsWith(".jar");
    }

    private static boolean hasZipSignature(byte[] bytes, int count) {
        if (count < 4) return false;
        return bytes[0] == 'P' && bytes[1] == 'K'
                && ((bytes[2] == 3 && bytes[3] == 4)
                    || (bytes[2] == 5 && bytes[3] == 6)
                    || (bytes[2] == 7 && bytes[3] == 8));
    }

    private static File createExtractionRoot(File callerRoot) throws IOException {
        for (int attempt = 0; attempt < 10; attempt++) {
            File candidate = new File(callerRoot, "package-" + UUID.randomUUID().toString());
            if (candidate.mkdir()) return candidate;
        }
        throw new IOException("Unable to create unique package extraction directory");
    }

    private static void ensureCallerRoot(File root) throws IOException {
        if (root.exists()) {
            if (!root.isDirectory()) throw new IOException("Package root is not a directory");
            return;
        }
        if (!root.mkdirs()) throw new IOException("Unable to create package root");
    }

    private static void deleteTree(File file) {
        if (file == null || !file.exists()) return;
        File[] children = file.listFiles();
        if (children != null) {
            for (File child : children) deleteTree(child);
        }
        file.delete();
    }

    public static final class Extraction {
        private final File root;
        private final List<String> entries;

        Extraction(File root, List<String> entries) {
            this.root = root;
            this.entries = Collections.unmodifiableList(new ArrayList<>(entries));
        }

        public File getRoot() {
            return root;
        }

        public List<String> getEntries() {
            return entries;
        }
    }

    public static class PackageException extends IOException {
        private final String code;

        PackageException(String code, String message) {
            super(message);
            this.code = code;
        }

        PackageException(String code, String message, Throwable cause) {
            super(message, cause);
            this.code = code;
        }

        public String getCode() {
            return code;
        }
    }
}
