package com.tifloacosta.app.reading;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class ReadingRestorePlan {
    public enum PositionChoice {
        KEEP_CURRENT,
        USE_BACKUP
    }

    public static final class PositionConflict {
        private final String sha256;
        private final String currentBookId;
        private final int currentBlockIndex;
        private final int backupBlockIndex;
        private final double currentPercent;
        private final double backupPercent;

        PositionConflict(
                String sha256,
                String currentBookId,
                int currentBlockIndex,
                int backupBlockIndex,
                double currentPercent,
                double backupPercent
        ) {
            this.sha256 = sha256;
            this.currentBookId = currentBookId;
            this.currentBlockIndex = currentBlockIndex;
            this.backupBlockIndex = backupBlockIndex;
            this.currentPercent = currentPercent;
            this.backupPercent = backupPercent;
        }

        public String getSha256() { return sha256; }
        public String getCurrentBookId() { return currentBookId; }
        public int getCurrentBlockIndex() { return currentBlockIndex; }
        public int getBackupBlockIndex() { return backupBlockIndex; }
        public double getCurrentPercent() { return currentPercent; }
        public double getBackupPercent() { return backupPercent; }
    }

    private final String packageFingerprint;
    private final List<String> additions;
    private final List<String> duplicates;
    private final List<PositionConflict> positionConflicts;
    private final Map<String, PositionChoice> positionChoices = new LinkedHashMap<>();

    ReadingRestorePlan(
            String packageFingerprint,
            List<String> additions,
            List<String> duplicates,
            List<PositionConflict> positionConflicts
    ) {
        this.packageFingerprint = packageFingerprint;
        this.additions = Collections.unmodifiableList(new ArrayList<>(additions));
        this.duplicates = Collections.unmodifiableList(new ArrayList<>(duplicates));
        this.positionConflicts = Collections.unmodifiableList(new ArrayList<>(positionConflicts));
        for (PositionConflict conflict : positionConflicts) {
            positionChoices.put(conflict.getSha256(), PositionChoice.KEEP_CURRENT);
        }
    }

    public List<String> getAdditions() { return additions; }
    public List<String> getDuplicates() { return duplicates; }
    public List<PositionConflict> getPositionConflicts() { return positionConflicts; }

    public void resolvePosition(String sha256, PositionChoice choice) {
        if (!positionChoices.containsKey(sha256)) {
            throw new IllegalArgumentException("No position conflict exists for " + sha256);
        }
        if (choice == null) throw new IllegalArgumentException("Position choice is required");
        positionChoices.put(sha256, choice);
    }

    PositionChoice positionChoice(String sha256) {
        PositionChoice choice = positionChoices.get(sha256);
        return choice == null ? PositionChoice.KEEP_CURRENT : choice;
    }

    String getPackageFingerprint() { return packageFingerprint; }
}
