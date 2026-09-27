package com.tifloacosta.app.reading;

import java.io.File;
import java.io.IOException;

public interface ReadingAudioProbe {
    Result inspect(File file) throws IOException;

    final class Result {
        private final boolean readable;
        private final long durationMs;
        private final String title;
        private final String artist;
        private final String album;

        public Result(
                boolean readable,
                long durationMs,
                String title,
                String artist,
                String album
        ) {
            this.readable = readable;
            this.durationMs = Math.max(0L, durationMs);
            this.title = clean(title);
            this.artist = clean(artist);
            this.album = clean(album);
        }

        public static Result readable(long durationMs, String title, String artist, String album) {
            return new Result(true, durationMs, title, artist, album);
        }

        public static Result invalid() {
            return new Result(false, 0L, null, null, null);
        }

        public boolean isReadable() { return readable; }
        public long getDurationMs() { return durationMs; }
        public String getTitle() { return title; }
        public String getArtist() { return artist; }
        public String getAlbum() { return album; }

        private static String clean(String value) {
            if (value == null) return null;
            String trimmed = value.trim();
            return trimmed.isEmpty() ? null : trimmed;
        }
    }
}
