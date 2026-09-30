package com.tifloacosta.app.reading;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.Arrays;
import java.util.List;

public class ReadingBackgroundTtsServiceStateTest {
    private List<ReadingTtsUnit> units() {
        return Arrays.asList(
                new ReadingTtsUnit(2, 0, "Primera."),
                new ReadingTtsUnit(2, 1, "Segunda."),
                new ReadingTtsUnit(3, 0, "Tercera.")
        );
    }

    @Test
    public void preparedQueueStartsPausedAtRequestedSemanticPosition() {
        ReadingTtsPlaybackState state = new ReadingTtsPlaybackState(units(), 2, 1);

        assertTrue(state.isPrepared());
        assertFalse(state.isPlaying());
        assertFalse(state.isEnded());
        assertEquals(2, state.current().getBlockIndex());
        assertEquals(1, state.current().getUnitIndex());
    }

    @Test
    public void playAndMatchingCompletionAdvanceWithoutJavascript() {
        ReadingTtsPlaybackState state = new ReadingTtsPlaybackState(units(), 2, 0);

        String firstToken = state.play();
        assertTrue(state.isPlaying());
        assertEquals("Primera.", state.current().getText());

        assertTrue(state.complete(firstToken));
        assertTrue(state.isPlaying());
        assertEquals("Segunda.", state.current().getText());

        String secondToken = state.activeUtteranceToken();
        assertTrue(state.complete(secondToken));
        assertEquals("Tercera.", state.current().getText());
    }

    @Test
    public void staleUtteranceCompletionCannotSkipAUnit() {
        ReadingTtsPlaybackState state = new ReadingTtsPlaybackState(units(), 2, 0);
        String firstToken = state.play();
        assertTrue(state.complete(firstToken));
        assertEquals("Segunda.", state.current().getText());

        assertFalse(state.complete(firstToken));
        assertEquals("Segunda.", state.current().getText());
    }

    @Test
    public void pauseKeepsCurrentSemanticPositionAndInvalidatesUtterance() {
        ReadingTtsPlaybackState state = new ReadingTtsPlaybackState(units(), 2, 0);
        String token = state.play();

        state.pause();

        assertFalse(state.isPlaying());
        assertEquals(2, state.current().getBlockIndex());
        assertEquals(0, state.current().getUnitIndex());
        assertNull(state.activeUtteranceToken());
        assertFalse(state.complete(token));
    }

    @Test
    public void finalCompletionEndsWithoutWrappingOrAutoplay() {
        ReadingTtsPlaybackState state = new ReadingTtsPlaybackState(units(), 3, 0);
        String token = state.play();

        assertTrue(state.complete(token));

        assertFalse(state.isPlaying());
        assertTrue(state.isEnded());
        assertEquals(3, state.current().getBlockIndex());
        assertEquals(0, state.current().getUnitIndex());
        assertNull(state.activeUtteranceToken());
    }

    @Test
    public void seekWhilePausedChangesPositionWithoutStartingPlayback() {
        ReadingTtsPlaybackState state = new ReadingTtsPlaybackState(units(), 2, 0);

        assertTrue(state.seek(3, 0));

        assertFalse(state.isPlaying());
        assertEquals("Tercera.", state.current().getText());
    }

    @Test
    public void reconstructedStateNeverAutoplays() {
        ReadingTtsPlaybackState first = new ReadingTtsPlaybackState(units(), 2, 0);
        String token = first.play();
        assertTrue(first.complete(token));

        ReadingTtsUnit saved = first.current();
        ReadingTtsPlaybackState restored = new ReadingTtsPlaybackState(
                units(), saved.getBlockIndex(), saved.getUnitIndex()
        );

        assertTrue(restored.isPrepared());
        assertFalse(restored.isPlaying());
        assertFalse(restored.isEnded());
        assertEquals("Segunda.", restored.current().getText());
    }
}
