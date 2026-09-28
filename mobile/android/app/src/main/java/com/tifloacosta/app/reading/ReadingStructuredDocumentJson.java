package com.tifloacosta.app.reading;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public final class ReadingStructuredDocumentJson {
    private ReadingStructuredDocumentJson() {}

    public static String serialize(ReadingStructuredDocument document) {
        try {
            JSONObject root = new JSONObject();
            root.put("title", document == null ? "" : document.getTitle());
            root.put("author", document == null ? "" : document.getAuthor());
            root.put("language", document == null ? "" : document.getLanguage());

            JSONArray blocks = new JSONArray();
            if (document != null) {
                for (ReadingStructuredDocument.Block block : document.getBlocks()) {
                    JSONObject item = new JSONObject();
                    item.put("id", block.getId());
                    item.put("type", block.getType());
                    item.put("text", block.getText());
                    item.put("level", block.getLevel());
                    item.put("href", block.getHref());
                    blocks.put(item);
                }
            }
            root.put("blocks", blocks);

            JSONArray navigation = new JSONArray();
            if (document != null) {
                for (ReadingStructuredDocument.NavigationItem nav : document.getNavigation()) {
                    JSONObject item = new JSONObject();
                    item.put("label", nav.getLabel());
                    item.put("href", nav.getHref());
                    item.put("level", nav.getLevel());
                    navigation.put(item);
                }
            }
            root.put("navigation", navigation);

            JSONArray pages = new JSONArray();
            if (document != null) {
                for (ReadingStructuredDocument.PageReference page : document.getPageReferences()) {
                    JSONObject item = new JSONObject();
                    item.put("label", page.getLabel());
                    item.put("href", page.getHref());
                    pages.put(item);
                }
            }
            root.put("pageReferences", pages);

            JSONArray mediaSync = new JSONArray();
            if (document != null) {
                for (ReadingStructuredDocument.MediaSyncReference sync : document.getMediaSyncReferences()) {
                    JSONObject item = new JSONObject();
                    item.put("textHref", sync.getTextHref());
                    item.put("audioHref", sync.getAudioHref());
                    item.put("clipBeginMs", sync.getClipBeginMs());
                    item.put("clipEndMs", sync.getClipEndMs());
                    mediaSync.put(item);
                }
            }
            root.put("mediaSyncReferences", mediaSync);
            return root.toString();
        } catch (JSONException error) {
            throw new IllegalStateException("Unable to serialize structured reading document", error);
        }
    }
}
