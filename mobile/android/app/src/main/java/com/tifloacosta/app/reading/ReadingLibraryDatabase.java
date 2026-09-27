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
    public static final int DATABASE_VERSION = 4;

    private static final String TABLE_BOOKS = "books";
    private static final String TABLE_MARKS = "marks";
    private static final String TABLE_SETTINGS = "reading_settings";
    private static final String TABLE_AUDIO_TRACKS = "audio_tracks";

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
            "unit_index",
            "anchor_text",
            "media_track_index",
            "media_position_ms",
            "percent"
    };

    private static final String[] MARK_COLUMNS = {
            "id",
            "book_id",
            "type",
            "block_index",
            "unit_index",
            "media_track_index",
            "media_position_ms",
            "excerpt",
            "reference",
            "created_at"
    };

    private static final String[] SETTING_COLUMNS = {
            "scope",
            "book_id",
            "key",
            "value",
            "updated_at"
    };

    private static final String[] AUDIO_TRACK_COLUMNS = {
            "book_id",
            "track_index",
            "relative_path",
            "original_name",
            "title",
            "duration_ms",
            "embedded_track_number",
            "size_bytes"
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
                        "unit_index INTEGER NOT NULL DEFAULT 0," +
                        "anchor_text TEXT," +
                        "media_track_index INTEGER NOT NULL DEFAULT 0," +
                        "media_position_ms INTEGER NOT NULL DEFAULT 0," +
                        "percent REAL NOT NULL DEFAULT 0" +
                        ")"
        );
        createBookIndexes(db);
        createV3Tables(db);
        createV4Tables(db);
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        int version = oldVersion;
        if (version == 1 && newVersion >= 2) {
            db.execSQL("ALTER TABLE " + TABLE_BOOKS + " ADD COLUMN unit_index INTEGER NOT NULL DEFAULT 0");
            db.execSQL("ALTER TABLE " + TABLE_BOOKS + " ADD COLUMN anchor_text TEXT");
            createV2Tables(db);
            version = 2;
        }
        if (version == 2 && newVersion >= 3) {
            db.execSQL("ALTER TABLE " + TABLE_BOOKS + " ADD COLUMN media_track_index INTEGER NOT NULL DEFAULT 0");
            db.execSQL("ALTER TABLE " + TABLE_BOOKS + " ADD COLUMN media_position_ms INTEGER NOT NULL DEFAULT 0");
            db.execSQL("ALTER TABLE " + TABLE_MARKS + " ADD COLUMN media_track_index INTEGER NOT NULL DEFAULT 0");
            db.execSQL("ALTER TABLE " + TABLE_MARKS + " ADD COLUMN media_position_ms INTEGER NOT NULL DEFAULT 0");
            version = 3;
        }
        if (version == 3 && newVersion >= 4) {
            createV4Tables(db);
            backfillLegacyAudioTracks(db);
            version = 4;
        }
        if (version != newVersion) {
            throw new IllegalStateException(
                    "Reading database migration required from version " + version + " to " + newVersion
            );
        }
    }

    private static void createBookIndexes(SQLiteDatabase db) {
        db.execSQL("CREATE INDEX IF NOT EXISTS books_title_index ON " + TABLE_BOOKS + "(title COLLATE NOCASE)");
        db.execSQL("CREATE INDEX IF NOT EXISTS books_state_last_read_index ON " + TABLE_BOOKS + "(state, last_read_at DESC)");
    }

    private static void createV2Tables(SQLiteDatabase db) {
        db.execSQL(
                "CREATE TABLE IF NOT EXISTS " + TABLE_MARKS + " (" +
                        "id TEXT PRIMARY KEY," +
                        "book_id TEXT NOT NULL," +
                        "type TEXT NOT NULL CHECK(type IN ('bookmark','important','review','quote'))," +
                        "block_index INTEGER NOT NULL," +
                        "unit_index INTEGER NOT NULL," +
                        "excerpt TEXT," +
                        "reference TEXT," +
                        "created_at INTEGER NOT NULL" +
                        ")"
        );
        createMarkIndexes(db);
        createSettingsTable(db);
    }

    private static void createV3Tables(SQLiteDatabase db) {
        db.execSQL(
                "CREATE TABLE IF NOT EXISTS " + TABLE_MARKS + " (" +
                        "id TEXT PRIMARY KEY," +
                        "book_id TEXT NOT NULL," +
                        "type TEXT NOT NULL CHECK(type IN ('bookmark','important','review','quote'))," +
                        "block_index INTEGER NOT NULL," +
                        "unit_index INTEGER NOT NULL," +
                        "media_track_index INTEGER NOT NULL DEFAULT 0," +
                        "media_position_ms INTEGER NOT NULL DEFAULT 0," +
                        "excerpt TEXT," +
                        "reference TEXT," +
                        "created_at INTEGER NOT NULL" +
                        ")"
        );
        createMarkIndexes(db);
        createSettingsTable(db);
    }

    private static void createV4Tables(SQLiteDatabase db) {
        db.execSQL(
                "CREATE TABLE IF NOT EXISTS " + TABLE_AUDIO_TRACKS + " (" +
                        "book_id TEXT NOT NULL," +
                        "track_index INTEGER NOT NULL," +
                        "relative_path TEXT NOT NULL," +
                        "original_name TEXT NOT NULL," +
                        "title TEXT," +
                        "duration_ms INTEGER NOT NULL DEFAULT 0," +
                        "embedded_track_number INTEGER," +
                        "size_bytes INTEGER NOT NULL DEFAULT 0," +
                        "PRIMARY KEY(book_id, track_index)" +
                        ")"
        );
        db.execSQL(
                "CREATE INDEX IF NOT EXISTS audio_tracks_book_index ON " + TABLE_AUDIO_TRACKS +
                        "(book_id, track_index)"
        );
    }

    private static void backfillLegacyAudioTracks(SQLiteDatabase db) {
        db.execSQL(
                "INSERT OR IGNORE INTO " + TABLE_AUDIO_TRACKS +
                        "(book_id, track_index, relative_path, original_name, title, duration_ms, embedded_track_number, size_bytes) " +
                        "SELECT id, 0, relative_path, title, title, 0, NULL, size_bytes FROM " + TABLE_BOOKS +
                        " WHERE format = 'audio'"
        );
    }

    private static void createMarkIndexes(SQLiteDatabase db) {
        db.execSQL(
                "CREATE INDEX IF NOT EXISTS marks_book_position_index ON " + TABLE_MARKS +
                        "(book_id, block_index, unit_index, created_at, id)"
        );
        db.execSQL(
                "CREATE INDEX IF NOT EXISTS marks_book_type_position_index ON " + TABLE_MARKS +
                        "(book_id, type, block_index, unit_index, created_at, id)"
        );
    }

    private static void createSettingsTable(SQLiteDatabase db) {
        db.execSQL(
                "CREATE TABLE IF NOT EXISTS " + TABLE_SETTINGS + " (" +
                        "scope TEXT NOT NULL CHECK(scope IN ('global','book'))," +
                        "book_id TEXT NOT NULL DEFAULT ''," +
                        "key TEXT NOT NULL," +
                        "value TEXT NOT NULL," +
                        "updated_at INTEGER NOT NULL," +
                        "PRIMARY KEY(scope, book_id, key)" +
                        ")"
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
    public void insertAudioTracks(String bookId, List<ReadingAudioTrackRecord> tracks) {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            db.delete(TABLE_AUDIO_TRACKS, "book_id = ?", new String[]{bookId});
            int expectedIndex = 0;
            for (ReadingAudioTrackRecord track : tracks) {
                if (track == null || !bookId.equals(track.getBookId()) || track.getTrackIndex() != expectedIndex) {
                    throw new IllegalArgumentException("Audio tracks must belong to the book and use contiguous indexes");
                }
                ContentValues values = new ContentValues();
                values.put("book_id", track.getBookId());
                values.put("track_index", track.getTrackIndex());
                values.put("relative_path", track.getRelativePath());
                values.put("original_name", track.getOriginalName());
                putNullable(values, "title", track.getTitle());
                values.put("duration_ms", track.getDurationMs());
                if (track.getEmbeddedTrackNumber() == null) values.putNull("embedded_track_number");
                else values.put("embedded_track_number", track.getEmbeddedTrackNumber());
                values.put("size_bytes", track.getSizeBytes());
                db.insertOrThrow(TABLE_AUDIO_TRACKS, null, values);
                expectedIndex += 1;
            }
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }

    @Override
    public List<ReadingAudioTrackRecord> listAudioTracks(String bookId) {
        List<ReadingAudioTrackRecord> records = new ArrayList<>();
        try (Cursor cursor = getReadableDatabase().query(
                TABLE_AUDIO_TRACKS,
                AUDIO_TRACK_COLUMNS,
                "book_id = ?",
                new String[]{bookId},
                null,
                null,
                "track_index ASC"
        )) {
            while (cursor.moveToNext()) records.add(readAudioTrack(cursor));
        }
        return records;
    }

    @Override
    public void updateProgress(String id, int blockIndex, double percent, String state, long lastReadAt) {
        updateProgress(id, blockIndex, 0, null, 0, 0L, percent, state, lastReadAt);
    }

    @Override
    public void updateProgress(
            String id,
            int blockIndex,
            int unitIndex,
            String anchorText,
            double percent,
            String state,
            long lastReadAt
    ) {
        updateProgress(id, blockIndex, unitIndex, anchorText, 0, 0L, percent, state, lastReadAt);
    }

    @Override
    public void updateProgress(
            String id,
            int blockIndex,
            int unitIndex,
            String anchorText,
            int mediaTrackIndex,
            long mediaPositionMs,
            double percent,
            String state,
            long lastReadAt
    ) {
        requireState(state);
        ContentValues values = new ContentValues();
        values.put("block_index", blockIndex);
        values.put("unit_index", unitIndex);
        if (anchorText == null) values.putNull("anchor_text");
        else values.put("anchor_text", anchorText);
        values.put("media_track_index", mediaTrackIndex);
        values.put("media_position_ms", mediaPositionMs);
        values.put("percent", percent);
        values.put("state", state);
        values.put("last_read_at", lastReadAt);
        getWritableDatabase().update(TABLE_BOOKS, values, "id = ?", new String[]{id});
    }

    @Override
    public void insertMark(ReadingMarkRecord record) {
        requireMarkType(record.getType());
        ContentValues values = new ContentValues();
        values.put("id", record.getId());
        values.put("book_id", record.getBookId());
        values.put("type", record.getType());
        values.put("block_index", record.getBlockIndex());
        values.put("unit_index", record.getUnitIndex());
        values.put("media_track_index", record.getMediaTrackIndex());
        values.put("media_position_ms", record.getMediaPositionMs());
        putNullable(values, "excerpt", record.getExcerpt());
        putNullable(values, "reference", record.getReference());
        values.put("created_at", record.getCreatedAt());
        getWritableDatabase().insertOrThrow(TABLE_MARKS, null, values);
    }

    @Override
    public List<ReadingMarkRecord> listMarks(String bookId, String type) {
        String selection = "book_id = ?";
        List<String> args = new ArrayList<>();
        args.add(bookId);
        if (type != null && !type.isEmpty()) {
            requireMarkType(type);
            selection += " AND type = ?";
            args.add(type);
        }

        List<ReadingMarkRecord> records = new ArrayList<>();
        try (Cursor cursor = getReadableDatabase().query(
                TABLE_MARKS,
                MARK_COLUMNS,
                selection,
                args.toArray(new String[0]),
                null,
                null,
                "block_index ASC, unit_index ASC, media_track_index ASC, media_position_ms ASC, created_at ASC, id ASC"
        )) {
            while (cursor.moveToNext()) records.add(readMark(cursor));
        }
        return records;
    }

    @Override
    public void deleteMark(String id) {
        getWritableDatabase().delete(TABLE_MARKS, "id = ?", new String[]{id});
    }

    @Override
    public ReadingSettingsRecord getReadingSetting(String scope, String bookId, String key) {
        requireSettingScope(scope, bookId);
        try (Cursor cursor = getReadableDatabase().query(
                TABLE_SETTINGS,
                SETTING_COLUMNS,
                "scope = ? AND book_id = ? AND key = ?",
                new String[]{scope, normalizedBookId(bookId), key},
                null,
                null,
                null,
                "1"
        )) {
            if (!cursor.moveToFirst()) return null;
            return readSetting(cursor);
        }
    }

    @Override
    public void setReadingSetting(ReadingSettingsRecord record) {
        requireSettingScope(record.getScope(), record.getBookId());
        ContentValues values = new ContentValues();
        values.put("scope", record.getScope());
        values.put("book_id", normalizedBookId(record.getBookId()));
        values.put("key", record.getKey());
        values.put("value", record.getValue());
        values.put("updated_at", record.getUpdatedAt());
        getWritableDatabase().insertWithOnConflict(
                TABLE_SETTINGS,
                null,
                values,
                SQLiteDatabase.CONFLICT_REPLACE
        );
    }

    @Override
    public void resetBookReadingSettings(String bookId) {
        getWritableDatabase().delete(
                TABLE_SETTINGS,
                "scope = ? AND book_id = ?",
                new String[]{"book", normalizedBookId(bookId)}
        );
    }

    @Override
    public void delete(String id) {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            db.delete(TABLE_AUDIO_TRACKS, "book_id = ?", new String[]{id});
            db.delete(TABLE_MARKS, "book_id = ?", new String[]{id});
            db.delete(TABLE_SETTINGS, "scope = ? AND book_id = ?", new String[]{"book", id});
            db.delete(TABLE_BOOKS, "id = ?", new String[]{id});
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
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
            if (!cursor.moveToFirst()) return null;
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
        if (record.getLastReadAt() == null) values.putNull("last_read_at");
        else values.put("last_read_at", record.getLastReadAt());
        values.put("state", record.getState());
        values.put("block_index", record.getBlockIndex());
        values.put("unit_index", record.getUnitIndex());
        putNullable(values, "anchor_text", record.getAnchorText());
        values.put("media_track_index", record.getMediaTrackIndex());
        values.put("media_position_ms", record.getMediaPositionMs());
        values.put("percent", record.getPercent());
        return values;
    }

    private static ReadingBookRecord readRecord(Cursor cursor) {
        int lastReadColumn = cursor.getColumnIndexOrThrow("last_read_at");
        Long lastReadAt = cursor.isNull(lastReadColumn) ? null : cursor.getLong(lastReadColumn);
        int anchorColumn = cursor.getColumnIndexOrThrow("anchor_text");
        String anchorText = cursor.isNull(anchorColumn) ? null : cursor.getString(anchorColumn);
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
                cursor.getInt(cursor.getColumnIndexOrThrow("unit_index")),
                anchorText,
                cursor.getInt(cursor.getColumnIndexOrThrow("media_track_index")),
                cursor.getLong(cursor.getColumnIndexOrThrow("media_position_ms")),
                cursor.getDouble(cursor.getColumnIndexOrThrow("percent"))
        );
    }

    private static ReadingAudioTrackRecord readAudioTrack(Cursor cursor) {
        int titleColumn = cursor.getColumnIndexOrThrow("title");
        int embeddedColumn = cursor.getColumnIndexOrThrow("embedded_track_number");
        return new ReadingAudioTrackRecord(
                cursor.getString(cursor.getColumnIndexOrThrow("book_id")),
                cursor.getInt(cursor.getColumnIndexOrThrow("track_index")),
                cursor.getString(cursor.getColumnIndexOrThrow("relative_path")),
                cursor.getString(cursor.getColumnIndexOrThrow("original_name")),
                cursor.isNull(titleColumn) ? null : cursor.getString(titleColumn),
                cursor.getLong(cursor.getColumnIndexOrThrow("duration_ms")),
                cursor.isNull(embeddedColumn) ? null : cursor.getInt(embeddedColumn),
                cursor.getLong(cursor.getColumnIndexOrThrow("size_bytes"))
        );
    }

    private static ReadingMarkRecord readMark(Cursor cursor) {
        int excerptColumn = cursor.getColumnIndexOrThrow("excerpt");
        int referenceColumn = cursor.getColumnIndexOrThrow("reference");
        return new ReadingMarkRecord(
                cursor.getString(cursor.getColumnIndexOrThrow("id")),
                cursor.getString(cursor.getColumnIndexOrThrow("book_id")),
                cursor.getString(cursor.getColumnIndexOrThrow("type")),
                cursor.getInt(cursor.getColumnIndexOrThrow("block_index")),
                cursor.getInt(cursor.getColumnIndexOrThrow("unit_index")),
                cursor.getInt(cursor.getColumnIndexOrThrow("media_track_index")),
                cursor.getLong(cursor.getColumnIndexOrThrow("media_position_ms")),
                cursor.isNull(excerptColumn) ? null : cursor.getString(excerptColumn),
                cursor.isNull(referenceColumn) ? null : cursor.getString(referenceColumn),
                cursor.getLong(cursor.getColumnIndexOrThrow("created_at"))
        );
    }

    private static ReadingSettingsRecord readSetting(Cursor cursor) {
        return new ReadingSettingsRecord(
                cursor.getString(cursor.getColumnIndexOrThrow("scope")),
                cursor.getString(cursor.getColumnIndexOrThrow("book_id")),
                cursor.getString(cursor.getColumnIndexOrThrow("key")),
                cursor.getString(cursor.getColumnIndexOrThrow("value")),
                cursor.getLong(cursor.getColumnIndexOrThrow("updated_at"))
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

    private static void requireMarkType(String type) {
        if (!"bookmark".equals(type)
                && !"important".equals(type)
                && !"review".equals(type)
                && !"quote".equals(type)) {
            throw new IllegalArgumentException("Unsupported reading mark type: " + type);
        }
    }

    private static void requireSettingScope(String scope, String bookId) {
        if ("global".equals(scope)) {
            if (bookId != null && !bookId.isEmpty()) {
                throw new IllegalArgumentException("Global reading settings cannot have a book id");
            }
            return;
        }
        if ("book".equals(scope)) {
            if (bookId == null || bookId.isEmpty()) {
                throw new IllegalArgumentException("Book reading settings require a book id");
            }
            return;
        }
        throw new IllegalArgumentException("Unsupported reading setting scope: " + scope);
    }

    private static String normalizedBookId(String bookId) {
        return bookId == null ? "" : bookId;
    }

    private static void putNullable(ContentValues values, String key, String value) {
        if (value == null) values.putNull(key);
        else values.put(key, value);
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
