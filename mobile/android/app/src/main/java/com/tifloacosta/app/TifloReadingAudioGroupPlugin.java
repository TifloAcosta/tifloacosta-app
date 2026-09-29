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
import com.tifloacosta.app.reading.AndroidReadingAudioProbe;
import com.tifloacosta.app.reading.AndroidReadingFileStore;
import com.tifloacosta.app.reading.PdfBoxReadingPdfBackend;
import com.tifloacosta.app.reading.ReadingAudioTrackRecord;
import com.tifloacosta.app.reading.ReadingBookRecord;
import com.tifloacosta.app.reading.ReadingImportResult;
import com.tifloacosta.app.reading.ReadingImportService;
import com.tifloacosta.app.reading.ReadingImportSource;
import com.tifloacosta.app.reading.ReadingLibraryDatabase;
import com.tifloacosta.app.reading.ReadingPdfExtractor;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(name = "TifloReadingAudioGroup")
public final class TifloReadingAudioGroupPlugin extends Plugin {
    private ReadingLibraryDatabase database;
    private AndroidReadingFileStore fileStore;
    private ReadingImportService importer;
    private String pendingSelectionId = "";
    private List<Uri> pendingAudioUris = new ArrayList<>();

    @Override
    public void load() {
        Context context = getContext().getApplicationContext();
        database = new ReadingLibraryDatabase(context);
        fileStore = new AndroidReadingFileStore(context);
        ReadingPdfExtractor pdfExtractor = new ReadingPdfExtractor(new PdfBoxReadingPdfBackend(context));
        importer = new ReadingImportService(
                database,
                fileStore,
                System::currentTimeMillis,
                pdfExtractor,
                new AndroidReadingAudioProbe()
        );
    }

    @PluginMethod
    public void pickDocuments(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                "text/plain",
                "text/html",
                "application/pdf",
                "application/epub+zip",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/zip",
                "application/x-zip-compressed",
                "audio/mpeg",
                "audio/mp4",
                "audio/aac",
                "audio/ogg",
                "audio/opus",
                "audio/flac",
                "audio/wav",
                "audio/x-m4a",
                "audio/x-m4b",
                "audio/x-flac",
                "audio/x-wav"
        });
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
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
        if (uris.size() > 1 && allAudio(uris)) {
            clearPendingSelection(true);
            pendingSelectionId = UUID.randomUUID().toString();
            pendingAudioUris = new ArrayList<>(uris);
            persistReadPermissions(pendingAudioUris);

            JSObject response = emptyBatch(false);
            response.put("audioChoiceRequired", true);
            response.put("selectionId", pendingSelectionId);
            JSArray names = new JSArray();
            for (Uri uri : pendingAudioUris) names.put(sourceFor(uri).getDisplayName());
            response.put("selectedNames", names);
            call.resolve(response);
            return;
        }

        getBridge().execute(() -> call.resolve(importUris(uris, false)));
    }

    @PluginMethod
    public void resolveAudioSelection(PluginCall call) {
        String selectionId = clean(call.getString("selectionId"));
        String mode = clean(call.getString("mode"));
        if (selectionId.isEmpty() || !selectionId.equals(pendingSelectionId)) {
            call.reject("Audio selection is no longer available");
            return;
        }
        if (!"grouped".equals(mode) && !"independent".equals(mode) && !"cancel".equals(mode)) {
            call.reject("Unsupported audio import choice");
            return;
        }

        List<Uri> uris = new ArrayList<>(pendingAudioUris);
        pendingSelectionId = "";
        pendingAudioUris = new ArrayList<>();

        if ("cancel".equals(mode)) {
            releaseReadPermissions(uris);
            call.resolve(emptyBatch(true));
            return;
        }

        getBridge().execute(() -> {
            try {
                JSObject response = "grouped".equals(mode)
                        ? importAudioGroup(uris)
                        : importUris(uris, false);
                call.resolve(response);
            } finally {
                releaseReadPermissions(uris);
            }
        });
    }

    @PluginMethod
    public void listAudioTracks(PluginCall call) {
        String bookId = clean(call.getString("bookId"));
        if (bookId.isEmpty()) {
            call.reject("Book id is required");
            return;
        }
        getBridge().execute(() -> {
            try {
                JSArray tracks = new JSArray();
                for (ReadingAudioTrackRecord record : database.listAudioTracks(bookId)) {
                    tracks.put(trackJson(record));
                }
                JSObject result = new JSObject();
                result.put("tracks", tracks);
                call.resolve(result);
            } catch (RuntimeException error) {
                call.reject("Unable to list reading audio tracks", error);
            }
        });
    }

    private JSObject importAudioGroup(List<Uri> uris) {
        BatchBuilder batch = new BatchBuilder(false);
        List<ReadingImportService.AudioGroupItem> items = new ArrayList<>();
        String groupName = uris.isEmpty() ? "" : sourceFor(uris.get(0)).getDisplayName();
        try {
            for (Uri uri : uris) {
                ReadingImportSource source = sourceFor(uri);
                InputStream input = getContext().getContentResolver().openInputStream(uri);
                if (input == null) {
                    closeInputs(items);
                    batch.reject(source.getDisplayName(), "storage-error");
                    return batch.toJson();
                }
                items.add(new ReadingImportService.AudioGroupItem(source, input));
            }

            ReadingImportResult result = importer.importAudioGroup(items);
            addImportResult(batch, groupName, result);
            return batch.toJson();
        } catch (IOException | RuntimeException error) {
            closeInputs(items);
            batch.reject(groupName, "storage-error");
            return batch.toJson();
        }
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
                addImportResult(batch, name, importer.importOne(source, input));
            } catch (IOException | RuntimeException error) {
                batch.reject(name, "storage-error");
            }
        }
        return batch.toJson();
    }

    private void addImportResult(BatchBuilder batch, String name, ReadingImportResult result) {
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
    }

    private boolean allAudio(List<Uri> uris) {
        if (uris == null || uris.size() < 2) return false;
        for (Uri uri : uris) {
            if (!ReadingImportService.isAudioSource(sourceFor(uri))) return false;
        }
        return true;
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

    private void persistReadPermissions(List<Uri> uris) {
        ContentResolver resolver = getContext().getContentResolver();
        for (Uri uri : uris) {
            try {
                resolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } catch (SecurityException ignored) {
            }
        }
    }

    private void releaseReadPermissions(List<Uri> uris) {
        ContentResolver resolver = getContext().getContentResolver();
        for (Uri uri : uris) {
            try {
                resolver.releasePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } catch (SecurityException ignored) {
            }
        }
    }

    private void clearPendingSelection(boolean release) {
        if (release && !pendingAudioUris.isEmpty()) releaseReadPermissions(pendingAudioUris);
        pendingSelectionId = "";
        pendingAudioUris = new ArrayList<>();
    }

    @Override
    protected void handleOnDestroy() {
        clearPendingSelection(true);
        if (database != null) database.close();
        super.handleOnDestroy();
    }

    private static List<Uri> collectPickerUris(Intent data) {
        List<Uri> uris = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        ClipData clipData = data.getClipData();
        if (clipData != null) {
            for (int index = 0; index < clipData.getItemCount(); index++) {
                addUri(uris, seen, clipData.getItemAt(index).getUri());
            }
        }
        addUri(uris, seen, data.getData());
        return uris;
    }

    private static void addUri(List<Uri> uris, Set<String> seen, Uri uri) {
        if (uri == null) return;
        String key = uri.toString();
        if (seen.add(key)) uris.add(uri);
    }

    private static void closeInputs(List<ReadingImportService.AudioGroupItem> items) {
        for (ReadingImportService.AudioGroupItem item : items) {
            if (item == null || item.getInput() == null) continue;
            try {
                item.getInput().close();
            } catch (IOException ignored) {
            }
        }
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
        book.put("mediaTrackIndex", record.getMediaTrackIndex());
        book.put("mediaPositionMs", record.getMediaPositionMs());
        book.put("importedAt", record.getImportedAt());
        book.put("lastReadAt", record.getLastReadAt() == null ? 0L : record.getLastReadAt());
        book.put("sizeBytes", record.getSizeBytes());
        return book;
    }

    private static JSObject trackJson(ReadingAudioTrackRecord record) {
        JSObject track = new JSObject();
        track.put("bookId", record.getBookId());
        track.put("trackIndex", record.getTrackIndex());
        track.put("relativePath", record.getRelativePath());
        track.put("originalName", record.getOriginalName());
        track.put("title", stringOr(record.getTitle(), ""));
        track.put("durationMs", record.getDurationMs());
        track.put("embeddedTrackNumber", record.getEmbeddedTrackNumber());
        track.put("sizeBytes", record.getSizeBytes());
        return track;
    }

    private static JSObject emptyBatch(boolean cancelled) {
        return new BatchBuilder(cancelled).toJson();
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private static String stringOr(String value, String fallback) {
        return value == null ? fallback : value;
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
            result.put("audioChoiceRequired", false);
            result.put("selectionId", "");
            result.put("selectedNames", new JSArray());
            result.put("imported", imported);
            result.put("duplicates", duplicates);
            result.put("rejected", rejected);
            return result;
        }
    }
}
