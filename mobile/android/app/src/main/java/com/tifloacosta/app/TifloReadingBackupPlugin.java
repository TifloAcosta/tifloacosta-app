package com.tifloacosta.app;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.tifloacosta.app.reading.AndroidReadingFileStore;
import com.tifloacosta.app.reading.ReadingBackupService;
import com.tifloacosta.app.reading.ReadingLibraryDatabase;
import com.tifloacosta.app.reading.ReadingRestorePlan;

import org.json.JSONException;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.UUID;

@CapacitorPlugin(name = "TifloReadingBackup")
public final class TifloReadingBackupPlugin extends Plugin {
    private ReadingLibraryDatabase database;
    private AndroidReadingFileStore fileStore;
    private ReadingBackupService backupService;
    private Uri pendingRestoreUri;
    private ReadingRestorePlan pendingRestorePlan;
    private String pendingRestoreId = "";

    @Override
    public void load() {
        Context context = getContext().getApplicationContext();
        database = new ReadingLibraryDatabase(context);
        fileStore = new AndroidReadingFileStore(context);
        backupService = new ReadingBackupService(database, fileStore, System::currentTimeMillis);
    }

    @PluginMethod
    public void exportReadingBackup(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/zip");
        intent.putExtra(Intent.EXTRA_TITLE, "tifloacosta-reading-backup.zip");
        intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        startActivityForResult(call, intent, "exportReadingBackupResult");
    }

    @ActivityCallback
    private void exportReadingBackupResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            call.resolve(exportResult(false, true));
            return;
        }
        List<String> selectedIds;
        try {
            selectedIds = selectedBookIds(call.getArray("bookIds"));
        } catch (JSONException error) {
            call.reject("Invalid reading backup selection", error);
            return;
        }
        getBridge().execute(() -> {
            try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (output == null) throw new IOException("Unable to open backup destination");
                if (selectedIds == null) backupService.exportAll(output);
                else backupService.exportSelected(output, selectedIds);
                call.resolve(exportResult(true, false));
            } catch (ReadingBackupService.BackupException error) {
                call.reject(error.getReason(), error.getMessage(), error);
            } catch (IOException | RuntimeException error) {
                call.reject("Unable to export reading backup", error);
            }
        });
    }

    @PluginMethod
    public void pickReadingRestore(PluginCall call) {
        clearPendingRestore(true);
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/zip");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "pickReadingRestoreResult");
    }

    @ActivityCallback
    private void pickReadingRestoreResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }
        persistReadPermission(uri);
        getBridge().execute(() -> {
            try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
                if (input == null) throw new IOException("Unable to open reading backup");
                ReadingRestorePlan plan = backupService.planRestore(input);
                pendingRestoreUri = uri;
                pendingRestorePlan = plan;
                pendingRestoreId = UUID.randomUUID().toString();
                call.resolve(planJson(pendingRestoreId, plan));
            } catch (ReadingBackupService.BackupException error) {
                releaseReadPermission(uri);
                call.reject(error.getReason(), error.getMessage(), error);
            } catch (IOException | RuntimeException error) {
                releaseReadPermission(uri);
                call.reject("Unable to inspect reading backup", error);
            }
        });
    }

    @PluginMethod
    public void applyReadingRestore(PluginCall call) {
        String restoreId = clean(call.getString("restoreId"));
        if (pendingRestorePlan == null || pendingRestoreUri == null || !restoreId.equals(pendingRestoreId)) {
            call.reject("Reading restore plan is no longer available");
            return;
        }
        try {
            applyPositionChoices(pendingRestorePlan, call.getObject("positionChoices"));
        } catch (IllegalArgumentException error) {
            call.reject("Invalid reading restore choice", error);
            return;
        }

        Uri uri = pendingRestoreUri;
        ReadingRestorePlan plan = pendingRestorePlan;
        getBridge().execute(() -> {
            try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
                if (input == null) throw new IOException("Unable to reopen reading backup");
                backupService.restore(input, plan);
                clearPendingRestore(true);
                JSObject response = new JSObject();
                response.put("restored", true);
                call.resolve(response);
            } catch (ReadingBackupService.BackupException error) {
                clearPendingRestore(true);
                call.reject(error.getReason(), error.getMessage(), error);
            } catch (IOException | RuntimeException error) {
                clearPendingRestore(true);
                call.reject("Unable to restore reading backup", error);
            }
        });
    }

    @PluginMethod
    public void cancelReadingRestore(PluginCall call) {
        clearPendingRestore(true);
        JSObject response = new JSObject();
        response.put("cancelled", true);
        call.resolve(response);
    }

    private static JSObject exportResult(boolean exported, boolean cancelled) {
        JSObject result = new JSObject();
        result.put("exported", exported);
        result.put("cancelled", cancelled);
        return result;
    }

    private static List<String> selectedBookIds(JSArray array) throws JSONException {
        if (array == null) return null;
        List<String> result = new ArrayList<>();
        for (int index = 0; index < array.length(); index++) {
            String id = clean(array.optString(index, ""));
            if (!id.isEmpty() && !result.contains(id)) result.add(id);
        }
        return result;
    }

    private static JSObject planJson(String restoreId, ReadingRestorePlan plan) {
        JSObject result = new JSObject();
        result.put("cancelled", false);
        result.put("restoreId", restoreId);
        JSArray additions = new JSArray();
        for (String sha256 : plan.getAdditions()) additions.put(sha256);
        JSArray duplicates = new JSArray();
        for (String sha256 : plan.getDuplicates()) duplicates.put(sha256);
        JSArray conflicts = new JSArray();
        for (ReadingRestorePlan.PositionConflict conflict : plan.getPositionConflicts()) {
            JSObject item = new JSObject();
            item.put("sha256", conflict.getSha256());
            item.put("currentBookId", conflict.getCurrentBookId());
            item.put("currentBlockIndex", conflict.getCurrentBlockIndex());
            item.put("backupBlockIndex", conflict.getBackupBlockIndex());
            item.put("currentPercent", conflict.getCurrentPercent());
            item.put("backupPercent", conflict.getBackupPercent());
            conflicts.put(item);
        }
        result.put("additions", additions);
        result.put("duplicates", duplicates);
        result.put("positionConflicts", conflicts);
        return result;
    }

    private static void applyPositionChoices(ReadingRestorePlan plan, JSObject choices) {
        if (choices == null) return;
        Iterator<String> keys = choices.keys();
        while (keys.hasNext()) {
            String sha256 = keys.next();
            String choice = clean(choices.optString(sha256, "keep-current"));
            plan.resolvePosition(
                    sha256,
                    "use-backup".equals(choice)
                            ? ReadingRestorePlan.PositionChoice.USE_BACKUP
                            : ReadingRestorePlan.PositionChoice.KEEP_CURRENT
            );
        }
    }

    private void persistReadPermission(Uri uri) {
        try {
            getContext().getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (SecurityException ignored) {
        }
    }

    private void releaseReadPermission(Uri uri) {
        if (uri == null) return;
        try {
            getContext().getContentResolver().releasePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (SecurityException ignored) {
        }
    }

    private void clearPendingRestore(boolean releasePermission) {
        if (releasePermission) releaseReadPermission(pendingRestoreUri);
        pendingRestoreUri = null;
        pendingRestorePlan = null;
        pendingRestoreId = "";
    }

    @Override
    protected void handleOnDestroy() {
        clearPendingRestore(true);
        if (database != null) database.close();
        super.handleOnDestroy();
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }
}
