package com.tifloacosta.app.reading;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.function.LongSupplier;

public final class ReadingImportService {
    public static final long REQUIRED_HEADROOM_BYTES = 16L * 1024L * 1024L;

    private final ReadingBookRepository repository;
    private final ReadingFileStore fileStore;
    private final LongSupplier clock;
    private final ReadingPdfExtractor pdfExtractor;
    private final ReadingAudioProbe audioProbe;

    public static final class AudioGroupItem {
        private final ReadingImportSource source;
        private final InputStream input;

        public AudioGroupItem(ReadingImportSource source, InputStream input) {
            this.source = source;
            this.input = input;
        }

        public ReadingImportSource getSource() { return source; }
        public InputStream getInput() { return input; }
    }

    private static final class StagedAudio {
        private final ReadingImportSource source;
        private final String tempName;
        private final String extension;
        private final String hash;
        private final long sizeBytes;
        private final ReadingAudioProbe.Result info;

        private StagedAudio(
                ReadingImportSource source,
                String tempName,
                String extension,
                String hash,
                long sizeBytes,
                ReadingAudioProbe.Result info
        ) {
            this.source = source;
            this.tempName = tempName;
            this.extension = extension;
            this.hash = hash;
            this.sizeBytes = sizeBytes;
            this.info = info;
        }
    }

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

        if (!hasSpaceFor(source == null ? null : source.getDeclaredSizeBytes())) {
            return ReadingImportResult.rejected("insufficient-space");
        }

        String tempName = UUID.randomUUID() + ".tmp";
        boolean movedToFinal = false;

        try {
            MessageDigest digest = sha256();
            long actualSize = copyToTemp(input, tempName, digest);

            ReadingAudioProbe.Result audioInfo = null;
            ReadingStructuredDocument epubInfo = null;
            if ("pdf".equals(format)) {
                ReadingImportResult pdfValidation = validatePdf(tempName);
                if (pdfValidation != null) return pdfValidation;
            } else if ("audio".equals(format)) {
                audioInfo = validateAudio(tempName);
                if (audioInfo == null || !audioInfo.isReadable()) {
                    return ReadingImportResult.rejected("invalid-audio");
                }
            } else if ("epub".equals(format)) {
                try {
                    epubInfo = validateEpub(tempName);
                } catch (ReadingEpubAdapter.EpubException error) {
                    return ReadingImportResult.rejected(error.getCode());
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

            String fallbackTitle = titleFrom(source.getDisplayName(), id, format);
            String title = audioInfo != null && audioInfo.getTitle() != null && !audioInfo.getTitle().trim().isEmpty()
                    ? audioInfo.getTitle().trim()
                    : epubInfo != null && !epubInfo.getTitle().isEmpty()
                    ? epubInfo.getTitle()
                    : fallbackTitle;
            String author = epubInfo == null ? "" : epubInfo.getAuthor();
            String language = epubInfo == null ? "" : epubInfo.getLanguage();
            ReadingBookRecord record = new ReadingBookRecord(
                    id,
                    hash,
                    title,
                    author,
                    language,
                    format,
                    mimeFrom(source.getMimeType(), format, sourceExtension),
                    relativePath,
                    actualSize,
                    clock.getAsLong(),
                    null,
                    "not-read",
                    0,
                    0,
                    null,
                    0,
                    0L,
                    0.0
            );

            try {
                repository.insert(record);
                if (audioInfo != null) {
                    List<ReadingAudioTrackRecord> tracks = new ArrayList<>();
                    tracks.add(new ReadingAudioTrackRecord(
                            id,
                            0,
                            relativePath,
                            displayNameOr(source, title),
                            audioInfo.getTitle(),
                            audioInfo.getDurationMs(),
                            audioInfo.getTrackNumber(),
                            actualSize
                    ));
                    insertAudioTracksIfSupported(id, tracks);
                }
            } catch (RuntimeException error) {
                safeDeleteRecord(id);
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

    public ReadingImportResult importAudioGroup(List<AudioGroupItem> items) {
        if (audioProbe == null || items == null || items.size() < 2) {
            closeGroupInputs(items);
            return ReadingImportResult.rejected("unsupported");
        }

        long declaredTotal = 0L;
        for (AudioGroupItem item : items) {
            ReadingImportSource source = item == null ? null : item.getSource();
            if (!isAudioSource(source) || item.getInput() == null) {
                closeGroupInputs(items);
                return ReadingImportResult.rejected("unsupported");
            }
            Long declared = source.getDeclaredSizeBytes();
            if (declared != null && declared >= 0L) {
                if (declaredTotal > Long.MAX_VALUE - declared) declaredTotal = Long.MAX_VALUE;
                else declaredTotal += declared;
            }
        }
        if (!hasSpaceFor(declaredTotal)) {
            closeGroupInputs(items);
            return ReadingImportResult.rejected("insufficient-space");
        }

        List<StagedAudio> staged = new ArrayList<>();
        boolean movedAny = false;
        String id = null;
        try {
            Set<String> hashes = new HashSet<>();
            for (AudioGroupItem item : items) {
                ReadingImportSource source = item.getSource();
                String extension = audioExtensionFrom(source);
                String tempName = UUID.randomUUID() + ".tmp";
                MessageDigest digest = sha256();
                long size;
                try (InputStream input = item.getInput()) {
                    size = copyToTemp(input, tempName, digest);
                }
                String hash = toHex(digest.digest());
                if (!hashes.add(hash)) {
                    safeDeleteTemp(tempName);
                    return ReadingImportResult.rejected("duplicate-audio-track");
                }
                ReadingAudioProbe.Result info = validateAudio(tempName);
                if (info == null || !info.isReadable()) {
                    safeDeleteTemp(tempName);
                    return ReadingImportResult.rejected("invalid-audio");
                }
                staged.add(new StagedAudio(source, tempName, extension, hash, size, info));
            }

            if (!orderAudioGroup(staged)) {
                return ReadingImportResult.rejected("ambiguous-audio-order");
            }

            MessageDigest groupDigest = sha256();
            long totalSize = 0L;
            for (StagedAudio track : staged) {
                byte[] bytes = track.hash.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                groupDigest.update(bytes);
                groupDigest.update((byte) '\n');
                if (totalSize > Long.MAX_VALUE - track.sizeBytes) totalSize = Long.MAX_VALUE;
                else totalSize += track.sizeBytes;
            }
            String groupHash = toHex(groupDigest.digest());
            ReadingBookRecord existing = repository.findBySha256(groupHash);
            if (existing != null) return ReadingImportResult.duplicate(existing.getId());

            id = UUID.randomUUID().toString();
            List<ReadingAudioTrackRecord> trackRecords = new ArrayList<>();
            String firstPath = null;
            for (int index = 0; index < staged.size(); index++) {
                StagedAudio track = staged.get(index);
                String relativePath = fileStore.moveTempToAudioTrack(
                        track.tempName,
                        id,
                        index,
                        track.extension
                );
                movedAny = true;
                if (firstPath == null) firstPath = relativePath;
                trackRecords.add(new ReadingAudioTrackRecord(
                        id,
                        index,
                        relativePath,
                        displayNameOr(track.source, "track-" + (index + 1)),
                        track.info.getTitle(),
                        track.info.getDurationMs(),
                        track.info.getTrackNumber(),
                        track.sizeBytes
                ));
            }

            String title = groupTitle(staged, id);
            ReadingBookRecord record = new ReadingBookRecord(
                    id,
                    groupHash,
                    title,
                    "audio",
                    "audio/*",
                    firstPath == null ? "" : firstPath,
                    totalSize,
                    clock.getAsLong(),
                    null,
                    "not-read",
                    0,
                    0.0
            );

            try {
                repository.insert(record);
                repository.insertAudioTracks(id, trackRecords);
            } catch (RuntimeException error) {
                safeDeleteRecord(id);
                safeDeleteItem(id);
                return ReadingImportResult.rejected("storage-error");
            }

            return ReadingImportResult.imported(id);
        } catch (IOException | RuntimeException error) {
            if (id != null) {
                safeDeleteRecord(id);
                safeDeleteItem(id);
            }
            return ReadingImportResult.rejected("storage-error");
        } finally {
            closeGroupInputs(items);
            for (StagedAudio track : staged) {
                if (!movedAny || !track.tempName.isEmpty()) safeDeleteTemp(track.tempName);
            }
        }
    }

    public static boolean isAudioSource(ReadingImportSource source) {
        return "audio".equals(formatFrom(source));
    }

    public void cleanupStaleTemps() {
        fileStore.cleanupStaleTemps();
    }

    private long copyToTemp(InputStream input, String tempName, MessageDigest digest) throws IOException {
        if (input == null) throw new IOException("Reading import source is unavailable");
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
        return actualSize;
    }

    private boolean hasSpaceFor(Long declaredSize) {
        if (declaredSize == null || declaredSize < 0L) return true;
        long required = declaredSize > Long.MAX_VALUE - REQUIRED_HEADROOM_BYTES
                ? Long.MAX_VALUE
                : declaredSize + REQUIRED_HEADROOM_BYTES;
        return fileStore.usableSpaceBytes() >= required;
    }

    private static boolean orderAudioGroup(List<StagedAudio> tracks) {
        if (tracks == null || tracks.size() < 2) return false;
        int numbered = 0;
        Set<String> names = new HashSet<>();
        for (StagedAudio track : tracks) {
            if (track.info.getTrackNumber() != null) numbered += 1;
            String normalizedName = displayNameOr(track.source, "").trim().toLowerCase(Locale.ROOT);
            if (normalizedName.isEmpty() || !names.add(normalizedName)) return false;
        }
        if (numbered != 0 && numbered != tracks.size()) return false;

        Comparator<StagedAudio> byName = (left, right) -> naturalCompare(
                displayNameOr(left.source, ""),
                displayNameOr(right.source, "")
        );
        if (numbered == tracks.size()) {
            tracks.sort((left, right) -> {
                int compared = Integer.compare(left.info.getTrackNumber(), right.info.getTrackNumber());
                return compared != 0 ? compared : byName.compare(left, right);
            });
        } else {
            tracks.sort(byName);
        }
        return true;
    }

    private static int naturalCompare(String left, String right) {
        String a = left == null ? "" : left;
        String b = right == null ? "" : right;
        int ai = 0;
        int bi = 0;
        while (ai < a.length() && bi < b.length()) {
            char ac = a.charAt(ai);
            char bc = b.charAt(bi);
            if (Character.isDigit(ac) && Character.isDigit(bc)) {
                int aStart = ai;
                int bStart = bi;
                while (ai < a.length() && Character.isDigit(a.charAt(ai))) ai++;
                while (bi < b.length() && Character.isDigit(b.charAt(bi))) bi++;
                String an = a.substring(aStart, ai).replaceFirst("^0+(?!$)", "");
                String bn = b.substring(bStart, bi).replaceFirst("^0+(?!$)", "");
                if (an.length() != bn.length()) return Integer.compare(an.length(), bn.length());
                int numberCompare = an.compareTo(bn);
                if (numberCompare != 0) return numberCompare;
                continue;
            }
            int compared = Character.compare(Character.toLowerCase(ac), Character.toLowerCase(bc));
            if (compared != 0) return compared;
            ai++;
            bi++;
        }
        return Integer.compare(a.length(), b.length());
    }

    private static String groupTitle(List<StagedAudio> staged, String fallback) {
        String album = null;
        boolean sameAlbum = true;
        for (StagedAudio track : staged) {
            String current = track.info.getAlbum();
            if (current == null) {
                sameAlbum = false;
                break;
            }
            if (album == null) album = current;
            else if (!album.equalsIgnoreCase(current)) {
                sameAlbum = false;
                break;
            }
        }
        if (sameAlbum && album != null && !album.trim().isEmpty()) return album.trim();
        return titleFrom(staged.get(0).source.getDisplayName(), fallback, "audio");
    }

    private void insertAudioTracksIfSupported(String id, List<ReadingAudioTrackRecord> tracks) {
        try {
            repository.insertAudioTracks(id, tracks);
        } catch (UnsupportedOperationException ignored) {
        }
    }

    private ReadingImportResult validatePdf(String tempName) throws IOException {
        try (InputStream source = fileStore.openTempInput(tempName)) {
            ReadingPdfResult result = pdfExtractor.inspect(source, "");
            if (ReadingPdfResult.STATUS_READABLE.equals(result.getStatus())
                    || ReadingPdfResult.STATUS_PASSWORD_REQUIRED.equals(result.getStatus())) return null;
            if (ReadingPdfResult.STATUS_NO_TEXT.equals(result.getStatus())) {
                return ReadingImportResult.rejected("pdf-no-text");
            }
            return ReadingImportResult.rejected("invalid-pdf");
        }
    }

    private ReadingAudioProbe.Result validateAudio(String tempName) throws IOException {
        return audioProbe.inspect(fileStore.tempFile(tempName));
    }

    private ReadingStructuredDocument validateEpub(String tempName) throws IOException {
        File tempFile = fileStore.tempFile(tempName);
        File parent = tempFile.getParentFile();
        if (parent == null) throw new IOException("Reading EPUB temp directory is unavailable");
        File workRoot = new File(parent, "epub-work");
        try (InputStream source = fileStore.openTempInput(tempName)) {
            return new ReadingEpubAdapter().read(source, workRoot);
        } finally {
            File[] remaining = workRoot.listFiles();
            if (remaining == null || remaining.length == 0) workRoot.delete();
        }
    }

    private static String formatFrom(ReadingImportSource source) {
        if (source == null) return null;

        String displayName = source.getDisplayName();
        String lowerName = displayName == null ? "" : displayName.trim().toLowerCase(Locale.ROOT);
        String mimeType = source.getMimeType();
        String lowerMime = mimeType == null ? "" : mimeType.trim().toLowerCase(Locale.ROOT);

        if (lowerName.endsWith(".pdf")) return "pdf";
        if (lowerName.endsWith(".epub")) return "epub";
        if (lowerName.endsWith(".html") || lowerName.endsWith(".htm")) return "html";
        if (lowerName.endsWith(".txt")) return "txt";
        if (audioExtensionFrom(source) != null && audioExtensionFromName(lowerName) != null) return "audio";

        if ("application/pdf".equals(lowerMime)) return "pdf";
        if ("application/epub+zip".equals(lowerMime)) return "epub";
        if ("text/html".equals(lowerMime)) return "html";
        if ("text/plain".equals(lowerMime)) return "txt";
        if (audioExtensionFromMime(lowerMime) != null) return "audio";
        return null;
    }

    private static String sourceExtensionFrom(ReadingImportSource source, String format) {
        if ("html".equals(format)) return "html";
        if ("pdf".equals(format)) return "pdf";
        if ("epub".equals(format)) return "epub";
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
            case "audio/mp3": return "mp3";
            case "audio/mp4":
            case "audio/x-m4a":
            case "application/mp4": return "m4a";
            case "audio/x-m4b": return "m4b";
            case "audio/aac":
            case "audio/aacp": return "aac";
            case "audio/ogg":
            case "application/ogg": return "ogg";
            case "audio/opus": return "opus";
            case "audio/flac":
            case "audio/x-flac": return "flac";
            case "audio/wav":
            case "audio/x-wav":
            case "audio/wave":
            case "audio/vnd.wave": return "wav";
            default: return null;
        }
    }

    private static String titleFrom(String displayName, String fallback, String format) {
        if (displayName == null) return fallback;
        String title = displayName.trim();
        String lowerTitle = title.toLowerCase(Locale.ROOT);
        if ("html".equals(format)) {
            if (lowerTitle.endsWith(".html")) title = title.substring(0, title.length() - 5).trim();
            else if (lowerTitle.endsWith(".htm")) title = title.substring(0, title.length() - 4).trim();
        } else if ("pdf".equals(format) && lowerTitle.endsWith(".pdf")) {
            title = title.substring(0, title.length() - 4).trim();
        } else if ("epub".equals(format) && lowerTitle.endsWith(".epub")) {
            title = title.substring(0, title.length() - 5).trim();
        } else if ("txt".equals(format) && lowerTitle.endsWith(".txt")) {
            title = title.substring(0, title.length() - 4).trim();
        } else if ("audio".equals(format)) {
            String extension = audioExtensionFromName(lowerTitle);
            if (extension != null) title = title.substring(0, title.length() - extension.length() - 1).trim();
        }
        return title.isEmpty() ? fallback : title;
    }

    private static String displayNameOr(ReadingImportSource source, String fallback) {
        if (source == null || source.getDisplayName() == null || source.getDisplayName().trim().isEmpty()) return fallback;
        return source.getDisplayName().trim();
    }

    private static String mimeFrom(String mimeType, String format, String sourceExtension) {
        if ("pdf".equals(format)) return "application/pdf";
        if ("epub".equals(format)) return "application/epub+zip";
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
        for (byte value : bytes) builder.append(String.format(Locale.ROOT, "%02x", value & 0xff));
        return builder.toString();
    }

    private static void closeGroupInputs(List<AudioGroupItem> items) {
        if (items == null) return;
        for (AudioGroupItem item : items) {
            if (item == null || item.getInput() == null) continue;
            try {
                item.getInput().close();
            } catch (IOException ignored) {
            }
        }
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

    private void safeDeleteRecord(String id) {
        try {
            repository.delete(id);
        } catch (RuntimeException ignored) {
        }
    }
}