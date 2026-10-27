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
                // Verify on-disk references before any planned migration.
                // An SQLite record alone does not mean its original is recoverable.
                File root = new File(getContext().getFilesDir(), "reading-library");
                int[] sources = auditReferences(db, root, "books");
                int[] tracks = auditReferences(db, root, "audio_tracks");
                int[] derived = auditReferences(db, root, "reading_derived");
                result.put("missingBookSources", sources[0]);
                result.put("missingAudioTracks", tracks[0]);
                result.put("missingDerivedFiles", derived[0]);
                result.put("unsafeStoredPaths", sources[1] + tracks[1] + derived[1]);
                result.put("preflightSafe", sources[0] + tracks[0] + derived[0] +
                        sources[1] + tracks[1] + derived[1] == 0);
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

    /**
     * Check stored references against the existing private file tree.
     * Never follow a path out of that tree, open a file for writing, or
     * silently treat a missing source as a successfully migrated book.
     * Result: [missing/unreadable, path escapes]. Old schema versions may
     * legitimately lack audio_tracks or reading_derived.
     */
    private static int[] auditReferences(SQLiteDatabase db, File root, String table) {
        if (!tableExists(db, table)) return new int[]{0, 0};
        if (!"books".equals(table) && !"audio_tracks".equals(table)
                && !"reading_derived".equals(table))
            throw new IllegalArgumentException("Tabla de archivos no reconocida");
        int missing = 0;
        int unsafe = 0;
        try (Cursor cursor = db.rawQuery("SELECT relative_path FROM " + table, null)) {
            while (cursor.moveToNext()) {
                String reference = cursor.isNull(0) ? "" : cursor.getString(0);
                try {
                    if (reference.trim().isEmpty()) {
                        missing++;
                        continue;
                    }
                    String rootPath = root.getCanonicalPath();
                    File candidate = new File(root, reference);
                    String candidatePath = candidate.getCanonicalPath();
                    if (!candidatePath.startsWith(rootPath + File.separator)) {
                        unsafe++;
                    } else if (!candidate.isFile() || !candidate.canRead()) {
                        missing++;
                    }
                } catch (java.io.IOException error) {
                    unsafe++;
                }
            }
        }
        return new int[]{missing, unsafe};
    }

    @PluginMethod
    public void openNativeReader(PluginCall call) { open(call, "reader"); }

    @PluginMethod
    public void openNativeVideos(PluginCall call) { open(call, "videos"); }
}
