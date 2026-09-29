package com.tifloacosta.app.reading;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.regex.Pattern;

public final class ReadingTtsSessionStore {
    private static final Pattern SAFE_ID = Pattern.compile("[A-Za-z0-9_-][A-Za-z0-9._-]{0,127}");
    private static final String STAGING_SUFFIX = ".tmp";
    private static final String COMMITTED_SUFFIX = ".json";

    private final File rootDirectory;

    public ReadingTtsSessionStore(File rootDirectory) {
        if (rootDirectory == null) throw new IllegalArgumentException("rootDirectory is required");
        this.rootDirectory = rootDirectory;
        ensureRoot();
    }

    public synchronized void begin(
            String sessionId,
            String bookId,
            String title,
            String voiceId,
            float rate,
            int startBlockIndex,
            int startUnitIndex
    ) throws IOException {
        String safeSessionId = requireSessionId(sessionId);
        if (bookId == null || bookId.trim().isEmpty()) throw new IllegalArgumentException("bookId is required");
        if (startBlockIndex < 0 || startUnitIndex < 0) {
            throw new IllegalArgumentException("start position must be non-negative");
        }
        if (!Float.isFinite(rate) || rate <= 0f) throw new IllegalArgumentException("rate must be positive");

        File staging = stagingFile(safeSessionId);
        File committed = committedFile(safeSessionId);
        if (staging.exists() || committed.exists()) {
            throw new IllegalStateException("TTS session already exists");
        }

        JSONObject json = new JSONObject();
        try {
            json.put("sessionId", safeSessionId);
            json.put("bookId", bookId.trim());
            json.put("title", title == null ? "" : title);
            json.put("voiceId", voiceId == null ? "" : voiceId);
            json.put("rate", rate);
            json.put("startBlockIndex", startBlockIndex);
            json.put("startUnitIndex", startUnitIndex);
            json.put("units", new JSONArray());
        } catch (JSONException error) {
            throw new IOException("Unable to create TTS session", error);
        }
        writeJson(staging, json);
    }

    public synchronized void append(String sessionId, List<ReadingTtsUnit> units) throws IOException {
        String safeSessionId = requireSessionId(sessionId);
        if (units == null || units.isEmpty()) return;
        File staging = stagingFile(safeSessionId);
        if (!staging.isFile()) throw new IllegalStateException("TTS session is not being prepared");

        JSONObject json = readJson(staging);
        try {
            JSONArray target = json.getJSONArray("units");
            for (ReadingTtsUnit unit : units) {
                if (unit == null) throw new IllegalArgumentException("TTS unit is required");
                JSONObject item = new JSONObject();
                item.put("blockIndex", unit.getBlockIndex());
                item.put("unitIndex", unit.getUnitIndex());
                item.put("text", unit.getText());
                target.put(item);
            }
        } catch (JSONException error) {
            throw new IOException("Unable to append TTS units", error);
        }
        writeJson(staging, json);
    }

    public synchronized void commit(String sessionId) throws IOException {
        String safeSessionId = requireSessionId(sessionId);
        File staging = stagingFile(safeSessionId);
        File committed = committedFile(safeSessionId);
        if (!staging.isFile()) throw new IllegalStateException("TTS session is not being prepared");
        if (committed.exists()) throw new IllegalStateException("TTS session is already committed");

        try {
            Files.move(
                    staging.toPath(),
                    committed.toPath(),
                    StandardCopyOption.ATOMIC_MOVE
            );
        } catch (AtomicMoveNotSupportedException error) {
            Files.move(
                    staging.toPath(),
                    committed.toPath(),
                    StandardCopyOption.REPLACE_EXISTING
            );
        }
    }

    public synchronized Session load(String sessionId) throws IOException {
        String safeSessionId = requireSessionId(sessionId);
        File committed = committedFile(safeSessionId);
        if (!committed.isFile()) return null;
        return parseSession(readJson(committed));
    }

    public synchronized void delete(String sessionId) throws IOException {
        String safeSessionId = requireSessionId(sessionId);
        Files.deleteIfExists(stagingFile(safeSessionId).toPath());
        Files.deleteIfExists(committedFile(safeSessionId).toPath());
    }

    private Session parseSession(JSONObject json) throws IOException {
        try {
            JSONArray jsonUnits = json.getJSONArray("units");
            List<ReadingTtsUnit> units = new ArrayList<>(jsonUnits.length());
            for (int index = 0; index < jsonUnits.length(); index++) {
                JSONObject item = jsonUnits.getJSONObject(index);
                units.add(new ReadingTtsUnit(
                        item.getInt("blockIndex"),
                        item.getInt("unitIndex"),
                        item.getString("text")
                ));
            }
            return new Session(
                    json.getString("sessionId"),
                    json.getString("bookId"),
                    json.optString("title", ""),
                    json.optString("voiceId", ""),
                    (float) json.optDouble("rate", 1.0),
                    json.optInt("startBlockIndex", 0),
                    json.optInt("startUnitIndex", 0),
                    units
            );
        } catch (JSONException | IllegalArgumentException error) {
            throw new IOException("Invalid TTS session data", error);
        }
    }

    private JSONObject readJson(File file) throws IOException {
        String raw = Files.readString(file.toPath(), StandardCharsets.UTF_8);
        try {
            return new JSONObject(raw);
        } catch (JSONException error) {
            throw new IOException("Invalid TTS session JSON", error);
        }
    }

    private void writeJson(File file, JSONObject json) throws IOException {
        ensureRoot();
        Files.writeString(file.toPath(), json.toString(), StandardCharsets.UTF_8);
    }

    private File stagingFile(String sessionId) {
        return new File(rootDirectory, sessionId + STAGING_SUFFIX);
    }

    private File committedFile(String sessionId) {
        return new File(rootDirectory, sessionId + COMMITTED_SUFFIX);
    }

    private void ensureRoot() {
        if (rootDirectory.isDirectory()) return;
        if (!rootDirectory.mkdirs() && !rootDirectory.isDirectory()) {
            throw new IllegalStateException("Unable to create TTS session directory");
        }
    }

    private static String requireSessionId(String value) {
        String clean = value == null ? "" : value.trim();
        if (clean.equals(".") || clean.equals("..") || !SAFE_ID.matcher(clean).matches()) {
            throw new IllegalArgumentException("Invalid TTS session id");
        }
        return clean;
    }

    public static final class Session {
        private final String sessionId;
        private final String bookId;
        private final String title;
        private final String voiceId;
        private final float rate;
        private final int startBlockIndex;
        private final int startUnitIndex;
        private final List<ReadingTtsUnit> units;

        private Session(
                String sessionId,
                String bookId,
                String title,
                String voiceId,
                float rate,
                int startBlockIndex,
                int startUnitIndex,
                List<ReadingTtsUnit> units
        ) {
            this.sessionId = sessionId;
            this.bookId = bookId;
            this.title = title;
            this.voiceId = voiceId;
            this.rate = rate;
            this.startBlockIndex = startBlockIndex;
            this.startUnitIndex = startUnitIndex;
            this.units = Collections.unmodifiableList(new ArrayList<>(units));
        }

        public String getSessionId() { return sessionId; }
        public String getBookId() { return bookId; }
        public String getTitle() { return title; }
        public String getVoiceId() { return voiceId; }
        public float getRate() { return rate; }
        public int getStartBlockIndex() { return startBlockIndex; }
        public int getStartUnitIndex() { return startUnitIndex; }
        public List<ReadingTtsUnit> getUnits() { return units; }
    }
}
