package com.tifloacosta.app;

import android.content.Context;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.tifloacosta.app.reading.ReadingBookQuery;
import com.tifloacosta.app.reading.ReadingBookRecord;
import com.tifloacosta.app.reading.ReadingLibraryDatabase;
import com.tifloacosta.app.reading.ReadingQueueRecord;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(name = "TifloReadingLibrary")
public class TifloReadingLibraryPlugin extends Plugin {
    private ReadingLibraryDatabase database;

    @Override
    public void load() {
        Context context = getContext().getApplicationContext();
        database = new ReadingLibraryDatabase(context);
    }

    @PluginMethod
    public void listBooks(PluginCall call) {
        getBridge().execute(() -> {
            try {
                int page = positive(call.getInt("page"), 1);
                int pageSize = positive(call.getInt("pageSize"), 10);
                String queryText = stringOr(call.getString("query"), "").trim();
                String status = supportedStatus(call.getString("status"));
                String format = clean(call.getString("format")).toLowerCase();
                String sort = supportedSort(call.getString("sort"));
                long rawOffset = (long) (page - 1) * pageSize;
                int offset = rawOffset > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) rawOffset;
                ReadingBookQuery query = new ReadingBookQuery(queryText, status, format, sort, pageSize, offset);
                List<ReadingBookRecord> records = database.list(query);
                int total = database.count(query);
                int pages = total == 0 ? 0 : (int) Math.ceil(total / (double) pageSize);
                Map<String, Integer> queueIndexes = queueIndexes();

                JSArray items = new JSArray();
                for (ReadingBookRecord record : records) {
                    Integer queueIndex = queueIndexes.get(record.getId());
                    items.put(bookJson(record, queueIndex));
                }

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
    public void listQueue(PluginCall call) {
        getBridge().execute(() -> {
            try {
                JSArray items = new JSArray();
                for (ReadingQueueRecord record : database.listQueue()) {
                    items.put(bookJson(record.getBook(), record.getQueueIndex()));
                }
                JSObject result = new JSObject();
                result.put("items", items);
                call.resolve(result);
            } catch (RuntimeException error) {
                call.reject("Unable to list reading queue", error);
            }
        });
    }

    @PluginMethod
    public void addToQueue(PluginCall call) {
        mutateQueue(call, "queued", database.addToQueue(clean(call.getString("bookId"))));
    }

    @PluginMethod
    public void removeFromQueue(PluginCall call) {
        mutateQueue(call, "removed", database.removeFromQueue(clean(call.getString("bookId"))));
    }

    @PluginMethod
    public void moveQueueItem(PluginCall call) {
        String bookId = clean(call.getString("bookId"));
        int targetIndex = nonNegative(call.getInt("targetIndex"), 0);
        mutateQueue(call, "moved", database.moveQueueItem(bookId, targetIndex));
    }

    @PluginMethod
    public void updateBookMetadata(PluginCall call) {
        String id = clean(call.getString("id"));
        if (id.isEmpty()) {
            call.reject("Book id is required");
            return;
        }
        getBridge().execute(() -> {
            try {
                ReadingBookRecord existing = database.findById(id);
                JSObject result = new JSObject();
                if (existing == null) {
                    result.put("updated", false);
                    call.resolve(result);
                    return;
                }
                String title = clean(call.getString("title"));
                if (title.isEmpty()) title = existing.getTitle();
                String author = call.getString("author");
                if (author == null) author = existing.getAuthor();
                String language = call.getString("language");
                if (language == null) language = existing.getLanguage();
                String state = supportedState(call.getString("state"), existing.getState());
                database.updateBookMetadata(id, title, author.trim(), language.trim().toLowerCase(), state);
                result.put("updated", true);
                call.resolve(result);
            } catch (RuntimeException error) {
                call.reject("Unable to update reading book metadata", error);
            }
        });
    }

    private void mutateQueue(PluginCall call, String key, boolean value) {
        JSObject result = new JSObject();
        result.put(key, value);
        call.resolve(result);
    }

    private Map<String, Integer> queueIndexes() {
        Map<String, Integer> result = new HashMap<>();
        for (ReadingQueueRecord record : database.listQueue()) {
            result.put(record.getBook().getId(), record.getQueueIndex());
        }
        return result;
    }

    private static JSObject bookJson(ReadingBookRecord record, Integer queueIndex) {
        JSObject book = new JSObject();
        book.put("id", record.getId());
        book.put("title", record.getTitle());
        book.put("author", stringOr(record.getAuthor(), ""));
        book.put("language", stringOr(record.getLanguage(), ""));
        book.put("format", record.getFormat());
        book.put("state", record.getState());
        book.put("queued", queueIndex != null);
        book.put("queueIndex", queueIndex == null ? 0 : queueIndex);
        book.put("percent", record.getPercent());
        book.put("blockIndex", record.getBlockIndex());
        book.put("unitIndex", record.getUnitIndex());
        book.put("anchorText", record.getAnchorText());
        book.put("mediaTrackIndex", record.getMediaTrackIndex());
        book.put("mediaPositionMs", record.getMediaPositionMs());
        book.put("importedAt", record.getImportedAt());
        book.put("lastReadAt", record.getLastReadAt() == null ? 0L : record.getLastReadAt());
        book.put("sizeBytes", record.getSizeBytes());
        return book;
    }

    private static int positive(Integer value, int fallback) {
        return value == null || value <= 0 ? fallback : value;
    }

    private static int nonNegative(Integer value, int fallback) {
        return value == null ? fallback : Math.max(0, value);
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private static String stringOr(String value, String fallback) {
        return value == null ? fallback : value;
    }

    private static String supportedStatus(String value) {
        if ("not-read".equals(value) || "in-reading".equals(value) || "read".equals(value)) return value;
        return "all";
    }

    private static String supportedSort(String value) {
        if ("title".equals(value) || "author".equals(value) || "imported".equals(value)) return value;
        return "lastRead";
    }

    private static String supportedState(String value, String fallback) {
        if ("not-read".equals(value) || "in-reading".equals(value) || "read".equals(value)) return value;
        return fallback;
    }
}
