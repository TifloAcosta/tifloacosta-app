package com.tifloacosta.app.reading;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.fail;

import android.content.ContentValues;
import android.content.Context;
import android.database.sqlite.SQLiteConstraintException;
import android.database.sqlite.SQLiteDatabase;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.ArrayList;
import java.util.List;

@RunWith(AndroidJUnit4.class)
public class ReadingLibraryDatabaseTest {
    private Context context;
    private ReadingLibraryDatabase database;

    @Before
    public void setUp() {
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        context.deleteDatabase(ReadingLibraryDatabase.DATABASE_NAME);
        database = new ReadingLibraryDatabase(context);
        database.getWritableDatabase();
    }

    @After
    public void tearDown() {
        if (database != null) database.close();
        context.deleteDatabase(ReadingLibraryDatabase.DATABASE_NAME);
    }

    private ReadingBookRecord book(
            String id,
            String sha,
            String title,
            long importedAt,
            Long lastReadAt,
            String state,
            int blockIndex,
            double percent
    ) {
        return new ReadingBookRecord(
                id,
                sha,
                title,
                "txt",
                "text/plain",
                "items/" + id + "/source.txt",
                100 + importedAt,
                importedAt,
                lastReadAt,
                state,
                blockIndex,
                percent
        );
    }

    @Test
    public void insertFindAndShaUniqueness() {
        ReadingBookRecord first = book("a", "sha-a", "Alpha", 10, null, "not-read", 0, 0);
        database.insert(first);

        assertEquals("Alpha", database.findById("a").getTitle());
        assertEquals("a", database.findBySha256("sha-a").getId());

        try {
            database.insert(book("b", "sha-a", "Duplicate bytes", 20, null, "not-read", 0, 0));
            fail("Expected duplicate SHA-256 to violate the database uniqueness constraint");
        } catch (SQLiteConstraintException expected) {
            // Expected: duplicate source bytes must not create a second library entry.
        }
    }

    @Test
    public void listUsesTenItemPagingAndTitleSearch() {
        for (int i = 1; i <= 15; i++) {
            database.insert(book(
                    "id-" + i,
                    "sha-" + i,
                    i == 12 ? "Needle Book" : "Book " + i,
                    i,
                    null,
                    "not-read",
                    0,
                    0
            ));
        }

        ReadingBookQuery firstPage = new ReadingBookQuery("", "all", "imported", 10, 0);
        ReadingBookQuery secondPage = new ReadingBookQuery("", "all", "imported", 10, 10);
        ReadingBookQuery search = new ReadingBookQuery("needle", "all", "title", 10, 0);

        assertEquals(10, database.list(firstPage).size());
        assertEquals(5, database.list(secondPage).size());
        assertEquals(15, database.count(firstPage));
        assertEquals(1, database.count(search));
        assertEquals("Needle Book", database.list(search).get(0).getTitle());
    }

    @Test
    public void preciseProgressStoresBlockSentenceAnchorAndExistingProgressFields() {
        database.insert(book("a", "sha-a", "Alpha", 10, 100L, "in-reading", 1, 20));

        database.updateProgress("a", 7, 3, "frase cercana", 75.5, "in-reading", 500L);
        ReadingBookRecord updated = database.findById("a");

        assertEquals(7, updated.getBlockIndex());
        assertEquals(3, updated.getUnitIndex());
        assertEquals("frase cercana", updated.getAnchorText());
        assertEquals(0, updated.getMediaTrackIndex());
        assertEquals(0L, updated.getMediaPositionMs());
        assertEquals(75.5, updated.getPercent(), 0.001);
        assertEquals(500L, updated.getLastReadAt().longValue());
    }

    @Test
    public void exactAudioProgressAndMarksPreserveLongMillisecondPositions() {
        database.insert(book("audio", "sha-audio", "Audio", 10, null, "not-read", 0, 0));

        database.updateProgress("audio", 0, 0, null, 3, 5000000000L, 42.5, "in-reading", 700L);
        database.insertMark(new ReadingMarkRecord(
                "audio-mark",
                "audio",
                "bookmark",
                0,
                0,
                3,
                5000000000L,
                null,
                "Pista 4, 1388:53",
                710L
        ));

        ReadingBookRecord updated = database.findById("audio");
        assertEquals(3, updated.getMediaTrackIndex());
        assertEquals(5000000000L, updated.getMediaPositionMs());
        assertEquals(42.5, updated.getPercent(), 0.001);

        ReadingMarkRecord mark = database.listMarks("audio", null).get(0);
        assertEquals(3, mark.getMediaTrackIndex());
        assertEquals(5000000000L, mark.getMediaPositionMs());
    }

    @Test
    public void audioTracksStayOrderedAndDeleteWithTheirBook() {
        ReadingBookRecord audio = new ReadingBookRecord(
                "audio-book",
                "audio-sha",
                "Audiolibro",
                "audio",
                "audio/mp4",
                "items/audio-book/track-0001.m4b",
                600L,
                10L,
                null,
                "not-read",
                0,
                0.0
        );
        database.insert(audio);

        List<ReadingAudioTrackRecord> tracks = new ArrayList<>();
        tracks.add(new ReadingAudioTrackRecord(
                "audio-book", 0, "items/audio-book/track-0001.m4b", "01.m4b", "Uno", 1000L, 1, 300L
        ));
        tracks.add(new ReadingAudioTrackRecord(
                "audio-book", 1, "items/audio-book/track-0002.m4b", "02.m4b", "Dos", 2000L, 2, 300L
        ));
        database.insertAudioTracks("audio-book", tracks);

        List<ReadingAudioTrackRecord> stored = database.listAudioTracks("audio-book");
        assertEquals(2, stored.size());
        assertEquals(0, stored.get(0).getTrackIndex());
        assertEquals(1, stored.get(1).getTrackIndex());
        assertEquals(2000L, stored.get(1).getDurationMs());

        database.delete("audio-book");
        assertNull(database.findById("audio-book"));
        assertEquals(0, database.listAudioTracks("audio-book").size());
    }

    @Test
    public void v1DatabaseMigratesToV4WithoutLosingBookOrProgress() {
        database.close();
        context.deleteDatabase(ReadingLibraryDatabase.DATABASE_NAME);

        SQLiteDatabase legacy = context.openOrCreateDatabase(
                ReadingLibraryDatabase.DATABASE_NAME,
                Context.MODE_PRIVATE,
                null
        );
        legacy.execSQL(
                "CREATE TABLE books (" +
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
        ContentValues values = new ContentValues();
        values.put("id", "legacy");
        values.put("sha256", "legacy-sha");
        values.put("title", "Libro anterior");
        values.put("format", "txt");
        values.put("mime_type", "text/plain");
        values.put("relative_path", "items/legacy/source.txt");
        values.put("size_bytes", 321L);
        values.put("imported_at", 10L);
        values.put("last_read_at", 20L);
        values.put("state", "in-reading");
        values.put("block_index", 9);
        values.put("percent", 44.5);
        legacy.insertOrThrow("books", null, values);
        legacy.setVersion(1);
        legacy.close();

        database = new ReadingLibraryDatabase(context);
        ReadingBookRecord migrated = database.findById("legacy");

        assertNotNull(migrated);
        assertEquals(4, database.getReadableDatabase().getVersion());
        assertEquals("Libro anterior", migrated.getTitle());
        assertEquals(9, migrated.getBlockIndex());
        assertEquals(0, migrated.getUnitIndex());
        assertNull(migrated.getAnchorText());
        assertEquals(0, migrated.getMediaTrackIndex());
        assertEquals(0L, migrated.getMediaPositionMs());
        assertEquals(44.5, migrated.getPercent(), 0.001);
        assertEquals("in-reading", migrated.getState());
    }

    @Test
    public void v2DatabaseMigratesToV4WithoutLosingBookMarksOrProgress() {
        database.close();
        context.deleteDatabase(ReadingLibraryDatabase.DATABASE_NAME);

        SQLiteDatabase legacy = context.openOrCreateDatabase(
                ReadingLibraryDatabase.DATABASE_NAME,
                Context.MODE_PRIVATE,
                null
        );
        legacy.execSQL(
                "CREATE TABLE books (" +
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
                        "percent REAL NOT NULL DEFAULT 0" +
                        ")"
        );
        legacy.execSQL(
                "CREATE TABLE marks (" +
                        "id TEXT PRIMARY KEY," +
                        "book_id TEXT NOT NULL," +
                        "type TEXT NOT NULL," +
                        "block_index INTEGER NOT NULL," +
                        "unit_index INTEGER NOT NULL," +
                        "excerpt TEXT," +
                        "reference TEXT," +
                        "created_at INTEGER NOT NULL" +
                        ")"
        );
        legacy.execSQL(
                "CREATE TABLE reading_settings (" +
                        "scope TEXT NOT NULL," +
                        "book_id TEXT NOT NULL DEFAULT ''," +
                        "key TEXT NOT NULL," +
                        "value TEXT NOT NULL," +
                        "updated_at INTEGER NOT NULL," +
                        "PRIMARY KEY(scope, book_id, key)" +
                        ")"
        );

        ContentValues bookValues = new ContentValues();
        bookValues.put("id", "v2");
        bookValues.put("sha256", "v2-sha");
        bookValues.put("title", "Libro v2");
        bookValues.put("format", "txt");
        bookValues.put("mime_type", "text/plain");
        bookValues.put("relative_path", "items/v2/source.txt");
        bookValues.put("size_bytes", 400L);
        bookValues.put("imported_at", 30L);
        bookValues.put("last_read_at", 40L);
        bookValues.put("state", "in-reading");
        bookValues.put("block_index", 6);
        bookValues.put("unit_index", 2);
        bookValues.put("anchor_text", "ancla v2");
        bookValues.put("percent", 62.0);
        legacy.insertOrThrow("books", null, bookValues);

        ContentValues markValues = new ContentValues();
        markValues.put("id", "m-v2");
        markValues.put("book_id", "v2");
        markValues.put("type", "bookmark");
        markValues.put("block_index", 6);
        markValues.put("unit_index", 2);
        markValues.put("excerpt", "marca v2");
        markValues.put("reference", "Párrafo 7");
        markValues.put("created_at", 41L);
        legacy.insertOrThrow("marks", null, markValues);
        legacy.setVersion(2);
        legacy.close();

        database = new ReadingLibraryDatabase(context);
        ReadingBookRecord migrated = database.findById("v2");
        ReadingMarkRecord mark = database.listMarks("v2", null).get(0);

        assertEquals(4, database.getReadableDatabase().getVersion());
        assertEquals(6, migrated.getBlockIndex());
        assertEquals(2, migrated.getUnitIndex());
        assertEquals("ancla v2", migrated.getAnchorText());
        assertEquals(0, migrated.getMediaTrackIndex());
        assertEquals(0L, migrated.getMediaPositionMs());
        assertEquals("m-v2", mark.getId());
        assertEquals(0, mark.getMediaTrackIndex());
        assertEquals(0L, mark.getMediaPositionMs());
    }

    @Test
    public void marksAreOrderedFilteredAndValidated() {
        database.insert(book("a", "sha-a", "Alpha", 10, null, "not-read", 0, 0));
        database.insertMark(new ReadingMarkRecord("m3", "a", "review", 7, 0, "Tres", "Párrafo 8", 300L));
        database.insertMark(new ReadingMarkRecord("m1", "a", "bookmark", 2, 1, "Uno", "Párrafo 3", 100L));
        database.insertMark(new ReadingMarkRecord("m2", "a", "quote", 2, 4, "Dos", "Párrafo 3", 200L));

        List<ReadingMarkRecord> all = database.listMarks("a", null);
        assertEquals(3, all.size());
        assertEquals("m1", all.get(0).getId());
        assertEquals("m2", all.get(1).getId());
        assertEquals("m3", all.get(2).getId());

        List<ReadingMarkRecord> quotes = database.listMarks("a", "quote");
        assertEquals(1, quotes.size());
        assertEquals("m2", quotes.get(0).getId());

        database.deleteMark("m2");
        assertEquals(2, database.listMarks("a", null).size());

        try {
            database.insertMark(new ReadingMarkRecord("bad", "a", "other", 0, 0, null, null, 400L));
            fail("Expected unsupported mark type to be rejected");
        } catch (IllegalArgumentException expected) {
            // Only the four approved reading mark types are valid.
        }
    }

    @Test
    public void globalSettingsBookOverridesAndResetPreserveInheritance() {
        database.setReadingSetting(new ReadingSettingsRecord("global", "", "speech.rate", "1.0", 100L));
        database.setReadingSetting(new ReadingSettingsRecord("global", "", "speech.voice", "voz-global", 110L));
        database.setReadingSetting(new ReadingSettingsRecord("book", "a", "speech.voice", "voz-libro", 200L));

        assertEquals("1.0", database.getReadingSetting("global", "", "speech.rate").getValue());
        assertEquals("voz-global", database.getReadingSetting("global", "", "speech.voice").getValue());
        assertEquals("voz-libro", database.getReadingSetting("book", "a", "speech.voice").getValue());

        database.resetBookReadingSettings("a");

        assertNull(database.getReadingSetting("book", "a", "speech.voice"));
        assertEquals("voz-global", database.getReadingSetting("global", "", "speech.voice").getValue());
    }

    @Test
    public void deletingBookAlsoRemovesMarksAndBookSettingsButNotGlobalSettings() {
        database.insert(book("a", "sha-a", "Alpha", 10, null, "not-read", 0, 0));
        database.insertMark(new ReadingMarkRecord("m1", "a", "important", 1, 2, "Texto", "Párrafo 2", 100L));
        database.setReadingSetting(new ReadingSettingsRecord("book", "a", "speech.rate", "1.2", 100L));
        database.setReadingSetting(new ReadingSettingsRecord("global", "", "speech.rate", "1.0", 100L));

        database.delete("a");

        assertNull(database.findById("a"));
        assertEquals(0, database.listMarks("a", null).size());
        assertNull(database.getReadingSetting("book", "a", "speech.rate"));
        assertNotNull(database.getReadingSetting("global", "", "speech.rate"));
    }

    @Test
    public void statusSortProgressLatestAndDeleteWorkTogether() {
        database.insert(book("a", "sha-a", "Alpha", 10, 100L, "in-reading", 1, 20));
        database.insert(book("b", "sha-b", "Beta", 20, 300L, "in-reading", 2, 40));
        database.insert(book("c", "sha-c", "Gamma", 30, 200L, "read", 9, 100));

        ReadingBookQuery inReading = new ReadingBookQuery("", "in-reading", "lastRead", 10, 0);
        List<ReadingBookRecord> rows = database.list(inReading);

        assertEquals(2, rows.size());
        assertEquals("b", rows.get(0).getId());
        assertEquals("a", rows.get(1).getId());

        database.updateProgress("a", 7, 75.5, "in-reading", 500L);
        ReadingBookRecord updated = database.findById("a");
        assertEquals(7, updated.getBlockIndex());
        assertEquals(75.5, updated.getPercent(), 0.001);
        assertEquals(500L, updated.getLastReadAt().longValue());
        assertEquals("a", database.latestInProgress().getId());

        database.delete("a");
        assertNull(database.findById("a"));
        assertNotNull(database.findById("b"));
    }
}
