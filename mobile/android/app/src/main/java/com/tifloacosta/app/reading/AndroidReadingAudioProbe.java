package com.tifloacosta.app.reading;

import android.media.MediaMetadataRetriever;

import java.io.File;
import java.io.IOException;

public final class AndroidReadingAudioProbe implements ReadingAudioProbe {
    @Override
    public Result inspect(File file) throws IOException {
        if (file == null || !file.isFile()) {
            throw new IOException("Reading audio temp file is unavailable");
        }

        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            retriever.setDataSource(file.getAbsolutePath());
            long durationMs = parseDuration(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION));
            if (durationMs <= 0L) {
                return Result.invalid();
            }
            return Result.readable(
                    durationMs,
                    retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE),
                    retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST),
                    retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM),
                    parseTrackNumber(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_CD_TRACK_NUMBER))
            );
        } catch (RuntimeException error) {
            return Result.invalid();
        } finally {
            try {
                retriever.release();
            } catch (RuntimeException ignored) {
            }
        }
    }

    private static long parseDuration(String value) {
        if (value == null) return 0L;
        try {
            return Math.max(0L, Long.parseLong(value.trim()));
        } catch (NumberFormatException error) {
            return 0L;
        }
    }

    private static Integer parseTrackNumber(String value) {
        if (value == null) return null;
        String cleaned = value.trim();
        if (cleaned.isEmpty()) return null;
        int slash = cleaned.indexOf('/');
        if (slash >= 0) cleaned = cleaned.substring(0, slash).trim();
        try {
            int number = Integer.parseInt(cleaned);
            return number > 0 ? number : null;
        } catch (NumberFormatException error) {
            return null;
        }
    }
}
