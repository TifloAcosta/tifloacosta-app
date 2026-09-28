package com.tifloacosta.app.reading;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class ReadingStructuredDocument {
    private final String title;
    private final String author;
    private final String language;
    private final List<Block> blocks;
    private final List<NavigationItem> navigation;
    private final List<PageReference> pageReferences;
    private final List<MediaSyncReference> mediaSyncReferences;

    public ReadingStructuredDocument(
            String title,
            String author,
            String language,
            List<Block> blocks,
            List<NavigationItem> navigation,
            List<PageReference> pageReferences,
            List<MediaSyncReference> mediaSyncReferences
    ) {
        this.title = clean(title);
        this.author = clean(author);
        this.language = clean(language);
        this.blocks = immutableCopy(blocks);
        this.navigation = immutableCopy(navigation);
        this.pageReferences = immutableCopy(pageReferences);
        this.mediaSyncReferences = immutableCopy(mediaSyncReferences);
    }

    public String getTitle() {
        return title;
    }

    public String getAuthor() {
        return author;
    }

    public String getLanguage() {
        return language;
    }

    public List<Block> getBlocks() {
        return blocks;
    }

    public List<NavigationItem> getNavigation() {
        return navigation;
    }

    public List<PageReference> getPageReferences() {
        return pageReferences;
    }

    public List<MediaSyncReference> getMediaSyncReferences() {
        return mediaSyncReferences;
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private static <T> List<T> immutableCopy(List<T> source) {
        if (source == null || source.isEmpty()) return Collections.emptyList();
        return Collections.unmodifiableList(new ArrayList<>(source));
    }

    public static final class Block {
        private final String id;
        private final String type;
        private final String text;
        private final int level;
        private final String href;

        public Block(String id, String type, String text, int level, String href) {
            this.id = clean(id);
            this.type = clean(type);
            this.text = clean(text);
            this.level = level;
            this.href = clean(href);
        }

        public String getId() { return id; }
        public String getType() { return type; }
        public String getText() { return text; }
        public int getLevel() { return level; }
        public String getHref() { return href; }
    }

    public static final class NavigationItem {
        private final String label;
        private final String href;
        private final int level;

        public NavigationItem(String label, String href, int level) {
            this.label = clean(label);
            this.href = clean(href);
            this.level = level;
        }

        public String getLabel() { return label; }
        public String getHref() { return href; }
        public int getLevel() { return level; }
    }

    public static final class PageReference {
        private final String label;
        private final String href;

        public PageReference(String label, String href) {
            this.label = clean(label);
            this.href = clean(href);
        }

        public String getLabel() { return label; }
        public String getHref() { return href; }
    }

    public static final class MediaSyncReference {
        private final String textHref;
        private final String audioHref;
        private final long clipBeginMs;
        private final long clipEndMs;

        public MediaSyncReference(String textHref, String audioHref, long clipBeginMs, long clipEndMs) {
            this.textHref = clean(textHref);
            this.audioHref = clean(audioHref);
            this.clipBeginMs = clipBeginMs;
            this.clipEndMs = clipEndMs;
        }

        public String getTextHref() { return textHref; }
        public String getAudioHref() { return audioHref; }
        public long getClipBeginMs() { return clipBeginMs; }
        public long getClipEndMs() { return clipEndMs; }
    }
}
