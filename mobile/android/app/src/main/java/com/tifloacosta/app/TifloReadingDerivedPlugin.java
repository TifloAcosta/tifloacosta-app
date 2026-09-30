package com.tifloacosta.app;

import android.content.Context;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.tifloacosta.app.reading.ReadingBookRecord;
import com.tifloacosta.app.reading.ReadingDerivedRecord;
import com.tifloacosta.app.reading.ReadingDerivedStore;
import com.tifloacosta.app.reading.ReadingLibraryDatabase;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

@CapacitorPlugin(name = "TifloReadingDerived")
public class TifloReadingDerivedPlugin extends Plugin {
    private ReadingLibraryDatabase database;
    private ReadingDerivedStore store;

    @Override
    public void load() {
        Context context = getContext().getApplicationContext();
        database = new ReadingLibraryDatabase(context);
        store = new ReadingDerivedStore(context);
    }

    @PluginMethod
    public void saveDerivedContent(PluginCall call) {
        String bookId = clean(call.getString("bookId"));
        String kind = clean(call.getString("kind"));
        String variantKey = clean(call.getString("variantKey"));
        String content = call.getString("content");
        String status = clean(call.getString("status"));
        int completedUnits = nonNegative(call.getInt("completedUnits"));
        int totalUnits = nonNegative(call.getInt("totalUnits"));

        if (!validKey(bookId, kind, variantKey) || !validStatus(status) || content == null) {
            call.reject("Invalid derived reading content");
            return;
        }
        if (totalUnits > 0 && completedUnits > totalUnits) {
            call.reject("Derived reading progress is invalid");
            return;
        }

        getBridge().execute(() -> {
            try {
                ReadingBookRecord book = database.findById(bookId);
                if (book == null) {
                    call.reject("Reading book not found");
                    return;
                }
                String requestedSha = clean(call.getString("sourceSha256"));
                if (!requestedSha.isEmpty() && !requestedSha.equals(clean(book.getSha256()))) {
                    call.reject("Derived reading source is stale");
                    return;
                }

                ReadingDerivedRecord previous = database.findDerivedContent(bookId, kind, variantKey);
                String fileName = derivedFileName(kind, variantKey);
                String relativePath = store.writeUtf8(bookId, fileName, content);
                ReadingDerivedRecord record = new ReadingDerivedRecord(
                        bookId,
                        kind,
                        variantKey,
                        relativePath,
                        clean(book.getSha256()),
                        clean(call.getString("sourceLanguage")),
                        clean(call.getString("targetLanguage")),
                        clean(call.getString("engine")),
                        clean(call.getString("engineVersion")),
                        status,
                        completedUnits,
                        totalUnits,
                        System.currentTimeMillis()
                );
                database.upsertDerivedContent(record);
                if (previous != null && !relativePath.equals(previous.getRelativePath())) {
                    try { store.delete(previous.getRelativePath()); } catch (IOException ignored) { }
                }
                JSObject result = new JSObject();
                result.put("saved", true);
                result.put("updatedAt", record.getUpdatedAt());
                call.resolve(result);
            } catch (IOException | RuntimeException error) {
                call.reject("Unable to save derived reading content", error);
            }
        });
    }

    @PluginMethod
    public void getDerivedContent(PluginCall call) {
        String bookId = clean(call.getString("bookId"));
        String kind = clean(call.getString("kind"));
        String variantKey = clean(call.getString("variantKey"));
        if (!validKey(bookId, kind, variantKey)) {
            call.reject("Invalid derived reading key");
            return;
        }

        getBridge().execute(() -> {
            try {
                ReadingBookRecord book = database.findById(bookId);
                ReadingDerivedRecord record = database.findDerivedContent(bookId, kind, variantKey);
                if (book == null || record == null) {
                    call.resolve(notFound(false));
                    return;
                }
                if (isStale(book, record)) {
                    call.resolve(notFound(true));
                    return;
                }
                JSObject result = recordJson(record);
                result.put("found", true);
                result.put("stale", false);
                result.put("content", store.readUtf8(record.getRelativePath()));
                call.resolve(result);
            } catch (IOException | RuntimeException error) {
                call.reject("Unable to load derived reading content", error);
            }
        });
    }

    @PluginMethod
    public void listDerivedContent(PluginCall call) {
        String bookId = clean(call.getString("bookId"));
        if (bookId.isEmpty()) {
            call.reject("Reading book id is required");
            return;
        }

        getBridge().execute(() -> {
            try {
                ReadingBookRecord book = database.findById(bookId);
                JSArray items = new JSArray();
                if (book != null) {
                    List<ReadingDerivedRecord> records = database.listDerivedContent(bookId);
                    for (ReadingDerivedRecord record : records) {
                        if (!isStale(book, record)) items.put(recordJson(record));
                    }
                }
                JSObject result = new JSObject();
                result.put("items", items);
                call.resolve(result);
            } catch (RuntimeException error) {
                call.reject("Unable to list derived reading content", error);
            }
        });
    }

    @PluginMethod
    public void deleteDerivedContent(PluginCall call) {
        String bookId = clean(call.getString("bookId"));
        String kind = clean(call.getString("kind"));
        String variantKey = clean(call.getString("variantKey"));
        if (!validKey(bookId, kind, variantKey)) {
            call.reject("Invalid derived reading key");
            return;
        }

        getBridge().execute(() -> {
            try {
                ReadingDerivedRecord record = database.findDerivedContent(bookId, kind, variantKey);
                if (record != null) store.delete(record.getRelativePath());
                database.deleteDerivedContent(bookId, kind, variantKey);
                JSObject result = new JSObject();
                result.put("deleted", true);
                call.resolve(result);
            } catch (IOException | RuntimeException error) {
                call.reject("Unable to delete derived reading content", error);
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (database != null) database.close();
        super.handleOnDestroy();
    }

    private static JSObject recordJson(ReadingDerivedRecord record) {
        JSObject result = new JSObject();
        result.put("bookId", record.getBookId());
        result.put("kind", record.getKind());
        result.put("variantKey", record.getVariantKey());
        result.put("sourceSha256", nullable(record.getSourceSha256()));
        result.put("sourceLanguage", nullable(record.getSourceLanguage()));
        result.put("targetLanguage", nullable(record.getTargetLanguage()));
        result.put("engine", nullable(record.getEngine()));
        result.put("engineVersion", nullable(record.getEngineVersion()));
        result.put("status", record.getStatus());
        result.put("completedUnits", record.getCompletedUnits());
        result.put("totalUnits", record.getTotalUnits());
        result.put("updatedAt", record.getUpdatedAt());
        return result;
    }

    private static JSObject notFound(boolean stale) {
        JSObject result = new JSObject();
        result.put("found", false);
        result.put("stale", stale);
        return result;
    }

    private static boolean isStale(ReadingBookRecord book, ReadingDerivedRecord record) {
        String source = clean(record.getSourceSha256());
        return !source.isEmpty() && !source.equals(clean(book.getSha256()));
    }

    private static String derivedFileName(String kind, String variantKey) {
        String seed = kind + "\n" + variantKey;
        return UUID.nameUUIDFromBytes(seed.getBytes(StandardCharsets.UTF_8)).toString() + ".json";
    }

    private static boolean validKey(String bookId, String kind, String variantKey) {
        return !bookId.isEmpty() && !variantKey.isEmpty()
                && ("ocr".equals(kind) || "translation".equals(kind));
    }

    private static boolean validStatus(String status) {
        return "partial".equals(status) || "complete".equals(status) || "error".equals(status);
    }

    private static int nonNegative(Integer value) {
        return value == null ? 0 : Math.max(0, value);
    }

    private static String nullable(String value) {
        return value == null ? "" : value;
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }
}
