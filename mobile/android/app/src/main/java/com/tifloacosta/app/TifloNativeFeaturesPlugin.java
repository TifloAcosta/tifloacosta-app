package com.tifloacosta.app;

import android.content.Intent;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import java.io.File;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Temporary integration bridge; never changes package identity or wipes existing reader data. */
@CapacitorPlugin(name = "TifloNativeFeatures")
public class TifloNativeFeaturesPlugin extends Plugin {
    private void open(PluginCall call, String target) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.reject("Native features require Android 8 or later.");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                Intent intent = new Intent();
                intent.setClassName(getContext().getPackageName(),
                        "com.tifloacosta.nativeprototype.NativePrototypeActivity");
                intent.putExtra("tifloacosta-open-section", target);
                getActivity().startActivity(intent);
                JSObject result = new JSObject();
                result.put("opened", true);
                call.resolve(result);
            } catch (RuntimeException error) {
                call.reject("Could not open native preview.", error);
            }
        });
    }


    /**
     * Inventory of the installed reader before migrating anything. Read-only,
     * no SQLiteOpenHelper, no schema upgrade, no app data changes. Missing
     * optional tables are allowed for users upgrading from older releases.
     * An unreadable existing database is an error, never an empty library.
     */
    @PluginMethod
    public void inspectLegacyLibrary(PluginCall call) {
        getBridge().execute(() -> {
            File legacy = getContext().getDatabasePath("tiflo_reading.db");
            File libraryFiles = new File(getContext().getFilesDir(), "reading-library/items");
            File nativeIndex = new File(getContext().getFilesDir(), "tiflolector-native/index.json");
            JSObject result = new JSObject();
            result.put("legacyDatabaseExists", legacy.isFile());
            result.put("legacyFilesExist", libraryFiles.isDirectory());
            result.put("nativeIndexExists", nativeIndex.isFile());
            result.put("migrationCompleted", false);
            if (!legacy.exists()) {
                result.put("books", 0);
                result.put("marks", 0);
                result.put("queue", 0);
                result.put("settings", 0);
                result.put("audioTracks", 0);
                call.resolve(result);
                return;
            }
            SQLiteDatabase db = null;
            try {
                db = SQLiteDatabase.openDatabase(
                        legacy.getAbsolutePath(), null, SQLiteDatabase.OPEN_READONLY);
                if (!tableExists(db, "books")) {
                    call.reject("La biblioteca anterior existe, pero no contiene una tabla de libros válida.");
                    return;
                }
                result.put("schemaVersion", db.getVersion());
                result.put("books", countRows(db, "books"));
                result.put("marks", countRows(db, "marks"));
                result.put("queue", countRows(db, "reading_queue"));
                result.put("settings", countRows(db, "reading_settings"));
                result.put("audioTracks", countRows(db, "audio_tracks"));
                result.put("derived", countRows(db, "reading_derived"));
                call.resolve(result);
            } catch (RuntimeException error) {
                call.reject("No se pudo comprobar la biblioteca antigua; no se ha modificado ningún dato.", error);
            } finally {
                if (db != null) db.close();
            }
        });
    }

    private static boolean tableExists(SQLiteDatabase db, String name) {
        try (Cursor cursor = db.rawQuery(
                "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
                new String[]{name})) {
            return cursor.moveToFirst();
        }
    }

    private static int countRows(SQLiteDatabase db, String table) {
        // Only these internal, fixed names are accepted; never SQL from a caller.
        switch (table) {
            case "books":
            case "marks":
            case "reading_queue":
            case "reading_settings":
            case "audio_tracks":
            case "reading_derived":
                break;
            default:
                throw new IllegalArgumentException("Tabla de inventario desconocida");
        }
        if (!tableExists(db, table)) return 0;
        try (Cursor cursor = db.rawQuery("SELECT COUNT(*) FROM " + table, null)) {
            if (!cursor.moveToFirst()) throw new IllegalStateException("No se puede contar " + table);
            return cursor.getInt(0);
        }
    }

    @PluginMethod
    public void openNativeReader(PluginCall call) { open(call, "reader"); }

    @PluginMethod
    public void openNativeVideos(PluginCall call) { open(call, "videos"); }
}
