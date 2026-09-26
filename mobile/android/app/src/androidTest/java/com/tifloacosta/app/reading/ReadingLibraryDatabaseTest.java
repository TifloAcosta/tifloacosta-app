package com.tifloacosta.app.reading;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;

import android.content.Context;
import android.database.sqlite.SQLiteConstraintException;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.List;

@RunWith(AndroidJUnit4.class)
public class ReadingLibraryDatabaseTest {
    private Context context;
    private ReadingLibraryDatabase database;

    @Before
    public void setUp() {
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        context.deleteDatabase("tiflo_reading.db");
        database = new ReadingLibraryDatabase(context);
        database.getWritableDatabase();
    }

    @After
    public void tearDown() {
        database.close();
        context.deleteDatabase("tiflo_reading.db");
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
                "reading-library/items/" + id + "/source.txt",
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
        assertThrows(SQLiteConstraintException.class, () -> database.insert(
                book("b", "sha-a", "Duplicate bytes", 20, null, "not-read", 0, 0)
        ));
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
