package com.tifloacosta.app.reading;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Pure playback state for a prepared TifloLector TTS queue.
 *
 * This class deliberately has no Android dependencies so its transition rules
 * can be verified with ordinary JVM tests. The foreground service owns the TTS
 * engine; this object only decides which semantic unit is current and rejects
 * stale utterance-completion callbacks.
 */
public final class ReadingTtsPlaybackState {
    private final List<ReadingTtsUnit> units;
    private int currentIndex;
    private boolean prepared;
    private boolean playing;
    private boolean ended;
    private long utteranceGeneration;
    private String activeUtteranceToken;

    public ReadingTtsPlaybackState(
            List<ReadingTtsUnit> units,
            int blockIndex,
            int unitIndex
    ) {
        if (units == null || units.isEmpty()) {
            this.units = Collections.emptyList();
            this.currentIndex = -1;
            this.prepared = false;
            this.playing = false;
            this.ended = false;
            return;
        }

        this.units = Collections.unmodifiableList(new ArrayList<>(units));
        this.currentIndex = findPosition(blockIndex, unitIndex);
        if (this.currentIndex < 0) {
            this.currentIndex = 0;
        }
        this.prepared = true;
        this.playing = false;
        this.ended = false;
    }

    public boolean isPrepared() {
        return prepared;
    }

    public boolean isPlaying() {
        return playing;
    }

    public boolean isEnded() {
        return ended;
    }

    public ReadingTtsUnit current() {
        if (!prepared || currentIndex < 0 || currentIndex >= units.size()) {
            return null;
        }
        return units.get(currentIndex);
    }

    public String play() {
        if (!prepared || ended || current() == null) {
            playing = false;
            activeUtteranceToken = null;
            return null;
        }
        playing = true;
        return issueUtteranceToken();
    }

    public void pause() {
        playing = false;
        invalidateUtterance();
    }

    public boolean seek(int blockIndex, int unitIndex) {
        int target = findPosition(blockIndex, unitIndex);
        if (target < 0) {
            return false;
        }

        boolean wasPlaying = playing;
        currentIndex = target;
        ended = false;
        invalidateUtterance();
        if (wasPlaying) {
            playing = true;
            issueUtteranceToken();
        }
        return true;
    }

    public boolean complete(String utteranceToken) {
        if (!playing || activeUtteranceToken == null || utteranceToken == null) {
            return false;
        }
        if (!activeUtteranceToken.equals(utteranceToken)) {
            return false;
        }

        if (currentIndex >= units.size() - 1) {
            playing = false;
            ended = true;
            invalidateUtterance();
            return true;
        }

        currentIndex += 1;
        issueUtteranceToken();
        return true;
    }

    public String activeUtteranceToken() {
        return activeUtteranceToken;
    }

    private int findPosition(int blockIndex, int unitIndex) {
        for (int index = 0; index < units.size(); index += 1) {
            ReadingTtsUnit unit = units.get(index);
            if (unit.getBlockIndex() == blockIndex && unit.getUnitIndex() == unitIndex) {
                return index;
            }
        }
        return -1;
    }

    private String issueUtteranceToken() {
        utteranceGeneration += 1;
        activeUtteranceToken = "tts-" + utteranceGeneration;
        return activeUtteranceToken;
    }

    private void invalidateUtterance() {
        utteranceGeneration += 1;
        activeUtteranceToken = null;
    }
}
