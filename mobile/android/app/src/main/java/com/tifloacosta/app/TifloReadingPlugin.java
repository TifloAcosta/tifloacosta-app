package com.tifloacosta.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.tifloacosta.app.reading.PdfBoxReadingPdfBackend;
import com.tifloacosta.app.reading.ReadingBookQuery;
import com.tifloacosta.app.reading.ReadingBookRecord;
import com.tifloacosta.app.reading.ReadingContentValidator;
import com.tifloacosta.app.reading.ReadingFileStore;
import com.tifloacosta.app.reading.ReadingImportResult;
import com.tifloacosta.app.reading.ReadingImportService;
import com.tifloacosta.app.reading.ReadingImportSource;
import com.tifloacosta.app.reading.ReadingLibraryDatabase;
import com.tifloacosta.app.reading.ReadingMarkRecord;
import com.tifloacosta.app.reading.ReadingPdfExtractor;
import com.tifloacosta.app.reading.ReadingPdfResult;
import com.tifloacosta.app.reading.ReadingSettingsRecord;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(name = "TifloReading")
public class TifloReadingPlugin extends Plugin {
    private static final Set<String> SUPPORTED_MARK_TYPES = new HashSet<>();
    private static final String[] SUPPORTED_READING_SETTING_KEYS = {
            "speech.rate",
            "speech.voice",
            "visual.textSize",
            "visual.fontFamily",
            "visual.fontWeight",
            "visual.lineSpacing",
            "visual.paragraphSpacing",
            "visual.readingWidth",
            "visual.foreground",
            "visual.background",
            "visual.highContrast",
            "visual.theme"
    };

    static {
        SUPPORTED_MARK_TYPES.add("bookmark");
        SUPPORTED_MARK_TYPES.add("important");
        SUPPORTED_MARK_TYPES.add("review");
        SUPPORTED_MARK_TYPES.add("quote");
    }

    private ReadingLibraryDatabase database;
    private AndroidReadingFileStore fileStore;
    private ReadingImportService importer;
    private ReadingPdfExtractor pdfExtractor;
    private Intent launchIntent;
    private boolean initialSharedDocumentsConsumed;

    @Override
    public void load() {
        Context context = getContext().getApplicationContext();
        database = new ReadingLibraryDatabase(context);
        fileStore = new AndroidReadingFileStore(context);
        pdfExtractor = new ReadingPdfExtractor(new PdfBoxReadingPdfBackend(context));
        importer = new ReadingImportService(database, fileStore, System::currentTimeMillis, pdfExtractor);
        launchIntent = getActivity().getIntent();
        getBridge().execute(importer::cleanupStaleTemps);
    }

    @PluginMethod
    public void pickDocuments(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"text/plain", "text/html", "application/pdf"});
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        startActivityForResult(call, intent, "pickDocumentsResult");
    }

    @ActivityCallback
    private void pickDocumentsResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.resolve(emptyBatch(true));
            return;
        }

        List<Uri> uris = collectPickerUris(result.getData());
        getBridge().execute(() -> call.resolve(importUris(uris, false)));
    }

    @PluginMethod
    public void consumeInitialSharedDocuments(PluginCall call) {
        if (initialSharedDocumentsConsumed) {
            call.resolve(emptyBatch(false));
            return;
        }
        initialSharedDocumentsConsumed = true;
        Intent intent = launchIntent;
        if (!hasSharedDocuments(intent)) {
            call.resolve(emptyBatch(false));
            return;
        }
        getBridge().execute(() -> call.resolve(importSharedIntent(intent)));
    }

    @PluginMethod
    public void listBooks(PluginCall call) {
        getBridge().execute(() -> {
            try {
                int page = positive(call.getInt("page"), 1);
                int pageSize = positive(call.getInt("pageSize"), 10);
                String queryText = stringOr(call.getString("query"), "");
                String status = supportedStatus(call.getString("status"));
                String sort = supportedSort(call.getString("sort"));
                long rawOffset = (long) (page - 1) * pageSize;
                int offset = rawOffset > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) rawOffset;
                ReadingBookQuery query = new ReadingBookQuery(queryText, status, sort, pageSize, offset);
                List<ReadingBookRecord> records = database.list(query);
                int total = database.count(query);
                int pages = total == 0 ? 0 : (int) Math.ceil(total / (double) pageSize);

                JSArray items = new JSArray();
                for (ReadingBookRecord record : records) items.put(bookJson(record));

                JSObject result = new JSObject();
                result.put("items", items);
                result.put("total", total);
                result.put("page", page);
                result.put("pageSize", pageSize);
                result.put("pages", pages);
                call.resolve(result);
            } catch (RuntimeException error) {
                call.reject("Unable to list reading library", error);
            }
        });
    }

    @PluginMethod
    public void openBook(PluginCall call) {
        String id = cleanId(call.getString("id"));
        String password = stringOr(call.getString("password"), "");
        if (id.isEmpty()) {
            call.reject("Book id is required");
            return;
        }
        getBridge().execute(() -> {
            try {
                ReadingBookRecord record = database.findById(id);
                if (record == null) {
                    call.reject("Book not found");
                    return;
                }
                JSObject result = new JSObject();
                result.put("book", bookJson(record));
                if ("pdf".equals(record.getFormat())) {
                    try (InputStream source = fileStore.openStoredInput(record.getRelativePath())) {
                        ReadingPdfResult pdf = pdfExtractor.inspect(source, password);
                        if (ReadingPdfResult.STATUS_PASSWORD_REQUIRED.equals(pdf.getStatus())) {
                            result.put("passwordRequired", true);
                            result.put("passwordRejected", !password.isEmpty());
                        } else if (ReadingPdfResult.STATUS_NO_TEXT.equals(pdf.getStatus())) {
                            result.put("pdfNoText", true);
                            result.put("pageCount", pdf.getPageCount());
                        } else if (ReadingPdfResult.STATUS_READABLE.equals(pdf.getStatus())) {
                            result.put("pdf", pdfJson(pdf));
                        } else {
                            call.reject("Unable to open PDF");
                            return;
                        }
                    }
                } else {
                    result.put("content", fileStore.readUtf8(record.getRelativePath()));
                }
                call.resolve(result);
            } catch (IOException | RuntimeException error) {
                call.reject("Unable to open book", error);
            }
        });
    }

    @PluginMethod
    public void saveProgress(PluginCall call) {
        String id = cleanId(call.getString("id"));
        if (id.isEmpty()) {
            call.reject("Book id is required");
            return;
        }
        getBridge().execute(() -> {
            try {
                ReadingBookRecord existing = database.findById(id);
                JSObject result = new JSObject();
                if (existing == null) {
                    result.put("saved", false);
                    call.resolve(result);
                    return;
                }
                int blockIndex = nonNegative(call.getInt("blockIndex"), 0);
                int unitIndex = nonNegative(call.getInt("unitIndex"), 0);
                String anchorText = nullableText(call.getString("anchorText"));
                double percent = boundedPercent(call.getDouble("percent"));
                String state = supportedProgressState(call.getString("state"));
                database.updateProgress(
                        id,
                        blockIndex,
                        unitIndex,
                        anchorText,
                        percent,
                        state,
                        System.currentTimeMillis()
                );
                result.put("saved", true);
                call.resolve(result);
            } catch (RuntimeException error) {
                call.reject("Unable to save reading progress", error);
            }
        });
    }

    @PluginMethod
    public void listMarks(PluginCall call) {
        String bookId = cleanId(call.getString("bookId"));
        if (bookId.isEmpty()) {
            call.reject("Book id is required");
            return;
        }
        String requestedType = cleanId(call.getString("type"));
        String type = requestedType.isEmpty() ? null : supportedMarkType(requestedType);
        if (!requestedType.isEmpty() && type == null) {
            call.reject("Unsupported reading mark type");
            return;
        }
        getBridge().execute(() -> {
            try {
                JSArray items = new JSArray();
                for (ReadingMarkRecord record : database.listMarks(bookId, type)) {
                    items.put(markJson(record));
                }
                JSObject result = new JSObject();
                result.put("items", items);
                call.resolve(result);
            } catch (RuntimeException error) {
                call.reject("Unable to list reading marks", error);
            }
        });
    }

    @PluginMethod
    public void addMark(PluginCall call) {
        String bookId = cleanId(call.getString("bookId"));
        String type = supportedMarkType(call.getString("type"));
        if (bookId.isEmpty() || type == null) {
            call.reject("Book id and supported mark type are required");
            return;
        }
        int blockIndex = nonNegative(call.getInt("blockIndex"), 0);
        int unitIndex = nonNegative(call.getInt("unitIndex"), 0);
        String excerpt = nullableText(call.getString("excerpt"));
        String reference = nullableText(call.getString("reference"));

        getBridge().execute(() -> {
            try {
                if (database.findById(bookId) == null) {
                    call.reject("Book not found");
                    return;
                }
                ReadingMarkRecord record = new ReadingMarkRecord(
                        UUID.randomUUID().toString(),
                        bookId,
                        type,
                        blockIndex,
                        unitIndex,
                        excerpt,
                        reference,
                        System.currentTimeMillis()
                );
                database.insertMark(record);
                JSObject result = new JSObject();
                result.put("added", true);
                result.put("mark", markJson(record));
                call.resolve(result);
            } catch (RuntimeException error) {
                call.reject("Unable to add reading mark", error);
            }
        });
    }

    @PluginMethod
    public void deleteMark(PluginCall call) {
        String id = cleanId(call.getString("id"));
        if (id.isEmpty()) {
            call.reject("Mark id is required");
            return;
        }
        getBridge().execute(() -> {
            try {
                database.deleteMark(id);
                JSObject result = new JSObject();
                result.put("deleted", true);
                call.resolve(result);
            } catch (RuntimeException error) {
                call.reject("Unable to delete reading mark", error);
            }
        });
    }

    @PluginMethod
    public void getReadingSettings(PluginCall call) {
        String bookId = cleanId(call.getString("bookId"));
        getBridge().execute(() -> {
            try {
                JSObject global = new JSObject();
                JSObject book = new JSObject();
                for (String key : SUPPORTED_READING_SETTING_KEYS) {
                    ReadingSettingsRecord globalSetting = database.getReadingSetting("global", "", key);
                    if (globalSetting != null) global.put(key, globalSetting.getValue());
                    if (!bookId.isEmpty()) {
                        ReadingSettingsRecord bookSetting = database.getReadingSetting("book", bookId, key);
                        if (bookSetting != null) book.put(key, bookSetting.getValue());
                    }
                }
                JSObject result = new JSObject();
                result.put("global", global);
                result.put("book", book);
                call.resolve(result);
            } catch (RuntimeException error) {
                call.reject("Unable to load reading settings", error);
            }
        });
    }

    @PluginMethod
    public void setReadingSetting(PluginCall call) {
        String scope = cleanId(call.getString("scope"));
        String bookId = cleanId(call.getString("bookId"));
        String key = cleanId(call.getString("key"));
        String value = call.getString("value");
        if (!"global".equals(scope) && !"book".equals(scope)) {
            call.reject("Unsupported reading setting scope");
            return;
        }
        if ("book".equals(scope) && bookId.isEmpty()) {
            call.reject("Book id is required for book settings");
            return;
        }
        if (!isSupportedReadingSettingKey(key) || value == null) {
            call.reject("Unsupported reading setting");
            return;
        }
        String normalizedBookId = "global".equals(scope) ? "" : bookId;
        getBridge().execute(() -> {
            try {
                if ("book".equals(scope) && database.findById(normalizedBookId) == null) {
                    call.reject("Book not found");
                    return;
                }
                database.setReadingSetting(new ReadingSettingsRecord(
                        scope,
                        normalizedBookId,
                        key,
                        value,
                        System.currentTimeMillis()
                ));
                JSObject result = new JSObject();
                result.put("saved", true);
                call.resolve(result);
            } catch (RuntimeException error) {
                call.reject("Unable to save reading setting", error);
            }
        });
    }

    @PluginMethod
    public void resetBookReadingSettings(PluginCall call) {
        String bookId = cleanId(call.getString("bookId"));
        if (bookId.isEmpty()) {
            call.reject("Book id is required");
            return;
        }
        getBridge().execute(() -> {
            try {
                database.resetBookReadingSettings(bookId);
                JSObject result = new JSObject();
                result.put("reset", true);
                call.resolve(result);
            } catch (RuntimeException error) {
                call.reject("Unable to reset book reading settings", error);
            }
        });
    }

    @PluginMethod
    public void deleteBook(PluginCall call) {
        String id = cleanId(call.getString("id"));
        if (id.isEmpty()) {
            call.reject("Book id is required");
            return;
        }
        getBridge().execute(() -> {
            try {
                ReadingBookRecord existing = database.findById(id);
                JSObject result = new JSObject();
                if (existing == null) {
                    result.put("deleted", false);
                    call.resolve(result);
                    return;
                }
                fileStore.deleteItemDirectory(id);
                database.delete(id);
                result.put("deleted", true);
                call.resolve(result);
            } catch (RuntimeException error) {
                call.reject("Unable to delete book", error);
            }
        });
    }

    @PluginMethod
    public void getLatestInProgress(PluginCall call) {
        getBridge().execute(() -> {
            try {
                ReadingBookRecord record = database.latestInProgress();
                JSObject result = new JSObject();
                if (record != null) result.put("book", bookJson(record));
                call.resolve(result);
            } catch (RuntimeException error) {
                call.reject("Unable to load reading progress", error);
            }
        });
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (!hasSharedDocuments(intent)) return;
        getBridge().execute(() -> {
            JSObject batch = importSharedIntent(intent);
            getActivity().runOnUiThread(() -> notifyListeners("documentsReceived", batch, true));
        });
    }

    private JSObject importSharedIntent(Intent intent) {
        return importUris(collectSharedUris(intent), false);
    }

    private JSObject importUris(List<Uri> uris, boolean cancelled) {
        BatchBuilder batch = new BatchBuilder(cancelled);
        for (Uri uri : uris) {
            ReadingImportSource source = sourceFor(uri);
            String name = source.getDisplayName() == null ? "" : source.getDisplayName();
            try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
                if (input == null) {
                    batch.reject(name, "storage-error");
                    continue;
                }
                ReadingImportResult result = importer.importOne(source, input);
                if (result.isImported() || result.isDuplicate()) {
                    ReadingBookRecord record = database.findById(result.getBookId());
                    if (record == null) {
                        batch.reject(name, "storage-error");
                    } else if (result.isImported()) {
                        batch.imported.put(bookJson(record));
                    } else {
                        batch.duplicates.put(bookJson(record));
                    }
                } else {
                    batch.reject(name, stringOr(result.getReason(), "storage-error"));
                }
            } catch (IOException | RuntimeException error) {
                batch.reject(name, "storage-error");
            }
        }
        return batch.toJson();
    }

    private ReadingImportSource sourceFor(Uri uri) {
        ContentResolver resolver = getContext().getContentResolver();
        String displayName = null;
        Long size = null;
        try (Cursor cursor = resolver.query(
                uri,
                new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE},
                null,
                null,
                null
        )) {
            if (cursor != null && cursor.moveToFirst()) {
                int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (nameIndex >= 0 && !cursor.isNull(nameIndex)) displayName = cursor.getString(nameIndex);
                int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) size = cursor.getLong(sizeIndex);
            }
        } catch (RuntimeException ignored) {
        }
        if (displayName == null || displayName.trim().isEmpty()) displayName = uri.getLastPathSegment();
        return new ReadingImportSource(displayName, resolver.getType(uri), size);
    }

    private static List<Uri> collectPickerUris(Intent data) {
        List<Uri> uris = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        ClipData clipData = data.getClipData();
        if (clipData != null) {
            for (int i = 0; i < clipData.getItemCount(); i++) {
                addUri(uris, seen, clipData.getItemAt(i).getUri());
            }
        }
        addUri(uris, seen, data.getData());
        return uris;
    }

    @SuppressWarnings("deprecation")
    private static List<Uri> collectSharedUris(Intent intent) {
        List<Uri> uris = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        if (intent == null) return uris;

        if (Intent.ACTION_SEND.equals(intent.getAction())) {
            Object stream = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (stream instanceof Uri) addUri(uris, seen, (Uri) stream);
        } else if (Intent.ACTION_SEND_MULTIPLE.equals(intent.getAction())) {
            ArrayList<Uri> streams = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (streams != null) {
                for (Uri uri : streams) addUri(uris, seen, uri);
            }
        }

        ClipData clipData = intent.getClipData();
        if (clipData != null) {
            for (int i = 0; i < clipData.getItemCount(); i++) {
                addUri(uris, seen, clipData.getItemAt(i).getUri());
            }
        }
        return uris;
    }

    private static void addUri(List<Uri> uris, Set<String> seen, Uri uri) {
        if (uri == null) return;
        String key = uri.toString();
        if (seen.add(key)) uris.add(uri);
    }

    private static boolean hasSharedDocuments(Intent intent) {
        if (intent == null) return false;
        String action = intent.getAction();
        if (!Intent.ACTION_SEND.equals(action) && !Intent.ACTION_SEND_MULTIPLE.equals(action)) return false;
        if (intent.hasExtra(Intent.EXTRA_STREAM)) return true;
        ClipData clipData = intent.getClipData();
        return clipData != null && clipData.getItemCount() > 0;
    }

    private static JSObject bookJson(ReadingBookRecord record) {
        JSObject book = new JSObject();
        book.put("id", record.getId());
        book.put("title", record.getTitle());
        book.put("format", record.getFormat());
        book.put("state", record.getState());
        book.put("percent", record.getPercent());
        book.put("blockIndex", record.getBlockIndex());
        book.put("unitIndex", record.getUnitIndex());
        book.put("anchorText", record.getAnchorText());
        book.put("importedAt", record.getImportedAt());
        book.put("lastReadAt", record.getLastReadAt() == null ? 0L : record.getLastReadAt());
        book.put("sizeBytes", record.getSizeBytes());
        return book;
    }

    private static JSObject pdfJson(ReadingPdfResult pdf) {
        JSObject payload = new JSObject();
        payload.put("title", pdf.getTitle());
        payload.put("author", pdf.getAuthor());
        payload.put("language", pdf.getLanguage());
        payload.put("pageCount", pdf.getPageCount());
        payload.put("orderReliable", pdf.isOrderReliable());
        JSArray pages = new JSArray();
        for (ReadingPdfResult.Page page : pdf.getPages()) {
            if (page == null) continue;
            JSObject pageJson = new JSObject();
            pageJson.put("number", page.getNumber());
            pageJson.put("text", page.getText());
            pages.put(pageJson);
        }
        payload.put("pages", pages);
        return payload;
    }

    private static JSObject markJson(ReadingMarkRecord record) {
        JSObject mark = new JSObject();
        mark.put("id", record.getId());
        mark.put("bookId", record.getBookId());
        mark.put("type", record.getType());
        mark.put("blockIndex", record.getBlockIndex());
        mark.put("unitIndex", record.getUnitIndex());
        mark.put("excerpt", stringOr(record.getExcerpt(), ""));
        mark.put("reference", stringOr(record.getReference(), ""));
        mark.put("createdAt", record.getCreatedAt());
        return mark;
    }

    private static JSObject emptyBatch(boolean cancelled) {
        return new BatchBuilder(cancelled).toJson();
    }

    private static int positive(Integer value, int fallback) {
        return value == null || value <= 0 ? fallback : value;
    }

    private static int nonNegative(Integer value, int fallback) {
        return value == null ? fallback : Math.max(0, value);
    }

    private static double boundedPercent(Double value) {
        if (value == null || value.isNaN() || value.isInfinite()) return 0.0;
        return Math.max(0.0, Math.min(100.0, value));
    }

    private static String cleanId(String value) {
        return value == null ? "" : value.trim();
    }

    private static String nullableText(String value) {
        if (value == null) return null;
        String cleaned = value.trim();
        return cleaned.isEmpty() ? null : cleaned;
    }

    private static String stringOr(String value, String fallback) {
        return value == null ? fallback : value;
    }

    private static String supportedStatus(String value) {
        if ("not-read".equals(value) || "in-reading".equals(value) || "read".equals(value)) return value;
        return "all";
    }

    private static String supportedSort(String value) {
        if ("title".equals(value) || "imported".equals(value)) return value;
        return "lastRead";
    }

    private static String supportedProgressState(String value) {
        if ("not-read".equals(value) || "read".equals(value)) return value;
        return "in-reading";
    }

    private static String supportedMarkType(String value) {
        String cleaned = cleanId(value).toLowerCase();
        return SUPPORTED_MARK_TYPES.contains(cleaned) ? cleaned : null;
    }

    private static boolean isSupportedReadingSettingKey(String value) {
        String key = cleanId(value);
        for (String supported : SUPPORTED_READING_SETTING_KEYS) {
            if (supported.equals(key)) return true;
        }
        return false;
    }

    private static final class BatchBuilder {
        private final boolean cancelled;
        private final JSArray imported = new JSArray();
        private final JSArray duplicates = new JSArray();
        private final JSArray rejected = new JSArray();

        private BatchBuilder(boolean cancelled) {
            this.cancelled = cancelled;
        }

        private void reject(String name, String reason) {
            JSObject item = new JSObject();
            item.put("name", name == null ? "" : name);
            item.put("reason", reason == null ? "storage-error" : reason);
            rejected.put(item);
        }

        private JSObject toJson() {
            JSObject result = new JSObject();
            result.put("cancelled", cancelled);
            result.put("imported", imported);
            result.put("duplicates", duplicates);
            result.put("rejected", rejected);
            return result;
        }
    }

    private static final class AndroidReadingFileStore implements ReadingFileStore {
        private final File root;
        private final File tempDirectory;
        private final File itemsDirectory;

        private AndroidReadingFileStore(Context context) {
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
            return new FileOutputStream(new File(tempDirectory, tempName), false);
        }

        @Override
        public InputStream openTempInput(String tempName) throws IOException {
            ensureDirectoryForIo(tempDirectory);
            return new FileInputStream(new File(tempDirectory, tempName));
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
            File file = new File(tempDirectory, tempName);
            try (InputStreamReader reader = new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8)) {
                return ReadingContentValidator.hasReadableText(reader, format);
            }
        }

        @Override
        public String moveTempToItem(String tempName, String id) throws IOException {
            return moveTempToItem(tempName, id, "txt");
        }

        @Override
        public String moveTempToItem(String tempName, String id, String format) throws IOException {
            File source = new File(tempDirectory, tempName);
            File itemDirectory = new File(itemsDirectory, id);
            ensureDirectoryForIo(itemDirectory);
            String sourceName = "html".equals(format)
                    ? "source.html"
                    : "pdf".equals(format) ? "source.pdf" : "source.txt";
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
            File file = new File(tempDirectory, tempName);
            if (file.exists() && !file.delete()) {
                throw new IllegalStateException("Unable to remove reading import temp file");
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
            File directory = new File(itemsDirectory, id);
            if (!deleteRecursively(directory)) {
                throw new IllegalStateException("Unable to remove reading item");
            }
        }

        private File safeRelativeFile(String relativePath) throws IOException {
            File file = new File(root, relativePath);
            String rootPath = root.getCanonicalPath();
            String filePath = file.getCanonicalPath();
            if (!filePath.startsWith(rootPath + File.separator)) {
                throw new IOException("Invalid reading library path");
            }
            return file;
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
}
