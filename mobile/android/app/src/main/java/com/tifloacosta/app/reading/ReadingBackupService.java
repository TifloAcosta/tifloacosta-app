package com.tifloacosta.app.reading;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.LongSupplier;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

public final class ReadingBackupService {
    public static final int PACKAGE_VERSION = 1;
    public static final long REQUIRED_HEADROOM_BYTES = 16L * 1024L * 1024L;
    private static final String MANIFEST_ENTRY = "manifest.json";
    private static final int BUFFER_SIZE = 32 * 1024;
    private static final int MAX_MANIFEST_BYTES = 8 * 1024 * 1024;

    private final ReadingBookRepository repository;
    private final ReadingFileStore fileStore;
    private final LongSupplier clock;

    public ReadingBackupService(
            ReadingBookRepository repository,
            ReadingFileStore fileStore,
            LongSupplier clock
    ) {
        if (repository == null || fileStore == null || clock == null) {
            throw new IllegalArgumentException("Backup dependencies are required");
        }
        this.repository = repository;
        this.fileStore = fileStore;
        this.clock = clock;
    }

    public void exportAll(OutputStream output) throws IOException {
        exportSelected(output, null);
    }

    public void exportSelected(OutputStream output, List<String> selectedBookIds) throws IOException {
        if (output == null) throw new IllegalArgumentException("Backup output is required");
        List<ReadingBookRecord> books = selectedBooks(selectedBookIds);
        Set<String> selectedIds = new HashSet<>();
        for (ReadingBookRecord book : books) selectedIds.add(book.getId());

        Map<String, Integer> queueIndexes = new HashMap<>();
        for (ReadingQueueRecord queueRecord : repository.listQueue()) {
            if (selectedIds.contains(queueRecord.getBook().getId())) {
                queueIndexes.put(queueRecord.getBook().getId(), queueRecord.getQueueIndex());
            }
        }

        JSONArray bookArray = new JSONArray();
        List<ExportContent> contents = new ArrayList<>();
        int contentIndex = 0;
        for (ReadingBookRecord book : books) {
            String extension = extensionOf(book.getRelativePath(), fallbackExtension(book.getFormat()));
            String entryName = "content/" + contentIndex + "/source." + extension;
            ContentDigest digest;
            try (InputStream input = fileStore.openStoredInput(book.getRelativePath())) {
                digest = digest(input);
            }
            contents.add(new ExportContent(entryName, book.getRelativePath()));

            JSONObject json = bookJson(book);
            JSONObject content = new JSONObject();
            put(content, "entry", entryName);
            put(content, "sha256", digest.sha256);
            put(content, "size", digest.size);
            put(content, "extension", extension);
            put(json, "content", content);
            Integer queueIndex = queueIndexes.get(book.getId());
            put(json, "queued", queueIndex != null);
            if (queueIndex != null) put(json, "queueIndex", queueIndex);
            put(json, "marks", marksJson(book.getId()));
            put(json, "settings", settingsJson(book.getId()));
            bookArray.put(json);
            contentIndex += 1;
        }

        JSONObject manifest = new JSONObject();
        put(manifest, "format", "tifloacosta-reading-backup");
        put(manifest, "version", PACKAGE_VERSION);
        put(manifest, "createdAt", Math.max(0L, clock.getAsLong()));
        put(manifest, "books", bookArray);
        byte[] manifestBytes = manifest.toString().getBytes(StandardCharsets.UTF_8);

        try (ZipOutputStream zip = new ZipOutputStream(output)) {
            zip.putNextEntry(new ZipEntry(MANIFEST_ENTRY));
            zip.write(manifestBytes);
            zip.closeEntry();
            byte[] buffer = new byte[BUFFER_SIZE];
            for (ExportContent content : contents) {
                zip.putNextEntry(new ZipEntry(content.entryName));
                try (InputStream input = fileStore.openStoredInput(content.relativePath)) {
                    copy(input, zip, buffer);
                }
                zip.closeEntry();
            }
            zip.finish();
        }
    }

    public ReadingRestorePlan planRestore(InputStream input) throws IOException {
        ValidatedArchive archive = validateArchive(input, false);
        return archive.plan;
    }

    public void restore(InputStream input, ReadingRestorePlan approvedPlan) throws IOException {
        if (approvedPlan == null) throw new IllegalArgumentException("Restore plan is required");
        ValidatedArchive archive = validateArchive(input, true);
        if (!approvedPlan.getPackageFingerprint().equals(archive.plan.getPackageFingerprint())) {
            cleanupTemps(archive.stagedTemps.values());
            throw new BackupException("backup-changed", "The backup no longer matches the approved restore plan");
        }

        List<String> addedBookIds = new ArrayList<>();
        try {
            Map<String, String> restoredIdsBySha = new LinkedHashMap<>();
            for (BackupBook backup : archive.books) {
                ReadingBookRecord current = repository.findBySha256(backup.sha256);
                if (current == null) {
                    String id = UUID.randomUUID().toString();
                    String tempName = archive.stagedTemps.remove(backup.contentEntry);
                    if (tempName == null) {
                        throw new BackupException("integrity", "Validated content was not staged");
                    }
                    String relativePath = fileStore.moveTempToItem(
                            tempName,
                            id,
                            backup.format,
                            backup.extension
                    );
                    ReadingBookRecord restored = backup.toRecord(id, relativePath);
                    repository.insert(restored);
                    addedBookIds.add(id);
                    restoredIdsBySha.put(backup.sha256, id);
                    mergeMarks(id, backup.marks);
                    mergeSettings(id, backup.settings);
                } else {
                    restoredIdsBySha.put(backup.sha256, current.getId());
                    mergeExisting(current, backup, approvedPlan);
                }
            }

            List<BackupBook> queued = new ArrayList<>();
            for (BackupBook backup : archive.books) if (backup.queued) queued.add(backup);
            queued.sort(Comparator.comparingInt(book -> book.queueIndex));
            for (BackupBook backup : queued) {
                String id = restoredIdsBySha.get(backup.sha256);
                if (id != null && !repository.isQueued(id)) repository.addToQueue(id);
            }
        } catch (RuntimeException | IOException error) {
            for (String id : addedBookIds) {
                try { repository.delete(id); } catch (RuntimeException ignored) { }
                fileStore.deleteItemDirectory(id);
            }
            throw error;
        } finally {
            cleanupTemps(archive.stagedTemps.values());
        }
    }

    private ValidatedArchive validateArchive(InputStream input, boolean stageAdditions) throws IOException {
        if (input == null) throw new IllegalArgumentException("Backup input is required");
        Map<String, String> stagedTemps = new LinkedHashMap<>();
        try (ZipInputStream zip = new ZipInputStream(input)) {
            ZipEntry first = zip.getNextEntry();
            if (first == null || !MANIFEST_ENTRY.equals(first.getName()) || first.isDirectory()) {
                throw new BackupException("manifest", "Backup manifest must be the first entry");
            }
            byte[] manifestBytes = readLimited(zip, MAX_MANIFEST_BYTES);
            String fingerprint = sha256(manifestBytes);
            List<BackupBook> books = parseManifest(manifestBytes);
            Map<String, BackupBook> expectedByEntry = new LinkedHashMap<>();
            long requiredBytes = 0L;
            for (BackupBook book : books) {
                if (expectedByEntry.put(book.contentEntry, book) != null) {
                    throw new BackupException("manifest", "Backup contains duplicate content paths");
                }
                if (repository.findBySha256(book.sha256) == null) {
                    requiredBytes = safeAdd(requiredBytes, book.contentSize);
                }
            }
            ensureSpace(requiredBytes);

            Set<String> seen = new HashSet<>();
            byte[] buffer = new byte[BUFFER_SIZE];
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (entry.isDirectory()) continue;
                String name = entry.getName();
                if (!isSafeEntry(name)) throw new BackupException("integrity", "Unsafe backup entry");
                BackupBook expected = expectedByEntry.get(name);
                if (expected == null || !seen.add(name)) {
                    throw new BackupException("integrity", "Unexpected or duplicate backup content");
                }
                String tempName = null;
                OutputStream staged = null;
                if (stageAdditions && repository.findBySha256(expected.sha256) == null) {
                    tempName = "restore-" + UUID.randomUUID() + ".tmp";
                    staged = fileStore.openTemp(tempName);
                    stagedTemps.put(name, tempName);
                }
                ContentDigest actual;
                try {
                    actual = digestAndCopy(zip, staged, buffer);
                } finally {
                    if (staged != null) staged.close();
                }
                if (actual.size != expected.contentSize || !actual.sha256.equals(expected.contentSha256)) {
                    throw new BackupException("integrity", "Backup content hash does not match its manifest");
                }
            }
            if (seen.size() != expectedByEntry.size()) {
                throw new BackupException("integrity", "Backup content is incomplete");
            }
            ReadingRestorePlan plan = buildPlan(fingerprint, books);
            return new ValidatedArchive(books, plan, stagedTemps);
        } catch (BackupException error) {
            cleanupTemps(stagedTemps.values());
            throw error;
        } catch (JSONException error) {
            cleanupTemps(stagedTemps.values());
            throw new BackupException("manifest", "Backup manifest is invalid", error);
        } catch (IOException | RuntimeException error) {
            cleanupTemps(stagedTemps.values());
            throw error;
        }
    }

    private ReadingRestorePlan buildPlan(String fingerprint, List<BackupBook> books) {
        List<String> additions = new ArrayList<>();
        List<String> duplicates = new ArrayList<>();
        List<ReadingRestorePlan.PositionConflict> conflicts = new ArrayList<>();
        for (BackupBook backup : books) {
            ReadingBookRecord current = repository.findBySha256(backup.sha256);
            if (current == null) {
                additions.add(backup.sha256);
                continue;
            }
            duplicates.add(backup.sha256);
            if (hasPosition(current) && backup.hasPosition() && positionDiffers(current, backup)) {
                conflicts.add(new ReadingRestorePlan.PositionConflict(
                        backup.sha256,
                        current.getId(),
                        current.getBlockIndex(),
                        backup.blockIndex,
                        current.getPercent(),
                        backup.percent
                ));
            }
        }
        return new ReadingRestorePlan(fingerprint, additions, duplicates, conflicts);
    }

    private void mergeExisting(
            ReadingBookRecord current,
            BackupBook backup,
            ReadingRestorePlan plan
    ) {
        String mergedState = stateRank(backup.state) > stateRank(current.getState())
                ? backup.state
                : current.getState();
        boolean conflict = hasPosition(current) && backup.hasPosition() && positionDiffers(current, backup);
        boolean useBackup = conflict
                ? plan.positionChoice(backup.sha256) == ReadingRestorePlan.PositionChoice.USE_BACKUP
                : !hasPosition(current) && backup.hasPosition();
        int blockIndex = useBackup ? backup.blockIndex : current.getBlockIndex();
        int unitIndex = useBackup ? backup.unitIndex : current.getUnitIndex();
        String anchorText = useBackup ? backup.anchorText : current.getAnchorText();
        int mediaTrackIndex = useBackup ? backup.mediaTrackIndex : current.getMediaTrackIndex();
        long mediaPositionMs = useBackup ? backup.mediaPositionMs : current.getMediaPositionMs();
        double percent = useBackup ? backup.percent : current.getPercent();
        long lastReadAt = maxNullable(current.getLastReadAt(), backup.lastReadAt, clock.getAsLong());
        repository.updateProgress(
                current.getId(),
                blockIndex,
                unitIndex,
                anchorText,
                mediaTrackIndex,
                mediaPositionMs,
                percent,
                mergedState,
                lastReadAt
        );
        mergeMarks(current.getId(), backup.marks);
        mergeSettings(current.getId(), backup.settings);
    }

    private void mergeMarks(String bookId, List<BackupMark> incoming) {
        Set<String> existing = new HashSet<>();
        for (ReadingMarkRecord mark : repository.listMarks(bookId, null)) existing.add(markSignature(mark));
        for (BackupMark mark : incoming) {
            String signature = mark.signature();
            if (!existing.add(signature)) continue;
            repository.insertMark(new ReadingMarkRecord(
                    UUID.randomUUID().toString(),
                    bookId,
                    mark.type,
                    mark.blockIndex,
                    mark.unitIndex,
                    mark.mediaTrackIndex,
                    mark.mediaPositionMs,
                    mark.excerpt,
                    mark.reference,
                    mark.createdAt
            ));
        }
    }

    private void mergeSettings(String bookId, List<BackupSetting> incoming) {
        for (BackupSetting setting : incoming) {
            if (repository.getReadingSetting("book", bookId, setting.key) != null) continue;
            repository.setReadingSetting(new ReadingSettingsRecord(
                    "book",
                    bookId,
                    setting.key,
                    setting.value,
                    setting.updatedAt
            ));
        }
    }

    private List<ReadingBookRecord> selectedBooks(List<String> selectedBookIds) throws BackupException {
        if (selectedBookIds == null) {
            return repository.list(new ReadingBookQuery("", "all", "imported", Integer.MAX_VALUE, 0));
        }
        List<ReadingBookRecord> result = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (String id : selectedBookIds) {
            if (id == null || id.isEmpty() || !seen.add(id)) continue;
            ReadingBookRecord book = repository.findById(id);
            if (book == null) throw new BackupException("missing-book", "A selected book no longer exists");
            result.add(book);
        }
        return result;
    }

    private JSONObject bookJson(ReadingBookRecord book) throws BackupException {
        JSONObject json = new JSONObject();
        put(json, "sha256", book.getSha256());
        put(json, "title", book.getTitle());
        put(json, "author", book.getAuthor());
        put(json, "language", book.getLanguage());
        put(json, "format", book.getFormat());
        put(json, "mimeType", book.getMimeType());
        put(json, "sizeBytes", book.getSizeBytes());
        put(json, "importedAt", book.getImportedAt());
        if (book.getLastReadAt() != null) put(json, "lastReadAt", book.getLastReadAt());
        put(json, "state", book.getState());
        put(json, "blockIndex", book.getBlockIndex());
        put(json, "unitIndex", book.getUnitIndex());
        if (book.getAnchorText() != null) put(json, "anchorText", book.getAnchorText());
        put(json, "mediaTrackIndex", book.getMediaTrackIndex());
        put(json, "mediaPositionMs", book.getMediaPositionMs());
        put(json, "percent", book.getPercent());
        return json;
    }

    private JSONArray marksJson(String bookId) throws BackupException {
        JSONArray array = new JSONArray();
        for (ReadingMarkRecord mark : repository.listMarks(bookId, null)) {
            JSONObject json = new JSONObject();
            put(json, "type", mark.getType());
            put(json, "blockIndex", mark.getBlockIndex());
            put(json, "unitIndex", mark.getUnitIndex());
            put(json, "mediaTrackIndex", mark.getMediaTrackIndex());
            put(json, "mediaPositionMs", mark.getMediaPositionMs());
            if (mark.getExcerpt() != null) put(json, "excerpt", mark.getExcerpt());
            if (mark.getReference() != null) put(json, "reference", mark.getReference());
            put(json, "createdAt", mark.getCreatedAt());
            array.put(json);
        }
        return array;
    }

    private JSONArray settingsJson(String bookId) throws BackupException {
        JSONArray array = new JSONArray();
        for (ReadingSettingsRecord setting : repository.listReadingSettings("book", bookId)) {
            JSONObject json = new JSONObject();
            put(json, "key", setting.getKey());
            put(json, "value", setting.getValue());
            put(json, "updatedAt", setting.getUpdatedAt());
            array.put(json);
        }
        return array;
    }

    private List<BackupBook> parseManifest(byte[] bytes) throws BackupException, JSONException {
        JSONObject manifest = new JSONObject(new String(bytes, StandardCharsets.UTF_8));
        if (!"tifloacosta-reading-backup".equals(manifest.optString("format"))) {
            throw new BackupException("manifest", "Backup format is not recognized");
        }
        int version = manifest.optInt("version", -1);
        if (version != PACKAGE_VERSION) {
            throw new BackupException("version", "Unsupported backup version: " + version);
        }
        JSONArray array = manifest.getJSONArray("books");
        List<BackupBook> books = new ArrayList<>();
        Set<String> identities = new HashSet<>();
        for (int index = 0; index < array.length(); index++) {
            JSONObject json = array.getJSONObject(index);
            BackupBook book = BackupBook.fromJson(json);
            if (!identities.add(book.sha256)) {
                throw new BackupException("manifest", "Backup contains duplicate book identities");
            }
            books.add(book);
        }
        return books;
    }

    private void ensureSpace(long contentBytes) throws BackupException {
        long usable = fileStore.usableSpaceBytes();
        if (usable < contentBytes || usable - contentBytes < REQUIRED_HEADROOM_BYTES) {
            throw new BackupException("insufficient-space", "Not enough free space to restore this backup");
        }
    }

    private void cleanupTemps(Iterable<String> tempNames) {
        for (String tempName : tempNames) if (tempName != null) fileStore.deleteTemp(tempName);
    }

    private static boolean hasPosition(ReadingBookRecord book) {
        return book.getBlockIndex() > 0
                || book.getUnitIndex() > 0
                || book.getMediaTrackIndex() > 0
                || book.getMediaPositionMs() > 0L
                || book.getPercent() > 0d;
    }

    private static boolean positionDiffers(ReadingBookRecord current, BackupBook backup) {
        return current.getBlockIndex() != backup.blockIndex
                || current.getUnitIndex() != backup.unitIndex
                || current.getMediaTrackIndex() != backup.mediaTrackIndex
                || current.getMediaPositionMs() != backup.mediaPositionMs
                || Math.abs(current.getPercent() - backup.percent) > 0.0001d;
    }

    private static int stateRank(String state) {
        if ("read".equals(state)) return 2;
        if ("in-reading".equals(state)) return 1;
        return 0;
    }

    private static long maxNullable(Long current, Long backup, long fallback) {
        if (current == null && backup == null) return Math.max(0L, fallback);
        if (current == null) return backup;
        if (backup == null) return current;
        return Math.max(current, backup);
    }

    private static String markSignature(ReadingMarkRecord mark) {
        return mark.getType() + "\u0000" + mark.getBlockIndex() + "\u0000" + mark.getUnitIndex()
                + "\u0000" + mark.getMediaTrackIndex() + "\u0000" + mark.getMediaPositionMs()
                + "\u0000" + value(mark.getExcerpt()) + "\u0000" + value(mark.getReference());
    }

    private static String value(String text) { return text == null ? "" : text; }

    private static String extensionOf(String path, String fallback) {
        if (path != null) {
            int slash = path.lastIndexOf('/');
            int dot = path.lastIndexOf('.');
            if (dot > slash && dot + 1 < path.length()) {
                String candidate = path.substring(dot + 1).toLowerCase();
                if (candidate.matches("[a-z0-9]{1,8}")) return candidate;
            }
        }
        return fallback;
    }

    private static String fallbackExtension(String format) {
        if ("html".equals(format)) return "html";
        if ("pdf".equals(format)) return "pdf";
        if ("epub".equals(format)) return "epub";
        if ("docx".equals(format)) return "docx";
        if ("audio".equals(format)) return "m4a";
        if (format != null && format.startsWith("daisy")) return "zip";
        return "txt";
    }

    private static boolean isSafeEntry(String name) {
        if (name == null || name.isEmpty() || name.startsWith("/") || name.startsWith("\\")) return false;
        String normalized = name.replace('\\', '/');
        if (normalized.contains("../") || normalized.equals("..") || normalized.contains("/../")) return false;
        return normalized.startsWith("content/");
    }

    private static long safeAdd(long left, long right) throws BackupException {
        if (right < 0L || left > Long.MAX_VALUE - right) {
            throw new BackupException("manifest", "Backup size is invalid");
        }
        return left + right;
    }

    private static byte[] readLimited(InputStream input, int maxBytes) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        int total = 0;
        while ((read = input.read(buffer)) >= 0) {
            if (read == 0) continue;
            total += read;
            if (total > maxBytes) throw new BackupException("manifest", "Backup manifest is too large");
            output.write(buffer, 0, read);
        }
        return output.toByteArray();
    }

    private static ContentDigest digest(InputStream input) throws IOException {
        return digestAndCopy(input, null, new byte[BUFFER_SIZE]);
    }

    private static ContentDigest digestAndCopy(InputStream input, OutputStream output, byte[] buffer) throws IOException {
        MessageDigest digest = newDigest();
        long size = 0L;
        int read;
        while ((read = input.read(buffer)) >= 0) {
            if (read == 0) continue;
            digest.update(buffer, 0, read);
            if (output != null) output.write(buffer, 0, read);
            size += read;
        }
        return new ContentDigest(hex(digest.digest()), size);
    }

    private static String sha256(byte[] bytes) throws BackupException {
        MessageDigest digest = newDigest();
        digest.update(bytes);
        return hex(digest.digest());
    }

    private static MessageDigest newDigest() throws BackupException {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException error) {
            throw new BackupException("crypto", "SHA-256 is unavailable", error);
        }
    }

    private static String hex(byte[] bytes) {
        StringBuilder output = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) output.append(String.format("%02x", value & 0xff));
        return output.toString();
    }

    private static void copy(InputStream input, OutputStream output, byte[] buffer) throws IOException {
        int read;
        while ((read = input.read(buffer)) >= 0) if (read > 0) output.write(buffer, 0, read);
    }

    private static void put(JSONObject json, String key, Object value) throws BackupException {
        try {
            json.put(key, value);
        } catch (JSONException error) {
            throw new BackupException("manifest", "Unable to build backup manifest", error);
        }
    }

    public static final class BackupException extends IOException {
        private final String reason;

        public BackupException(String reason, String message) {
            super(message);
            this.reason = reason;
        }

        public BackupException(String reason, String message, Throwable cause) {
            super(message, cause);
            this.reason = reason;
        }

        public String getReason() { return reason; }
    }

    private static final class ExportContent {
        private final String entryName;
        private final String relativePath;
        private ExportContent(String entryName, String relativePath) {
            this.entryName = entryName;
            this.relativePath = relativePath;
        }
    }

    private static final class ContentDigest {
        private final String sha256;
        private final long size;
        private ContentDigest(String sha256, long size) {
            this.sha256 = sha256;
            this.size = size;
        }
    }

    private static final class ValidatedArchive {
        private final List<BackupBook> books;
        private final ReadingRestorePlan plan;
        private final Map<String, String> stagedTemps;
        private ValidatedArchive(
                List<BackupBook> books,
                ReadingRestorePlan plan,
                Map<String, String> stagedTemps
        ) {
            this.books = books;
            this.plan = plan;
            this.stagedTemps = stagedTemps;
        }
    }

    private static final class BackupBook {
        private final String sha256;
        private final String title;
        private final String author;
        private final String language;
        private final String format;
        private final String mimeType;
        private final long sizeBytes;
        private final long importedAt;
        private final Long lastReadAt;
        private final String state;
        private final int blockIndex;
        private final int unitIndex;
        private final String anchorText;
        private final int mediaTrackIndex;
        private final long mediaPositionMs;
        private final double percent;
        private final String contentEntry;
        private final String contentSha256;
        private final long contentSize;
        private final String extension;
        private final boolean queued;
        private final int queueIndex;
        private final List<BackupMark> marks;
        private final List<BackupSetting> settings;

        private BackupBook(
                String sha256,
                String title,
                String author,
                String language,
                String format,
                String mimeType,
                long sizeBytes,
                long importedAt,
                Long lastReadAt,
                String state,
                int blockIndex,
                int unitIndex,
                String anchorText,
                int mediaTrackIndex,
                long mediaPositionMs,
                double percent,
                String contentEntry,
                String contentSha256,
                long contentSize,
                String extension,
                boolean queued,
                int queueIndex,
                List<BackupMark> marks,
                List<BackupSetting> settings
        ) {
            this.sha256 = sha256;
            this.title = title;
            this.author = author;
            this.language = language;
            this.format = format;
            this.mimeType = mimeType;
            this.sizeBytes = sizeBytes;
            this.importedAt = importedAt;
            this.lastReadAt = lastReadAt;
            this.state = state;
            this.blockIndex = blockIndex;
            this.unitIndex = unitIndex;
            this.anchorText = anchorText;
            this.mediaTrackIndex = mediaTrackIndex;
            this.mediaPositionMs = mediaPositionMs;
            this.percent = percent;
            this.contentEntry = contentEntry;
            this.contentSha256 = contentSha256;
            this.contentSize = contentSize;
            this.extension = extension;
            this.queued = queued;
            this.queueIndex = queueIndex;
            this.marks = marks;
            this.settings = settings;
        }

        private static BackupBook fromJson(JSONObject json) throws JSONException, BackupException {
            String sha = requiredText(json, "sha256");
            String state = requiredText(json, "state");
            if (stateRank(state) == 0 && !"not-read".equals(state)) {
                throw new BackupException("manifest", "Backup contains an invalid reading state");
            }
            JSONObject content = json.getJSONObject("content");
            String entry = requiredText(content, "entry");
            if (!isSafeEntry(entry)) throw new BackupException("manifest", "Backup content path is unsafe");
            String contentSha = requiredText(content, "sha256");
            if (!contentSha.matches("[0-9a-fA-F]{64}")) {
                throw new BackupException("manifest", "Backup content hash is invalid");
            }
            long contentSize = content.getLong("size");
            if (contentSize < 0L) throw new BackupException("manifest", "Backup content size is invalid");
            String extension = requiredText(content, "extension").toLowerCase();
            if (!extension.matches("[a-z0-9]{1,8}")) {
                throw new BackupException("manifest", "Backup content extension is invalid");
            }
            JSONArray markArray = json.optJSONArray("marks");
            List<BackupMark> marks = new ArrayList<>();
            if (markArray != null) {
                for (int i = 0; i < markArray.length(); i++) marks.add(BackupMark.fromJson(markArray.getJSONObject(i)));
            }
            JSONArray settingArray = json.optJSONArray("settings");
            List<BackupSetting> settings = new ArrayList<>();
            if (settingArray != null) {
                for (int i = 0; i < settingArray.length(); i++) settings.add(BackupSetting.fromJson(settingArray.getJSONObject(i)));
            }
            boolean queued = json.optBoolean("queued", false);
            int queueIndex = queued ? Math.max(0, json.optInt("queueIndex", Integer.MAX_VALUE)) : Integer.MAX_VALUE;
            return new BackupBook(
                    sha,
                    json.optString("title", ""),
                    json.optString("author", ""),
                    json.optString("language", ""),
                    requiredText(json, "format"),
                    json.optString("mimeType", "application/octet-stream"),
                    Math.max(0L, json.optLong("sizeBytes", contentSize)),
                    Math.max(0L, json.optLong("importedAt", 0L)),
                    json.has("lastReadAt") ? Math.max(0L, json.getLong("lastReadAt")) : null,
                    state,
                    Math.max(0, json.optInt("blockIndex", 0)),
                    Math.max(0, json.optInt("unitIndex", 0)),
                    json.has("anchorText") ? json.optString("anchorText", null) : null,
                    Math.max(0, json.optInt("mediaTrackIndex", 0)),
                    Math.max(0L, json.optLong("mediaPositionMs", 0L)),
                    Math.max(0d, Math.min(100d, json.optDouble("percent", 0d))),
                    entry,
                    contentSha.toLowerCase(),
                    contentSize,
                    extension,
                    queued,
                    queueIndex,
                    marks,
                    settings
            );
        }

        private ReadingBookRecord toRecord(String id, String relativePath) {
            return new ReadingBookRecord(
                    id,
                    sha256,
                    title,
                    author,
                    language,
                    format,
                    mimeType,
                    relativePath,
                    sizeBytes,
                    importedAt,
                    lastReadAt,
                    state,
                    blockIndex,
                    unitIndex,
                    anchorText,
                    mediaTrackIndex,
                    mediaPositionMs,
                    percent
            );
        }

        private boolean hasPosition() {
            return blockIndex > 0 || unitIndex > 0 || mediaTrackIndex > 0 || mediaPositionMs > 0L || percent > 0d;
        }
    }

    private static final class BackupMark {
        private final String type;
        private final int blockIndex;
        private final int unitIndex;
        private final int mediaTrackIndex;
        private final long mediaPositionMs;
        private final String excerpt;
        private final String reference;
        private final long createdAt;

        private BackupMark(
                String type,
                int blockIndex,
                int unitIndex,
                int mediaTrackIndex,
                long mediaPositionMs,
                String excerpt,
                String reference,
                long createdAt
        ) {
            this.type = type;
            this.blockIndex = blockIndex;
            this.unitIndex = unitIndex;
            this.mediaTrackIndex = mediaTrackIndex;
            this.mediaPositionMs = mediaPositionMs;
            this.excerpt = excerpt;
            this.reference = reference;
            this.createdAt = createdAt;
        }

        private static BackupMark fromJson(JSONObject json) throws JSONException, BackupException {
            return new BackupMark(
                    requiredText(json, "type"),
                    Math.max(0, json.optInt("blockIndex", 0)),
                    Math.max(0, json.optInt("unitIndex", 0)),
                    Math.max(0, json.optInt("mediaTrackIndex", 0)),
                    Math.max(0L, json.optLong("mediaPositionMs", 0L)),
                    json.has("excerpt") ? json.optString("excerpt", null) : null,
                    json.has("reference") ? json.optString("reference", null) : null,
                    Math.max(0L, json.optLong("createdAt", 0L))
            );
        }

        private String signature() {
            return type + "\u0000" + blockIndex + "\u0000" + unitIndex + "\u0000" + mediaTrackIndex
                    + "\u0000" + mediaPositionMs + "\u0000" + value(excerpt) + "\u0000" + value(reference);
        }
    }

    private static final class BackupSetting {
        private final String key;
        private final String value;
        private final long updatedAt;

        private BackupSetting(String key, String value, long updatedAt) {
            this.key = key;
            this.value = value;
            this.updatedAt = updatedAt;
        }

        private static BackupSetting fromJson(JSONObject json) throws JSONException, BackupException {
            return new BackupSetting(
                    requiredText(json, "key"),
                    json.optString("value", ""),
                    Math.max(0L, json.optLong("updatedAt", 0L))
            );
        }
    }

    private static String requiredText(JSONObject json, String key) throws JSONException, BackupException {
        String value = json.getString(key);
        if (value == null || value.trim().isEmpty()) {
            throw new BackupException("manifest", "Backup manifest is missing " + key);
        }
        return value;
    }
}
