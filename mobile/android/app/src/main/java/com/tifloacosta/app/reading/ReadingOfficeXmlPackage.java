package com.tifloacosta.app.reading;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

final class ReadingOfficeXmlPackage {
    private static final int MAX_ENTRIES = 8000;
    private static final long MAX_EXPANDED_BYTES = 256L * 1024L * 1024L;
    private static final int MAX_XML_PART_BYTES = 8 * 1024 * 1024;
    private static final int MAX_XML_TOTAL_BYTES = 48 * 1024 * 1024;

    private final Map<String, byte[]> parts;
    private final List<String> entries;
    private final boolean macroEnabled;

    private ReadingOfficeXmlPackage(Map<String, byte[]> parts, List<String> entries, boolean macroEnabled) {
        this.parts = Collections.unmodifiableMap(parts);
        this.entries = Collections.unmodifiableList(entries);
        this.macroEnabled = macroEnabled;
    }

    static ReadingOfficeXmlPackage read(InputStream input) throws IOException {
        if (input == null) throw new IllegalArgumentException("input is required");
        Map<String, byte[]> parts = new LinkedHashMap<>();
        List<String> entries = new ArrayList<>();
        int count = 0;
        long expanded = 0L;
        int xmlTotal = 0;
        boolean macro = false;

        try (ZipInputStream zip = new ZipInputStream(input)) {
            ZipEntry entry;
            byte[] buffer = new byte[8192];
            while ((entry = zip.getNextEntry()) != null) {
                count++;
                if (count > MAX_ENTRIES) throw new OfficePackageException("too-many-entries");
                String name = normalize(entry.getName());
                if (name.isEmpty() || entry.isDirectory()) {
                    zip.closeEntry();
                    continue;
                }
                entries.add(name);
                String lower = name.toLowerCase(Locale.ROOT);
                if (lower.endsWith("vbaproject.bin") || lower.endsWith("vbadata.xml")) macro = true;

                boolean keep = isXmlPart(name);
                ByteArrayOutputStream output = keep ? new ByteArrayOutputStream() : null;
                int partBytes = 0;
                int read;
                while ((read = zip.read(buffer)) != -1) {
                    if (read == 0) continue;
                    expanded += read;
                    if (expanded > MAX_EXPANDED_BYTES) throw new OfficePackageException("too-large");
                    if (keep) {
                        partBytes += read;
                        if (partBytes > MAX_XML_PART_BYTES) throw new OfficePackageException("xml-part-too-large");
                        output.write(buffer, 0, read);
                    }
                }
                if (keep) {
                    xmlTotal += partBytes;
                    if (xmlTotal > MAX_XML_TOTAL_BYTES) throw new OfficePackageException("xml-total-too-large");
                    parts.put(name, output.toByteArray());
                }
                zip.closeEntry();
            }
        } catch (OfficePackageException error) {
            throw error;
        } catch (IOException error) {
            throw new OfficePackageException("invalid-office-package", error);
        }

        return new ReadingOfficeXmlPackage(parts, entries, macro);
    }

    boolean has(String path) {
        return parts.containsKey(normalizeUnchecked(path));
    }

    InputStream open(String path) throws IOException {
        byte[] bytes = parts.get(normalizeUnchecked(path));
        if (bytes == null) throw new OfficePackageException("missing-part");
        return new ByteArrayInputStream(bytes);
    }

    org.w3c.dom.Document xml(String path) throws IOException {
        try (InputStream input = open(path)) {
            return ReadingXml.parse(input);
        }
    }

    List<String> entries() {
        return entries;
    }

    boolean isMacroEnabled() {
        return macroEnabled;
    }

    private static boolean isXmlPart(String name) {
        String lower = name.toLowerCase(Locale.ROOT);
        if (!(lower.endsWith(".xml") || lower.endsWith(".rels"))) return false;
        return lower.startsWith("ppt/")
                || lower.startsWith("xl/")
                || lower.startsWith("docprops/")
                || lower.equals("[content_types].xml")
                || lower.startsWith("_rels/");
    }

    private static String normalize(String raw) throws IOException {
        if (raw == null) return "";
        String value = raw.replace('\\', '/').trim();
        if (value.startsWith("/") || value.matches("^[A-Za-z]:.*")) {
            throw new OfficePackageException("unsafe-path");
        }
        List<String> parts = new ArrayList<>();
        for (String item : value.split("/")) {
            if (item.isEmpty() || ".".equals(item)) continue;
            if ("..".equals(item)) throw new OfficePackageException("unsafe-path");
            parts.add(item);
        }
        return String.join("/", parts);
    }

    static String resolve(String sourcePart, String target) throws IOException {
        String cleanTarget = target == null ? "" : target.replace('\\', '/').trim();
        if (cleanTarget.isEmpty()) return "";
        if (cleanTarget.startsWith("/")) return normalize(cleanTarget.substring(1));
        String source = normalize(sourcePart);
        int slash = source.lastIndexOf('/');
        String base = slash < 0 ? "" : source.substring(0, slash + 1);
        List<String> parts = new ArrayList<>();
        for (String item : (base + cleanTarget).split("/")) {
            if (item.isEmpty() || ".".equals(item)) continue;
            if ("..".equals(item)) {
                if (parts.isEmpty()) throw new OfficePackageException("unsafe-path");
                parts.remove(parts.size() - 1);
            } else {
                parts.add(item);
            }
        }
        return String.join("/", parts);
    }

    static String relationshipsPath(String sourcePart) throws IOException {
        String source = normalize(sourcePart);
        int slash = source.lastIndexOf('/');
        String dir = slash < 0 ? "" : source.substring(0, slash + 1);
        String name = slash < 0 ? source : source.substring(slash + 1);
        return dir + "_rels/" + name + ".rels";
    }

    private static String normalizeUnchecked(String path) {
        try {
            return normalize(path);
        } catch (IOException error) {
            return "";
        }
    }

    static final class OfficePackageException extends IOException {
        private final String code;

        OfficePackageException(String code) {
            super(code);
            this.code = code;
        }

        OfficePackageException(String code, Throwable cause) {
            super(code, cause);
            this.code = code;
        }

        String getCode() {
            return code;
        }
    }
}
