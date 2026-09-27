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
    private final ReadingPdfExtractor pdfExtractor;
    private final ReadingAudioProbe audioProbe;

    public ReadingImportService(
            ReadingBookRepository repository,
            ReadingFileStore fileStore,
            LongSupplier clock
    ) {
        this(repository, fileStore, clock, null, null);
    }

    public ReadingImportService(
            ReadingBookRepository repository,
            ReadingFileStore fileStore,
            LongSupplier clock,
            ReadingPdfExtractor pdfExtractor
    ) {
        this(repository, fileStore, clock, pdfExtractor, null);
    }

    public ReadingImportService(
            ReadingBookRepository repository,
            ReadingFileStore fileStore,
            LongSupplier clock,
            ReadingPdfExtractor pdfExtractor,
            ReadingAudioProbe audioProbe
    ) {
        this.repository = repository;
        this.fileStore = fileStore;
        this.clock = clock;
        this.pdfExtractor = pdfExtractor;
        this.audioProbe = audioProbe;
    }

    public ReadingImportResult importOne(ReadingImportSource source, InputStream input) {
        String format = formatFrom(source);
        String sourceExtension = sourceExtensionFrom(source, format);
        if (format == null
                || ("pdf".equals(format) && pdfExtractor == null)
                || ("audio".equals(format) && audioProbe == null)) {
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
                    if (read == 0) continue;
                    output.write(buffer, 0, read);
                    digest.update(buffer, 0, read);
                    actualSize += read;
                }
            }

            ReadingAudioProbe.Result audioInfo = null;
            if ("pdf".equals(format)) {
                ReadingImportResult pdfValidation = validatePdf(tempName);
                if (pdfValidation != null) return pdfValidation;
            } else if ("audio".equals(format)) {
                audioInfo = validateAudio(tempName);
                if (audioInfo == null || !audioInfo.isReadable()) {
                    return ReadingImportResult.rejected("invalid-audio");
                }
            } else if (!fileStore.tempHasReadableText(tempName, format)) {
                return ReadingImportResult.rejected("empty");
            }

            String hash = toHex(digest.digest());
            ReadingBookRecord existing = repository.findBySha256(hash);
            if (existing != null) {
                return ReadingImportResult.duplicate(existing.getId());
            }

            String id = UUID.randomUUID().toString();
            String relativePath = fileStore.moveTempToItem(tempName, id, format, sourceExtension);
            movedToFinal = true;

            String title = audioInfo != null && audioInfo.getTitle() != null
                    ? audioInfo.getTitle()
                    : titleFrom(source.getDisplayName(), id, format);
            ReadingBookRecord record = new ReadingBookRecord(
                    id,
                    hash,
                    title,
                    format,
                    mimeFrom(source.getMimeType(), format, sourceExtension),
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
            if (!movedToFinal) safeDeleteTemp(tempName);
        }
    }

    public void cleanupStaleTemps() {
        fileStore.cleanupStaleTemps();
    }

    private ReadingImportResult validatePdf(String tempName) throws IOException {
        try (InputStream source = fileStore.openTempInput(tempName)) {
            ReadingPdfResult result = pdfExtractor.inspect(source, "");
            if (ReadingPdfResult.STATUS_READABLE.equals(result.getStatus())
                    || ReadingPdfResult.STATUS_PASSWORD_REQUIRED.equals(result.getStatus())) {
                return null;
            }
            if (ReadingPdfResult.STATUS_NO_TEXT.equals(result.getStatus())) {
                return ReadingImportResult.rejected("pdf-no-text");
            }
            return ReadingImportResult.rejected("invalid-pdf");
        }
    }

    private ReadingAudioProbe.Result validateAudio(String tempName) throws IOException {
        return audioProbe.inspect(fileStore.tempFile(tempName));
    }

    private static String formatFrom(ReadingImportSource source) {
        if (source == null) return null;

        String displayName = source.getDisplayName();
        String lowerName = displayName == null ? "" : displayName.trim().toLowerCase(Locale.ROOT);
        String mimeType = source.getMimeType();
        String lowerMime = mimeType == null ? "" : mimeType.trim().toLowerCase(Locale.ROOT);

        if (lowerName.endsWith(".pdf")) return "pdf";
        if (lowerName.endsWith(".html") || lowerName.endsWith(".htm")) return "html";
        if (lowerName.endsWith(".txt")) return "txt";
        if (audioExtensionFrom(source) != null && audioExtensionFromName(lowerName) != null) return "audio";

        if ("application/pdf".equals(lowerMime)) return "pdf";
        if ("text/html".equals(lowerMime)) return "html";
        if ("text/plain".equals(lowerMime)) return "txt";
        if (audioExtensionFromMime(lowerMime) != null) return "audio";
        return null;
    }

    private static String sourceExtensionFrom(ReadingImportSource source, String format) {
        if ("html".equals(format)) return "html";
        if ("pdf".equals(format)) return "pdf";
        if ("txt".equals(format)) return "txt";
        if ("audio".equals(format)) return audioExtensionFrom(source);
        return null;
    }

    private static String audioExtensionFrom(ReadingImportSource source) {
        if (source == null) return null;
        String displayName = source.getDisplayName();
        String lowerName = displayName == null ? "" : displayName.trim().toLowerCase(Locale.ROOT);
        String extension = audioExtensionFromName(lowerName);
        if (extension != null) return extension;
        String mimeType = source.getMimeType();
        return audioExtensionFromMime(mimeType == null ? "" : mimeType.trim().toLowerCase(Locale.ROOT));
    }

    private static String audioExtensionFromName(String lowerName) {
        for (String extension : new String[]{"mp3", "m4a", "m4b", "aac", "ogg", "opus", "flac", "wav"}) {
            if (lowerName.endsWith("." + extension)) return extension;
        }
        return null;
    }

    private static String audioExtensionFromMime(String lowerMime) {
        switch (lowerMime) {
            case "audio/mpeg":
            case "audio/mp3":
                return "mp3";
            case "audio/mp4":
            case "audio/x-m4a":
            case "application/mp4":
                return "m4a";
            case "audio/x-m4b":
                return "m4b";
            case "audio/aac":
            case "audio/aacp":
                return "aac";
            case "audio/ogg":
            case "application/ogg":
                return "ogg";
            case "audio/opus":
                return "opus";
            case "audio/flac":
            case "audio/x-flac":
                return "flac";
            case "audio/wav":
            case "audio/x-wav":
            case "audio/wave":
            case "audio/vnd.wave":
                return "wav";
            default:
                return null;
        }
    }

    private static String titleFrom(String displayName, String fallback, String format) {
        if (displayName == null) return fallback;
        String title = displayName.trim();
        String lowerTitle = title.toLowerCase(Locale.ROOT);
        if ("html".equals(format)) {
            if (lowerTitle.endsWith(".html")) {
                title = title.substring(0, title.length() - 5).trim();
            } else if (lowerTitle.endsWith(".htm")) {
                title = title.substring(0, title.length() - 4).trim();
            }
        } else if ("pdf".equals(format) && lowerTitle.endsWith(".pdf")) {
            title = title.substring(0, title.length() - 4).trim();
        } else if ("txt".equals(format) && lowerTitle.endsWith(".txt")) {
            title = title.substring(0, title.length() - 4).trim();
        } else if ("audio".equals(format)) {
            String extension = audioExtensionFromName(lowerTitle);
            if (extension != null) {
                title = title.substring(0, title.length() - extension.length() - 1).trim();
            }
        }
        return title.isEmpty() ? fallback : title;
    }

    private static String mimeFrom(String mimeType, String format, String sourceExtension) {
        if ("pdf".equals(format)) return "application/pdf";
        if ("audio".equals(format)) return audioMimeFrom(mimeType, sourceExtension);
        if (mimeType != null && !mimeType.trim().isEmpty()) return mimeType;
        return "html".equals(format) ? "text/html" : "text/plain";
    }

    private static String audioMimeFrom(String mimeType, String sourceExtension) {
        String lowerMime = mimeType == null ? "" : mimeType.trim().toLowerCase(Locale.ROOT);
        if (audioExtensionFromMime(lowerMime) != null) return lowerMime;
        if (sourceExtension == null) return "audio/*";
        switch (sourceExtension) {
            case "mp3": return "audio/mpeg";
            case "m4a":
            case "m4b": return "audio/mp4";
            case "aac": return "audio/aac";
            case "ogg": return "audio/ogg";
            case "opus": return "audio/opus";
            case "flac": return "audio/flac";
            case "wav": return "audio/wav";
            default: return "audio/*";
        }
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
