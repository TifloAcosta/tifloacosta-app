package com.tifloacosta.app.reading;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
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

    private static final class ZipAudio {
        private final String entryPath;
        private final String extension;
        private final File file;
        private final long sizeBytes;
        private final ReadingAudioProbe.Result info;

        private ZipAudio(
                String entryPath,
                String extension,
                File file,
                long sizeBytes,
                ReadingAudioProbe.Result info
        ) {
            this.entryPath = entryPath;
            this.extension = extension;
            this.file = file;
            this.sizeBytes = sizeBytes;
            this.info = info;
        }
    }

    private static final class ZipPackage {
        private final ReadingPackageExtractor.Extraction extraction;
        private final ReadingDaisyBook daisy;
        private final List<ZipAudio> audio;

        private ZipPackage(
                ReadingPackageExtractor.Extraction extraction,
                ReadingDaisyBook daisy,
                List<ZipAudio> audio
        ) {
            this.extraction = extraction;
            this.daisy = daisy;
            this.audio = audio == null ? Collections.emptyList() : audio;
        }

        private boolean isDaisy() { return daisy != null; }
        private boolean isAudio() { return !audio.isEmpty(); }
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
        String detectedFormat = formatFrom(source);
        String sourceExtension = sourceExtensionFrom(source, detectedFormat);
        if (detectedFormat == null
                || ("pdf".equals(detectedFormat) && pdfExtractor == null)
                || ("audio".equals(detectedFormat) && audioProbe == null)) {
            return ReadingImportResult.rejected("unsupported");
        }

        if (!hasSpaceFor(source == null ? null : source.getDeclaredSizeBytes())) {
            return ReadingImportResult.rejected("insufficient-space");
        }

        String tempName = UUID.randomUUID() + ".tmp";
        boolean movedToFinal = false;
        ZipPackage zipPackage = null;

        try {
            MessageDigest digest = sha256();
            long actualSize = copyToTemp(input, tempName, digest);
            String hash = toHex(digest.digest());

            ReadingAudioProbe.Result audioInfo = null;
            ReadingStructuredDocument structuredInfo = null;
            String recordFormat = detectedFormat;

            if ("pdf".equals(detectedFormat)) {
                ReadingImportResult pdfValidation = validatePdf(tempName);
                if (pdfValidation != null) return pdfValidation;
            } else if ("audio".equals(detectedFormat)) {
                audioInfo = validateAudio(tempName);
                if (audioInfo == null || !audioInfo.isReadable()) {
                    return ReadingImportResult.rejected("invalid-audio");
                }
            } else if ("epub".equals(detectedFormat)) {
                try {
                    structuredInfo = validateEpub(tempName);
                } catch (ReadingEpubAdapter.EpubException error) {
                    return ReadingImportResult.rejected(error.getCode());
                }
            } else if ("docx".equals(detectedFormat)) {
                try {
                    structuredInfo = validateDocx(tempName);
                } catch (ReadingDocxAdapter.DocxException error) {
                    return ReadingImportResult.rejected(error.getCode());
                }
            } else if ("pptx".equals(detectedFormat)) {
                try {
                    structuredInfo = validatePptx(tempName);
                } catch (ReadingPptxAdapter.PptxException error) {
                    return ReadingImportResult.rejected(error.getCode());
                }
            } else if ("xlsx".equals(detectedFormat)) {
                try {
                    structuredInfo = validateXlsx(tempName);
                } catch (ReadingXlsxAdapter.XlsxException error) {
                    return ReadingImportResult.rejected(error.getCode());
                }
            } else if ("zip".equals(detectedFormat)) {
                try {
                    zipPackage = inspectZip(tempName);
                } catch (ReadingPackageExtractor.PackageException error) {
                    return ReadingImportResult.rejected(error.getCode());
                } catch (ReadingDaisyAdapter.DaisyException error) {
                    return ReadingImportResult.rejected(error.getCode());
                }
                if (zipPackage.isAudio()) {
                    return finishZipAudioImport(source, tempName, hash, zipPackage);
                }
                if (!zipPackage.isDaisy()) return ReadingImportResult.rejected("ambiguous-zip");
                if (zipPackage.daisy.hasAudio() && audioProbe == null) {
                    return ReadingImportResult.rejected("unsupported");
                }
                recordFormat = zipPackage.daisy.getFormat();
                structuredInfo = zipPackage.daisy.getDocument();
                sourceExtension = "zip";
            } else if (!fileStore.tempHasReadableText(tempName, detectedFormat)) {
                return ReadingImportResult.rejected("empty");
            }

            ReadingBookRecord existing = repository.findBySha256(hash);
            if (existing != null) return ReadingImportResult.duplicate(existing.getId());

            String id = UUID.randomUUID().toString();
            String relativePath = fileStore.moveTempToItem(tempName, id, recordFormat, sourceExtension);
            movedToFinal = true;

            String fallbackTitle = titleFrom(source == null ? null : source.getDisplayName(), id, detectedFormat);
            String title = audioInfo != null && audioInfo.getTitle() != null && !audioInfo.getTitle().trim().isEmpty()
                    ? audioInfo.getTitle().trim()
                    : structuredInfo != null && !structuredInfo.getTitle().isEmpty()
                    ? structuredInfo.getTitle()
                    : fallbackTitle;
            String author = structuredInfo == null ? "" : structuredInfo.getAuthor();
            String language = structuredInfo == null ? "" : structuredInfo.getLanguage();

            List<ReadingAudioTrackRecord> packageTracks = Collections.emptyList();
            if (zipPackage != null && zipPackage.isDaisy() && zipPackage.daisy.hasAudio()) {
                packageTracks = persistDaisyAudioTracks(id, zipPackage);
            }

            ReadingBookRecord record = new ReadingBookRecord(
                    id,
                    hash,
                    title,
                    author,
                    language,
                    recordFormat,
                    mimeFrom(source == null ? null : source.getMimeType(), recordFormat, sourceExtension),
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
                } else if (!packageTracks.isEmpty()) {
                    insertAudioTracksIfSupported(id, packageTracks);
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
            cleanupZipPackage(zipPackage);
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
                String relativePath = fileStore.moveTempToAudioTrack(track.tempName, id, index, track.extension);
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
            for (StagedAudio track : staged) safeDeleteTemp(track.tempName);
        }
    }

    public static boolean isAudioSource(ReadingImportSource source) {
        return "audio".equals(formatFrom(source));
    }

    public void cleanupStaleTemps() {
        fileStore.cleanupStaleTemps();
    }

    private ReadingImportResult finishZipAudioImport(
            ReadingImportSource source,
            String packageTempName,
            String hash,
            ZipPackage zipPackage
    ) throws IOException {
        ReadingBookRecord existing = repository.findBySha256(hash);
        if (existing != null) return ReadingImportResult.duplicate(existing.getId());

        String id = UUID.randomUUID().toString();
        List<String> stagedTemps = new ArrayList<>();
        try {
            List<ReadingAudioTrackRecord> records = new ArrayList<>();
            String firstPath = null;
            long totalSize = 0L;
            for (int index = 0; index < zipPackage.audio.size(); index++) {
                ZipAudio track = zipPackage.audio.get(index);
                String staged = UUID.randomUUID() + ".tmp";
                stagedTemps.add(staged);
                copyFileToTemp(track.file, staged);
                String relativePath = fileStore.moveTempToAudioTrack(staged, id, index, track.extension);
                stagedTemps.remove(staged);
                if (firstPath == null) firstPath = relativePath;
                totalSize = safeAdd(totalSize, track.sizeBytes);
                records.add(new ReadingAudioTrackRecord(
                        id,
                        index,
                        relativePath,
                        fileName(track.entryPath),
                        track.info.getTitle(),
                        track.info.getDurationMs(),
                        track.info.getTrackNumber(),
                        track.sizeBytes
                ));
            }

            String title = titleFrom(source == null ? null : source.getDisplayName(), id, "zip");
            ReadingBookRecord record = new ReadingBookRecord(
                    id,
                    hash,
                    title,
                    "",
                    "",
                    "audio",
                    "audio/*",
                    firstPath == null ? "" : firstPath,
                    totalSize,
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
                repository.insertAudioTracks(id, records);
            } catch (RuntimeException error) {
                safeDeleteRecord(id);
                safeDeleteItem(id);
                return ReadingImportResult.rejected("storage-error");
            }
            return ReadingImportResult.imported(id);
        } catch (IOException | RuntimeException error) {
            safeDeleteRecord(id);
            safeDeleteItem(id);
            return ReadingImportResult.rejected("storage-error");
        } finally {
            for (String staged : stagedTemps) safeDeleteTemp(staged);
            safeDeleteTemp(packageTempName);
        }
    }

    private ZipPackage inspectZip(String tempName) throws IOException {
        File tempFile = fileStore.tempFile(tempName);
        File parent = tempFile.getParentFile();
        if (parent == null) throw new IOException("Reading ZIP temp directory is unavailable");
        File workRoot = new File(parent, "zip-work");
        ReadingPackageExtractor.Extraction extraction;
        try (InputStream source = fileStore.openTempInput(tempName)) {
            extraction = new ReadingPackageExtractor().extract(source, workRoot, Collections.emptyList());
        }

        try {
            if (looksLikeDaisy(extraction.getEntries())) {
                ReadingDaisyBook daisy;
                try (InputStream source = fileStore.openTempInput(tempName)) {
                    daisy = new ReadingDaisyAdapter().read(source, new File(parent, "zip-daisy-work"));
                }
                return new ZipPackage(extraction, daisy, Collections.emptyList());
            }

            if (audioProbe == null) {
                cleanupExtraction(extraction);
                return new ZipPackage(null, null, Collections.emptyList());
            }

            List<ZipAudio> audio = new ArrayList<>();
            for (String entry : extraction.getEntries()) {
                String extension = audioExtensionFromName(entry.toLowerCase(Locale.ROOT));
                if (extension == null) {
                    cleanupExtraction(extraction);
                    throw new PackageRoutingException("ambiguous-zip", "ZIP mixes audio with unsupported content");
                }
                File file = safeExtractedFile(extraction.getRoot(), entry);
                ReadingAudioProbe.Result info = audioProbe.inspect(file);
                if (info == null || !info.isReadable()) {
                    cleanupExtraction(extraction);
                    throw new PackageRoutingException("invalid-audio", "ZIP contains unreadable audio");
                }
                audio.add(new ZipAudio(entry, extension, file, file.length(), info));
            }
            if (audio.size() < 2) {
                cleanupExtraction(extraction);
                throw new PackageRoutingException("ambiguous-zip", "Audio ZIP must contain at least two tracks");
            }
            if (!orderZipAudio(audio)) {
                cleanupExtraction(extraction);
                throw new PackageRoutingException("ambiguous-audio-order", "ZIP audio order is ambiguous");
            }
            return new ZipPackage(extraction, null, audio);
        } catch (IOException | RuntimeException error) {
            if (extraction != null && extraction.getRoot().exists()) cleanupExtraction(extraction);
            throw error;
        }
    }

    private List<ReadingAudioTrackRecord> persistDaisyAudioTracks(String id, ZipPackage zipPackage) throws IOException {
        List<ReadingAudioTrackRecord> records = new ArrayList<>();
        List<String> stagedTemps = new ArrayList<>();
        try {
            int index = 0;
            for (ReadingDaisyBook.AudioTrack item : zipPackage.daisy.getAudioTracks()) {
                String path = stripFragmentAndQuery(item.getHref());
                File file = safeExtractedFile(zipPackage.extraction.getRoot(), path);
                String extension = audioExtensionFromName(path.toLowerCase(Locale.ROOT));
                if (extension == null) throw new IOException("Unsupported DAISY audio type");
                ReadingAudioProbe.Result info = audioProbe.inspect(file);
                if (info == null || !info.isReadable()) throw new IOException("Unreadable DAISY audio");
                String staged = UUID.randomUUID() + ".tmp";
                stagedTemps.add(staged);
                copyFileToTemp(file, staged);
                String relativePath = fileStore.moveTempToAudioTrack(staged, id, index, extension);
                stagedTemps.remove(staged);
                records.add(new ReadingAudioTrackRecord(
                        id,
                        index,
                        relativePath,
                        fileName(path),
                        item.getTitle().isEmpty() ? info.getTitle() : item.getTitle(),
                        info.getDurationMs(),
                        info.getTrackNumber(),
                        file.length()
                ));
                index++;
            }
            return records;
        } finally {
            for (String staged : stagedTemps) safeDeleteTemp(staged);
        }
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

    private void copyFileToTemp(File source, String tempName) throws IOException {
        try (InputStream input = new FileInputStream(source); OutputStream output = fileStore.openTemp(tempName)) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) {
                if (read > 0) output.write(buffer, 0, read);
            }
        }
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
            if (track.info.getTrackNumber() != null) numbered++;
            String normalizedName = displayNameOr(track.source, "").trim().toLowerCase(Locale.ROOT);
            if (normalizedName.isEmpty() || !names.add(normalizedName)) return false;
        }
        if (numbered != 0 && numbered != tracks.size()) return false;
        Comparator<StagedAudio> byName = (left, right) -> naturalCompare(
                displayNameOr(left.source, ""), displayNameOr(right.source, "")
        );
        if (numbered == tracks.size()) {
            tracks.sort((left, right) -> {
                int compared = Integer.compare(left.info.getTrackNumber(), right.info.getTrackNumber());
                return compared != 0 ? compared : byName.compare(left, right);
            });
        } else tracks.sort(byName);
        return true;
    }

    private static boolean orderZipAudio(List<ZipAudio> tracks) {
        int numbered = 0;
        Set<String> names = new HashSet<>();
        for (ZipAudio track : tracks) {
            if (track.info.getTrackNumber() != null) numbered++;
            String name = track.entryPath.toLowerCase(Locale.ROOT);
            if (!names.add(name)) return false;
        }
        if (numbered != 0 && numbered != tracks.size()) return false;
        Comparator<ZipAudio> byName = (left, right) -> naturalCompare(left.entryPath, right.entryPath);
        if (numbered == tracks.size()) {
            tracks.sort((left, right) -> {
                int compared = Integer.compare(left.info.getTrackNumber(), right.info.getTrackNumber());
                return compared != 0 ? compared : byName.compare(left, right);
            });
        } else tracks.sort(byName);
        return true;
    }

    private static int naturalCompare(String left, String right) {
        String a = left == null ? "" : left;
        String b = right == null ? "" : right;
        int ai = 0, bi = 0;
        while (ai < a.length() && bi < b.length()) {
            char ac = a.charAt(ai), bc = b.charAt(bi);
            if (Character.isDigit(ac) && Character.isDigit(bc)) {
                int aStart = ai, bStart = bi;
                while (ai < a.length() && Character.isDigit(a.charAt(ai))) ai++;
                while (bi < b.length() && Character.isDigit(b.charAt(bi))) bi++;
                String an = a.substring(aStart, ai).replaceFirst("^0+(?!$)", "");
                String bn = b.substring(bStart, bi).replaceFirst("^0+(?!$)", "");
                if (an.length() != bn.length()) return Integer.compare(an.length(), bn.length());
                int compared = an.compareTo(bn);
                if (compared != 0) return compared;
                continue;
            }
            int compared = Character.compare(Character.toLowerCase(ac), Character.toLowerCase(bc));
            if (compared != 0) return compared;
            ai++; bi++;
        }
        return Integer.compare(a.length(), b.length());
    }

    private static String groupTitle(List<StagedAudio> staged, String fallback) {
        String album = null;
        boolean sameAlbum = true;
        for (StagedAudio track : staged) {
            String current = track.info.getAlbum();
            if (current == null) { sameAlbum = false; break; }
            if (album == null) album = current;
            else if (!album.equalsIgnoreCase(current)) { sameAlbum = false; break; }
        }
        if (sameAlbum && album != null && !album.trim().isEmpty()) return album.trim();
        return titleFrom(staged.get(0).source.getDisplayName(), fallback, "audio");
    }

    private void insertAudioTracksIfSupported(String id, List<ReadingAudioTrackRecord> tracks) {
        try { repository.insertAudioTracks(id, tracks); } catch (UnsupportedOperationException ignored) { }
    }

    private ReadingImportResult validatePdf(String tempName) throws IOException {
        try (InputStream source = fileStore.openTempInput(tempName)) {
            ReadingPdfResult result = pdfExtractor.inspect(source, "");
            if (ReadingPdfResult.STATUS_READABLE.equals(result.getStatus())
                    || ReadingPdfResult.STATUS_PASSWORD_REQUIRED.equals(result.getStatus())) return null;
            if (ReadingPdfResult.STATUS_NO_TEXT.equals(result.getStatus())) return ReadingImportResult.rejected("pdf-no-text");
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
        } finally { deleteTreeIfEmpty(workRoot); }
    }

    private ReadingStructuredDocument validateDocx(String tempName) throws IOException {
        File tempFile = fileStore.tempFile(tempName);
        File parent = tempFile.getParentFile();
        if (parent == null) throw new IOException("Reading DOCX temp directory is unavailable");
        File workRoot = new File(parent, "docx-work");
        try (InputStream source = fileStore.openTempInput(tempName)) {
            return new ReadingDocxAdapter().read(source, workRoot);
        } finally { deleteTreeIfEmpty(workRoot); }
    }

    private ReadingStructuredDocument validatePptx(String tempName) throws IOException {
        try (InputStream source = fileStore.openTempInput(tempName)) {
            return new ReadingPptxAdapter().read(source);
        }
    }

    private ReadingStructuredDocument validateXlsx(String tempName) throws IOException {
        try (InputStream source = fileStore.openTempInput(tempName)) {
            return new ReadingXlsxAdapter().read(source);
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
        if (lowerName.endsWith(".docx")) return "docx";
        if (lowerName.endsWith(".pptx")) return "pptx";
        if (lowerName.endsWith(".xlsx")) return "xlsx";
        if (lowerName.endsWith(".zip")) return "zip";
        if (lowerName.endsWith(".html") || lowerName.endsWith(".htm")) return "html";
        if (lowerName.endsWith(".txt")) return "txt";
        if (audioExtensionFrom(source) != null && audioExtensionFromName(lowerName) != null) return "audio";

        if ("application/pdf".equals(lowerMime)) return "pdf";
        if ("application/epub+zip".equals(lowerMime)) return "epub";
        if ("application/vnd.openxmlformats-officedocument.wordprocessingml.document".equals(lowerMime)) return "docx";
        if ("application/vnd.openxmlformats-officedocument.presentationml.presentation".equals(lowerMime)) return "pptx";
        if ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".equals(lowerMime)) return "xlsx";
        if ("application/zip".equals(lowerMime) || "application/x-zip-compressed".equals(lowerMime)) return "zip";
        if ("text/html".equals(lowerMime)) return "html";
        if ("text/plain".equals(lowerMime)) return "txt";
        if (audioExtensionFromMime(lowerMime) != null) return "audio";
        return null;
    }

    private static String sourceExtensionFrom(ReadingImportSource source, String format) {
        if ("html".equals(format)) return "html";
        if ("pdf".equals(format)) return "pdf";
        if ("epub".equals(format)) return "epub";
        if ("docx".equals(format)) return "docx";
        if ("pptx".equals(format)) return "pptx";
        if ("xlsx".equals(format)) return "xlsx";
        if ("zip".equals(format) || "daisy2.02".equals(format) || "daisy3".equals(format)) return "zip";
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
            case "audio/mpeg": case "audio/mp3": return "mp3";
            case "audio/mp4": case "audio/x-m4a": case "application/mp4": return "m4a";
            case "audio/x-m4b": return "m4b";
            case "audio/aac": case "audio/aacp": return "aac";
            case "audio/ogg": case "application/ogg": return "ogg";
            case "audio/opus": return "opus";
            case "audio/flac": case "audio/x-flac": return "flac";
            case "audio/wav": case "audio/x-wav": case "audio/wave": case "audio/vnd.wave": return "wav";
            default: return null;
        }
    }

    private static String titleFrom(String displayName, String fallback, String format) {
        if (displayName == null) return fallback;
        String title = displayName.trim();
        String lower = title.toLowerCase(Locale.ROOT);
        String extension = null;
        if ("html".equals(format)) extension = lower.endsWith(".html") ? ".html" : lower.endsWith(".htm") ? ".htm" : null;
        else if ("pdf".equals(format) && lower.endsWith(".pdf")) extension = ".pdf";
        else if ("epub".equals(format) && lower.endsWith(".epub")) extension = ".epub";
        else if ("docx".equals(format) && lower.endsWith(".docx")) extension = ".docx";
        else if ("pptx".equals(format) && lower.endsWith(".pptx")) extension = ".pptx";
        else if ("xlsx".equals(format) && lower.endsWith(".xlsx")) extension = ".xlsx";
        else if ("zip".equals(format) && lower.endsWith(".zip")) extension = ".zip";
        else if ("txt".equals(format) && lower.endsWith(".txt")) extension = ".txt";
        else if ("audio".equals(format)) {
            String audioExtension = audioExtensionFromName(lower);
            if (audioExtension != null) extension = "." + audioExtension;
        }
        if (extension != null) title = title.substring(0, title.length() - extension.length()).trim();
        return title.isEmpty() ? fallback : title;
    }

    private static String displayNameOr(ReadingImportSource source, String fallback) {
        if (source == null || source.getDisplayName() == null || source.getDisplayName().trim().isEmpty()) return fallback;
        return source.getDisplayName().trim();
    }

    private static String mimeFrom(String mimeType, String format, String sourceExtension) {
        if ("pdf".equals(format)) return "application/pdf";
        if ("epub".equals(format)) return "application/epub+zip";
        if ("docx".equals(format)) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if ("pptx".equals(format)) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        if ("xlsx".equals(format)) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        if ("daisy2.02".equals(format) || "daisy3".equals(format) || "zip".equals(format)) return "application/zip";
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
            case "m4a": case "m4b": return "audio/mp4";
            case "aac": return "audio/aac";
            case "ogg": return "audio/ogg";
            case "opus": return "audio/opus";
            case "flac": return "audio/flac";
            case "wav": return "audio/wav";
            default: return "audio/*";
        }
    }

    private static boolean looksLikeDaisy(List<String> entries) {
        for (String entry : entries) {
            String lower = entry.toLowerCase(Locale.ROOT);
            if (lower.equals("ncc.html") || lower.equals("ncc.htm")
                    || lower.endsWith("/ncc.html") || lower.endsWith("/ncc.htm")
                    || lower.endsWith(".opf")) return true;
        }
        return false;
    }

    private static File safeExtractedFile(File root, String relativePath) throws IOException {
        File file = new File(root, stripFragmentAndQuery(relativePath).replace('/', File.separatorChar));
        String rootPath = root.getCanonicalPath();
        String filePath = file.getCanonicalPath();
        if (!filePath.startsWith(rootPath + File.separator) || !file.isFile()) {
            throw new IOException("Invalid extracted reading package path");
        }
        return file;
    }

    private static String stripFragmentAndQuery(String value) {
        if (value == null) return "";
        int end = value.length();
        int hash = value.indexOf('#');
        int query = value.indexOf('?');
        if (hash >= 0) end = Math.min(end, hash);
        if (query >= 0) end = Math.min(end, query);
        return value.substring(0, end);
    }

    private static String fileName(String path) {
        String value = stripFragmentAndQuery(path);
        int slash = value.lastIndexOf('/');
        return slash >= 0 ? value.substring(slash + 1) : value;
    }

    private static long safeAdd(long left, long right) {
        if (right > 0 && left > Long.MAX_VALUE - right) return Long.MAX_VALUE;
        return left + Math.max(0L, right);
    }

    private static MessageDigest sha256() {
        try { return MessageDigest.getInstance("SHA-256"); }
        catch (NoSuchAlgorithmException error) { throw new IllegalStateException("SHA-256 unavailable", error); }
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
            try { item.getInput().close(); } catch (IOException ignored) { }
        }
    }

    private void cleanupZipPackage(ZipPackage zipPackage) {
        if (zipPackage != null && zipPackage.extraction != null) cleanupExtraction(zipPackage.extraction);
    }

    private static void cleanupExtraction(ReadingPackageExtractor.Extraction extraction) {
        if (extraction != null) deleteTree(extraction.getRoot());
    }

    private static void deleteTreeIfEmpty(File directory) {
        File[] remaining = directory == null ? null : directory.listFiles();
        if (remaining == null || remaining.length == 0) {
            if (directory != null) directory.delete();
        }
    }

    private static void deleteTree(File file) {
        if (file == null || !file.exists()) return;
        File[] children = file.listFiles();
        if (children != null) for (File child : children) deleteTree(child);
        file.delete();
    }

    private void safeDeleteTemp(String tempName) {
        try { fileStore.deleteTemp(tempName); } catch (RuntimeException ignored) { }
    }

    private void safeDeleteItem(String id) {
        try { fileStore.deleteItemDirectory(id); } catch (RuntimeException ignored) { }
    }

    private void safeDeleteRecord(String id) {
        try { repository.delete(id); } catch (RuntimeException ignored) { }
    }

    private static final class PackageRoutingException extends ReadingPackageExtractor.PackageException {
        PackageRoutingException(String code, String message) { super(code, message); }
    }
}
