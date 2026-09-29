package com.tifloacosta.app.reading;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.io.File;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class ReadingTtsSessionStoreTest {
    private File tempRoot() throws Exception {
        return Files.createTempDirectory("tiflo-tts-store-").toFile();
    }

    @Test
    public void appendsChunksInOrderAndReloadsCommittedSession() throws Exception {
        File root = tempRoot();
        ReadingTtsSessionStore store = new ReadingTtsSessionStore(root);
        store.begin("session-1", "book-1", "Libro", "voice-a", 1.25f, 3, 1);
        store.append("session-1", Arrays.asList(
                new ReadingTtsUnit(3, 1, "Primera frase."),
                new ReadingTtsUnit(3, 2, "Segunda frase.")
        ));
        store.append("session-1", Arrays.asList(
                new ReadingTtsUnit(4, 0, "Tercera frase.")
        ));

        assertNull(store.load("session-1"));
        store.commit("session-1");

        ReadingTtsSessionStore.Session session = new ReadingTtsSessionStore(root).load("session-1");
        assertNotNull(session);
        assertEquals("book-1", session.getBookId());
        assertEquals("Libro", session.getTitle());
        assertEquals("voice-a", session.getVoiceId());
        assertEquals(1.25f, session.getRate(), 0.001f);
        assertEquals(3, session.getStartBlockIndex());
        assertEquals(1, session.getStartUnitIndex());
        assertEquals(3, session.getUnits().size());
        assertEquals("Primera frase.", session.getUnits().get(0).getText());
        assertEquals(3, session.getUnits().get(0).getBlockIndex());
        assertEquals(2, session.getUnits().get(1).getUnitIndex());
        assertEquals(4, session.getUnits().get(2).getBlockIndex());
    }

    @Test
    public void rejectsInvalidAndDuplicateSessionIds() throws Exception {
        ReadingTtsSessionStore store = new ReadingTtsSessionStore(tempRoot());
        assertThrows(IllegalArgumentException.class, () ->
                store.begin("../escape", "book", "Title", "", 1.0f, 0, 0));

        store.begin("session-2", "book", "Title", "", 1.0f, 0, 0);
        assertThrows(IllegalStateException.class, () ->
                store.begin("session-2", "book", "Title", "", 1.0f, 0, 0));
    }

    @Test
    public void supportsLargeQueuesThroughBoundedAppends() throws Exception {
        File root = tempRoot();
        ReadingTtsSessionStore store = new ReadingTtsSessionStore(root);
        store.begin("session-large", "book-large", "Large", "", 1.0f, 0, 0);

        for (int chunkStart = 0; chunkStart < 250; chunkStart += 100) {
            List<ReadingTtsUnit> chunk = new ArrayList<>();
            int chunkEnd = Math.min(250, chunkStart + 100);
            for (int index = chunkStart; index < chunkEnd; index++) {
                chunk.add(new ReadingTtsUnit(index / 5, index % 5, "Unidad " + index));
            }
            store.append("session-large", chunk);
        }
        store.commit("session-large");

        ReadingTtsSessionStore.Session session = new ReadingTtsSessionStore(root).load("session-large");
        assertNotNull(session);
        assertEquals(250, session.getUnits().size());
        assertEquals("Unidad 0", session.getUnits().get(0).getText());
        assertEquals("Unidad 249", session.getUnits().get(249).getText());
    }

    @Test
    public void deleteRemovesCommittedAndStagingState() throws Exception {
        File root = tempRoot();
        ReadingTtsSessionStore store = new ReadingTtsSessionStore(root);
        store.begin("session-delete", "book", "Title", "", 1.0f, 0, 0);
        store.append("session-delete", Arrays.asList(new ReadingTtsUnit(0, 0, "Text")));
        store.commit("session-delete");
        assertNotNull(store.load("session-delete"));

        store.delete("session-delete");
        assertNull(store.load("session-delete"));
        assertFalse(new File(root, "session-delete.json").exists());
        assertFalse(new File(root, "session-delete.tmp").exists());
    }
}