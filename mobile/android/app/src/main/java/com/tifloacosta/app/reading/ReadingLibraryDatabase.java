package com.tifloacosta.app.reading;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import java.util.ArrayList;
import java.util.List;

public final class ReadingLibraryDatabase extends SQLiteOpenHelper implements ReadingBookRepository {
    public static final String DATABASE_NAME = "tiflo_reading.db";
    public static final int DATABASE_VERSION = 1;

    private static final String TABLE_BOOKS = "books";
    private static final String[] BOOK_COLUMNS = {
            "id",
            "sha256",
            "title",
            "format",
            "mime_type",
            "relative_path",
            "size_bytes",
            "imported_at",
            "last_read_at",
            "state",
            "block_index",
            "percent"
    };

    public ReadingLibraryDatabase(Context context) {
        super(context, DATABASE_NAME, null, DATABASE_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL(
                "CREATE TABLE " + TABLE_BOOKS + " (" +
                        "id TEXT PRIMARY KEY," +
                        "sha256 TEXT NOT NULL UNIQUE," +
                        "title TEXT NOT NULL," +
                        "format TEXT NOT NULL," +
                        "mime_type TEXT NOT NULL," +
                        "relative_path TEXT NOT NULL," +
                        "size_bytes INTEGER NOT NULL," +
                        "imported_at INTEGER NOT NULL," +
                        "last_read_at INTEGER," +
                        "state TEXT NOT NULL DEFAULT 'not-read' CHECK(state IN ('not-read','in-reading','read'))," +
                        "block_index INTEGER NOT NULL DEFAULT 0," +
                        "percent REAL NOT NULL DEFAULT 0" +
                        ")"
        );
        db.execSQL("CREATE INDEX books_title_index ON " + TABLE_BOOKS + "(title COLLATE NOCASE)");
        db.execSQL("CREATE INDEX books_state_last_read_index ON " + TABLE_BOOKS + "(state, last_read_at DESC)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        throw new IllegalStateException(
                "Reading database migration required from version " + oldVersion + " to " + newVersion
        );
    }

    @Override
    public ReadingBookRecord findById(String id) {
        return findOne("id = ?", new String[]{id}, null);
    }

    @Override
    public ReadingBookRecord findBySha256(String sha256) {
        return findOne("sha256 = ?", new String[]{sha256}, null);
    }

    @Override
    public List<ReadingBookRecord> list(ReadingBookQuery query) {
        Selection selection = buildSelection(query);
        List<ReadingBookRecord> records = new ArrayList<>();
        try (Cursor cursor = getReadableDatabase().query(
                TABLE_BOOKS,
                BOOK_COLUMNS,
                selection.sql,
                selection.args,
                null,
                null,
                orderBy(query.getSort()),
                query.getOffset() + "," + query.getLimit()
        )) {
            while (cursor.moveToNext()) {
                records.add(readRecord(cursor));
            }
        }
        return records;
    }

    @Override
    public int count(ReadingBookQuery query) {
        Selection selection = buildSelection(query);
        String sql = "SELECT COUNT(*) FROM " + TABLE_BOOKS;
        if (selection.sql != null) {
            sql += " WHERE " + selection.sql;
        }
        try (Cursor cursor = getReadableDatabase().rawQuery(sql, selection.args)) {
            if (!cursor.moveToFirst()) {
                return 0;
            }
            return cursor.getInt(0);
        }
    }

    @Override
    public ReadingBookRecord latestInProgress() {
        return findOne(
                "state = ?",
                new String[]{"in-reading"},
                "last_read_at IS NULL ASC, last_read_at DESC, imported_at DESC, id ASC"
        );
    }

    @Override
    public void insert(ReadingBookRecord record) {
        getWritableDatabase().insertOrThrow(TABLE_BOOKS, null, valuesFor(record));
    }

    @Override
    public void updateProgress(String id, int blockIndex, double percent, String state, long lastReadAt) {
        requireState(state);
        ContentValues values = new ContentValues();
        values.put("block_index", blockIndex);
        values.put("percent", percent);
        values.put("state", state);
        values.put("last_read_at", lastReadAt);
        getWritableDatabase().update(TABLE_BOOKS, values, "id = ?", new String[]{id});
    }

    @Override
    public void delete(String id) {
        getWritableDatabase().delete(TABLE_BOOKS, "id = ?", new String[]{id});
    }

    private ReadingBookRecord findOne(String selection, String[] args, String orderBy) {
        try (Cursor cursor = getReadableDatabase().query(
                TABLE_BOOKS,
                BOOK_COLUMNS,
                selection,
                args,
                null,
                null,
                orderBy,
                "1"
        )) {
            if (!cursor.moveToFirst()) {
                return null;
            }
            return readRecord(cursor);
        }
    }

    private static ContentValues valuesFor(ReadingBookRecord record) {
        requireState(record.getState());
        ContentValues values = new ContentValues();
        values.put("id", record.getId());
        values.put("sha256", record.getSha256());
        values.put("title", record.getTitle());
        values.put("format", record.getFormat());
        values.put("mime_type", record.getMimeType());
        values.put("relative_path", record.getRelativePath());
        values.put("size_bytes", record.getSizeBytes());
        values.put("imported_at", record.getImportedAt());
        if (record.getLastReadAt() == null) {
            values.putNull("last_read_at");
        } else {
            values.put("last_read_at", record.getLastReadAt());
        }
        values.put("state", record.getState());
        values.put("block_index", record.getBlockIndex());
        values.put("percent", record.getPercent());
        return values;
    }

    private static ReadingBookRecord readRecord(Cursor cursor) {
        int lastReadColumn = cursor.getColumnIndexOrThrow("last_read_at");
        Long lastReadAt = cursor.isNull(lastReadColumn) ? null : cursor.getLong(lastReadColumn);
        return new ReadingBookRecord(
                cursor.getString(cursor.getColumnIndexOrThrow("id")),
                cursor.getString(cursor.getColumnIndexOrThrow("sha256")),
                cursor.getString(cursor.getColumnIndexOrThrow("title")),
                cursor.getString(cursor.getColumnIndexOrThrow("format")),
                cursor.getString(cursor.getColumnIndexOrThrow("mime_type")),
                cursor.getString(cursor.getColumnIndexOrThrow("relative_path")),
                cursor.getLong(cursor.getColumnIndexOrThrow("size_bytes")),
                cursor.getLong(cursor.getColumnIndexOrThrow("imported_at")),
                lastReadAt,
                cursor.getString(cursor.getColumnIndexOrThrow("state")),
                cursor.getInt(cursor.getColumnIndexOrThrow("block_index")),
                cursor.getDouble(cursor.getColumnIndexOrThrow("percent"))
        );
    }

    private static Selection buildSelection(ReadingBookQuery query) {
        List<String> clauses = new ArrayList<>();
        List<String> args = new ArrayList<>();

        if (!query.getQuery().isEmpty()) {
            clauses.add("title LIKE ? COLLATE NOCASE");
            args.add("%" + query.getQuery() + "%");
        }
        if (!"all".equals(query.getStatus())) {
            clauses.add("state = ?");
            args.add(query.getStatus());
        }

        String sql = clauses.isEmpty() ? null : String.join(" AND ", clauses);
        return new Selection(sql, args.toArray(new String[0]));
    }

    private static String orderBy(String sort) {
        switch (sort) {
            case "title":
                return "title COLLATE NOCASE ASC, imported_at DESC, id ASC";
            case "imported":
                return "imported_at DESC, id ASC";
            case "lastRead":
                return "last_read_at IS NULL ASC, last_read_at DESC, imported_at DESC, id ASC";
            default:
                throw new IllegalArgumentException("Unsupported reading sort: " + sort);
        }
    }

    private static void requireState(String state) {
        if (!"not-read".equals(state) && !"in-reading".equals(state) && !"read".equals(state)) {
            throw new IllegalArgumentException("Unsupported reading state: " + state);
        }
    }

    private static final class Selection {
        private final String sql;
        private final String[] args;

        private Selection(String sql, String[] args) {
            this.sql = sql;
            this.args = args;
        }
    }
}
