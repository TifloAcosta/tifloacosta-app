package com.tifloacosta.app.reading;

import java.io.IOException;
import java.io.Reader;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class ReadingContentValidator {
    private static final Set<String> IGNORED_HTML_CONTAINERS = Set.of(
            "head",
            "script",
            "style",
            "template",
            "object",
            "iframe",
            "button",
            "select",
            "textarea",
            "option",
            "datalist"
    );
    private static final Set<String> VOID_IGNORED_HTML_TAGS = Set.of("input", "embed");
    private static final Pattern ALT_ATTRIBUTE = Pattern.compile(
            "(?is)\\balt\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s/>]+))"
    );

    private ReadingContentValidator() {
    }

    public static boolean hasReadableText(Reader reader, String format) throws IOException {
        if ("html".equals(format)) {
            return htmlHasReadableText(reader);
        }
        return plainTextHasReadableText(reader);
    }

    private static boolean plainTextHasReadableText(Reader reader) throws IOException {
        boolean first = true;
        int value;
        while ((value = reader.read()) != -1) {
            char character = (char) value;
            if (first) {
                first = false;
                if (character == '\uFEFF') continue;
            }
            if (!Character.isWhitespace(character)) return true;
        }
        return false;
    }

    private static boolean htmlHasReadableText(Reader reader) throws IOException {
        boolean inTag = false;
        boolean inEntity = false;
        String ignoredContainer = null;
        StringBuilder tag = new StringBuilder();
        StringBuilder entity = new StringBuilder();
        int value;

        while ((value = reader.read()) != -1) {
            char character = (char) value;

            if (inTag) {
                if (character == '>') {
                    inTag = false;
                    String rawTag = tag.toString();
                    String tagName = tagName(rawTag);
                    boolean closing = isClosingTag(rawTag);
                    boolean selfClosing = rawTag.trim().endsWith("/");

                    if (ignoredContainer != null) {
                        if (closing && ignoredContainer.equals(tagName)) {
                            ignoredContainer = null;
                        }
                    } else if (!tagName.isEmpty()) {
                        if (!closing && "img".equals(tagName) && imageHasReadableAlt(rawTag)) {
                            return true;
                        }
                        if (!closing && IGNORED_HTML_CONTAINERS.contains(tagName) && !selfClosing) {
                            ignoredContainer = tagName;
                        } else if (!closing && VOID_IGNORED_HTML_TAGS.contains(tagName)) {
                            // Intentionally ignored. These tags do not contain readable body text.
                        }
                    }
                    tag.setLength(0);
                    continue;
                }
                if (tag.length() < 4096) tag.append(character);
                continue;
            }

            if (character == '<') {
                inEntity = false;
                entity.setLength(0);
                inTag = true;
                tag.setLength(0);
                continue;
            }

            if (ignoredContainer != null) continue;

            if (inEntity) {
                if (character == ';') {
                    inEntity = false;
                    if (!isWhitespaceEntity(entity.toString())) return true;
                    entity.setLength(0);
                    continue;
                }
                if (Character.isWhitespace(character) || entity.length() >= 16) {
                    return true;
                }
                entity.append(character);
                continue;
            }

            if (character == '&') {
                inEntity = true;
                entity.setLength(0);
                continue;
            }

            if (character == '\uFEFF' || Character.isWhitespace(character)) continue;
            return true;
        }

        return inEntity && !isWhitespaceEntity(entity.toString());
    }

    private static String tagName(String rawTag) {
        String value = rawTag == null ? "" : rawTag.trim();
        if (value.startsWith("!--") || value.startsWith("!") || value.startsWith("?")) return "";
        if (value.startsWith("/")) value = value.substring(1).trim();
        int end = 0;
        while (end < value.length()) {
            char character = value.charAt(end);
            if (!Character.isLetterOrDigit(character) && character != '-' && character != ':') break;
            end++;
        }
        return end == 0 ? "" : value.substring(0, end).toLowerCase(Locale.ROOT);
    }

    private static boolean isClosingTag(String rawTag) {
        return rawTag != null && rawTag.trim().startsWith("/");
    }

    private static boolean imageHasReadableAlt(String rawTag) {
        Matcher matcher = ALT_ATTRIBUTE.matcher(rawTag == null ? "" : rawTag);
        if (!matcher.find()) return false;
        String alt = matcher.group(1);
        if (alt == null) alt = matcher.group(2);
        if (alt == null) alt = matcher.group(3);
        if (alt == null) return false;
        String normalized = alt
                .replaceAll("(?i)&nbsp;|&#160;|&#x0*a0;", " ")
                .trim();
        return !normalized.isEmpty();
    }

    private static boolean isWhitespaceEntity(String entity) {
        String normalized = entity == null ? "" : entity.trim().toLowerCase(Locale.ROOT);
        return "nbsp".equals(normalized)
                || "#160".equals(normalized)
                || "#xa0".equals(normalized)
                || "#x00a0".equals(normalized);
    }
}
