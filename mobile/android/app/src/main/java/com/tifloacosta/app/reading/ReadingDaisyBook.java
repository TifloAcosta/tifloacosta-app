package com.tifloacosta.app.reading;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class ReadingDaisyBook {
    private final String format;
    private final ReadingStructuredDocument document;
    private final List<AudioTrack> audioTracks;

    public ReadingDaisyBook(
            String format,
            ReadingStructuredDocument document,
            List<AudioTrack> audioTracks
    ) {
        this.format = clean(format);
        this.document = document;
        this.audioTracks = immutableCopy(audioTracks);
    }

    public String getFormat() { return format; }
    public ReadingStructuredDocument getDocument() { return document; }
    public List<AudioTrack> getAudioTracks() { return audioTracks; }
    public boolean hasText() { return document != null && !document.getBlocks().isEmpty(); }
    public boolean hasAudio() { return !audioTracks.isEmpty(); }
    public boolean isSynchronized() {
        return document != null && !document.getMediaSyncReferences().isEmpty();
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private static <T> List<T> immutableCopy(List<T> source) {
        if (source == null || source.isEmpty()) return Collections.emptyList();
        return Collections.unmodifiableList(new ArrayList<>(source));
    }

    public static final class AudioTrack {
        private final String href;
        private final String title;

        public AudioTrack(String href, String title) {
            this.href = clean(href);
            this.title = clean(title);
        }

        public String getHref() { return href; }
        public String getTitle() { return title; }
    }
}
