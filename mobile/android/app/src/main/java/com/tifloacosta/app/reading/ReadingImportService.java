package com.tifloacosta.app.reading;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;
import java.util.UUID;
import java.util.function.LongSupplier;

public final class ReadingImportService {
    public static final long REQUIRED_HEADROOM_BYTES = 16L * 1024L * 1024L;

    private final ReadingBookRepository repository;
    private final ReadingFileStore fileStore;
    private final LongSupplier clock;

    public ReadingImportService(
            ReadingBookRepository repository,
            ReadingFileStore fileStore,
            LongSupplier clock
    ) {
        this.repository = repository;
        this.fileStore = fileStore;
        this.clock = clock;
    }

    public ReadingImportResult importOne(ReadingImportSource source, InputStream input) {
        String format = formatFrom(source);
        if (format == null) {
            return ReadingImportResult.rejected("unsupported");
        }

        Long declaredSize = source.getDeclaredSizeBytes();
        if (declaredSize != null && declaredSize >= 0) {
            long required = declaredSize > Long.MAX_VALUE - REQUIRED_HEADROOM_BYTES
                    ? Long.MAX_VALUE
                    : declaredSize + REQUIRED_HEADROOM_BYTES;
            if (fileStore.usableSpaceBytes() < required) {
                return ReadingImportResult.rejected("insufficient-space");
            }
        }

        String tempName = UUID.randomUUID() + ".tmp";
        boolean movedToFinal = false;

        try {
            MessageDigest digest = sha256();
            long actualSize = 0L;

            try (OutputStream output = fileStore.openTemp(tempName)) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    if (read == 0) {
                        continue;
                    }
                    output.write(buffer, 0, read);
                    digest.update(buffer, 0, read);
                    actualSize += read;
                }
            }

            if (!fileStore.tempHasReadableText(tempName, format)) {
                return ReadingImportResult.rejected("empty");
            }

            String hash = toHex(digest.digest());
            ReadingBookRecord existing = repository.findBySha256(hash);
            if (existing != null) {
                return ReadingImportResult.duplicate(existing.getId());
            }

            String id = UUID.randomUUID().toString();
            String relativePath = fileStore.moveTempToItem(tempName, id, format);
            movedToFinal = true;

            ReadingBookRecord record = new ReadingBookRecord(
                    id,
                    hash,
                    titleFrom(source.getDisplayName(), id, format),
                    format,
                    mimeFrom(source.getMimeType(), format),
                    relativePath,
                    actualSize,
                    clock.getAsLong(),
                    null,
                    "not-read",
                    0,
                    0.0
            );

            try {
                repository.insert(record);
            } catch (RuntimeException error) {
                safeDeleteItem(id);
                return ReadingImportResult.rejected("storage-error");
            }

            return ReadingImportResult.imported(id);
        } catch (IOException | RuntimeException error) {
            return ReadingImportResult.rejected("storage-error");
        } finally {
            if (!movedToFinal) {
                safeDeleteTemp(tempName);
            }
        }
    }

    public void cleanupStaleTemps() {
        fileStore.cleanupStaleTemps();
    }

    private static String formatFrom(ReadingImportSource source) {
        if (source == null) return null;

        String displayName = source.getDisplayName();
        String lowerName = displayName == null ? "" : displayName.trim().toLowerCase(Locale.ROOT);
        String mimeType = source.getMimeType();
        String lowerMime = mimeType == null ? "" : mimeType.trim().toLowerCase(Locale.ROOT);

        if ("text/html".equals(lowerMime) || lowerName.endsWith(".html") || lowerName.endsWith(".htm")) {
            return "html";
        }
        if ("text/plain".equals(lowerMime) || lowerName.endsWith(".txt")) {
            return "txt";
        }
        return null;
    }

    private static String titleFrom(String displayName, String fallback, String format) {
        if (displayName == null) {
            return fallback;
        }
        String title = displayName.trim();
        String lowerTitle = title.toLowerCase(Locale.ROOT);
        if ("html".equals(format)) {
            if (lowerTitle.endsWith(".html")) {
                title = title.substring(0, title.length() - 5).trim();
            } else if (lowerTitle.endsWith(".htm")) {
                title = title.substring(0, title.length() - 4).trim();
            }
        } else if (lowerTitle.endsWith(".txt")) {
            title = title.substring(0, title.length() - 4).trim();
        }
        return title.isEmpty() ? fallback : title;
    }

    private static String mimeFrom(String mimeType, String format) {
        if (mimeType != null && !mimeType.trim().isEmpty()) return mimeType;
        return "html".equals(format) ? "text/html" : "text/plain";
    }

    private static MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 unavailable", error);
        }
    }

    private static String toHex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            builder.append(String.format(Locale.ROOT, "%02x", value & 0xff));
        }
        return builder.toString();
    }

    private void safeDeleteTemp(String tempName) {
        try {
            fileStore.deleteTemp(tempName);
        } catch (RuntimeException ignored) {
        }
    }

    private void safeDeleteItem(String id) {
        try {
            fileStore.deleteItemDirectory(id);
        } catch (RuntimeException ignored) {
        }
    }
}
