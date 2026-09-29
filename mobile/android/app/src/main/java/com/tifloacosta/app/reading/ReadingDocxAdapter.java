package com.tifloacosta.app.reading;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NamedNodeMap;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public final class ReadingDocxAdapter {
    private static final String REL_OFFICE_DOCUMENT = "/officeDocument";
    private static final String REL_CORE_PROPERTIES = "/metadata/core-properties";
    private static final String REL_STYLES = "/styles";
    private static final String REL_NUMBERING = "/numbering";
    private static final String REL_FOOTNOTES = "/footnotes";
    private static final String REL_ENDNOTES = "/endnotes";
    private static final String REL_HYPERLINK = "/hyperlink";

    public ReadingStructuredDocument read(InputStream input, File workRoot) throws IOException {
        if (input == null) throw new IllegalArgumentException("input is required");
        if (workRoot == null) throw new IllegalArgumentException("workRoot is required");

        ReadingPackageExtractor.Extraction extraction = null;
        try {
            extraction = new ReadingPackageExtractor().extract(
                    input,
                    workRoot,
                    asList("[Content_Types].xml", "_rels/.rels")
            );
            File root = extraction.getRoot();
            rejectMacroEnabled(root, extraction.getEntries());

            Map<String, Relationship> rootRelationships = parseRelationships(
                    parseXmlFile(safePart(root, "_rels/.rels"))
            );
            Relationship officeDocument = firstRelationship(rootRelationships, REL_OFFICE_DOCUMENT);
            if (officeDocument == null || officeDocument.external || clean(officeDocument.target).isEmpty()) {
                throw new DocxException("invalid-docx", "DOCX office document relationship is missing");
            }

            String documentPart = normalizePartPath(officeDocument.target);
            File documentFile = safePart(root, documentPart);
            if (!documentFile.isFile()) {
                throw new DocxException("invalid-docx", "DOCX main document is missing");
            }

            Map<String, Relationship> documentRelationships = readPartRelationships(root, documentPart);
            Map<String, String> styleNames = new HashMap<>();
            String language = "";

            File stylesFile = relatedPart(root, documentPart, documentRelationships, REL_STYLES, "word/styles.xml");
            if (stylesFile != null && stylesFile.isFile()) {
                Document styles = parseXmlFile(stylesFile);
                styleNames.putAll(readStyleNames(styles));
                language = readDefaultLanguage(styles);
            }

            File numberingFile = relatedPart(root, documentPart, documentRelationships, REL_NUMBERING, "word/numbering.xml");
            if (numberingFile != null && numberingFile.isFile()) parseXmlFile(numberingFile);

            Map<String, String> footnotes = readNotes(
                    relatedPart(root, documentPart, documentRelationships, REL_FOOTNOTES, "word/footnotes.xml"),
                    "footnote"
            );
            Map<String, String> endnotes = readNotes(
                    relatedPart(root, documentPart, documentRelationships, REL_ENDNOTES, "word/endnotes.xml"),
                    "endnote"
            );

            Metadata metadata = readMetadata(root, rootRelationships);
            if (metadata.language.isEmpty()) metadata.language = language;

            Document document = parseXmlFile(documentFile);
            List<ReadingStructuredDocument.Block> blocks = new ArrayList<>();
            List<ReadingStructuredDocument.NavigationItem> navigation = new ArrayList<>();
            Set<String> referencedFootnotes = new HashSet<>();
            Set<String> referencedEndnotes = new HashSet<>();
            int[] serial = new int[]{0};

            Element body = firstElement(document.getDocumentElement(), "body");
            if (body == null) throw new DocxException("invalid-docx", "DOCX body is missing");
            collectBodyBlocks(
                    body,
                    documentRelationships,
                    styleNames,
                    blocks,
                    navigation,
                    referencedFootnotes,
                    referencedEndnotes,
                    serial
            );

            appendReferencedNotes(blocks, footnotes, referencedFootnotes, "footnote", serial);
            appendReferencedNotes(blocks, endnotes, referencedEndnotes, "endnote", serial);

            if (blocks.isEmpty()) {
                throw new DocxException("invalid-docx", "DOCX contains no readable content");
            }

            return new ReadingStructuredDocument(
                    metadata.title,
                    metadata.author,
                    metadata.language,
                    blocks,
                    navigation,
                    Collections.emptyList(),
                    Collections.emptyList()
            );
        } catch (DocxException error) {
            throw error;
        } catch (ReadingPackageExtractor.PackageException error) {
            throw new DocxException("invalid-docx", error.getMessage(), error);
        } catch (IOException error) {
            throw new DocxException("invalid-docx", "Unable to read DOCX package", error);
        } catch (RuntimeException error) {
            throw new DocxException("invalid-docx", "Malformed DOCX package", error);
        } finally {
            if (extraction != null) deleteTree(extraction.getRoot());
        }
    }

    private static void rejectMacroEnabled(File root, List<String> entries) throws IOException {
        for (String entry : entries) {
            String lower = entry.toLowerCase(Locale.ROOT);
            if (lower.endsWith("vbaproject.bin") || lower.endsWith("vbadata.xml")) {
                throw new DocxException("macro-enabled-docx", "Macro-enabled Word documents are not supported");
            }
        }
        Document contentTypes = parseXmlFile(safePart(root, "[Content_Types].xml"));
        NodeList all = contentTypes.getElementsByTagNameNS("*", "Override");
        for (int index = 0; index < all.getLength(); index++) {
            Element element = (Element) all.item(index);
            String contentType = clean(element.getAttribute("ContentType")).toLowerCase(Locale.ROOT);
            if (contentType.contains("macroenabled") || contentType.contains("vba")) {
                throw new DocxException("macro-enabled-docx", "Macro-enabled Word documents are not supported");
            }
        }
    }

    private static Metadata readMetadata(File root, Map<String, Relationship> rootRelationships) throws IOException {
        File core = null;
        Relationship relationship = firstRelationship(rootRelationships, REL_CORE_PROPERTIES);
        if (relationship != null && !relationship.external) {
            core = safePart(root, normalizePartPath(relationship.target));
        }
        if (core == null || !core.isFile()) {
            File fallback = safePart(root, "docProps/core.xml");
            if (fallback.isFile()) core = fallback;
        }
        Metadata metadata = new Metadata();
        if (core == null || !core.isFile()) return metadata;
        Document document = parseXmlFile(core);
        metadata.title = firstText(document.getDocumentElement(), "title");
        metadata.author = firstText(document.getDocumentElement(), "creator");
        metadata.language = firstText(document.getDocumentElement(), "language");
        return metadata;
    }

    private static Map<String, Relationship> readPartRelationships(File root, String partPath) throws IOException {
        String relationshipsPath = relationshipsPath(partPath);
        File file = safePart(root, relationshipsPath);
        if (!file.isFile()) return Collections.emptyMap();
        return parseRelationships(parseXmlFile(file));
    }

    private static String relationshipsPath(String partPath) {
        String normalized = normalizePartPath(partPath);
        int slash = normalized.lastIndexOf('/');
        String directory = slash < 0 ? "" : normalized.substring(0, slash + 1);
        String name = slash < 0 ? normalized : normalized.substring(slash + 1);
        return directory + "_rels/" + name + ".rels";
    }

    private static Map<String, Relationship> parseRelationships(Document document) {
        Map<String, Relationship> relationships = new LinkedHashMap<>();
        NodeList nodes = document.getElementsByTagNameNS("*", "Relationship");
        for (int index = 0; index < nodes.getLength(); index++) {
            Element element = (Element) nodes.item(index);
            String id = clean(element.getAttribute("Id"));
            String type = clean(element.getAttribute("Type"));
            String target = clean(element.getAttribute("Target"));
            boolean external = "external".equalsIgnoreCase(clean(element.getAttribute("TargetMode")));
            if (!id.isEmpty()) relationships.put(id, new Relationship(type, target, external));
        }
        return relationships;
    }

    private static Relationship firstRelationship(Map<String, Relationship> relationships, String typeSuffix) {
        for (Relationship relationship : relationships.values()) {
            if (relationship.type.endsWith(typeSuffix)) return relationship;
        }
        return null;
    }

    private static File relatedPart(
            File root,
            String sourcePart,
            Map<String, Relationship> relationships,
            String typeSuffix,
            String fallback
    ) throws IOException {
        Relationship relationship = firstRelationship(relationships, typeSuffix);
        if (relationship != null && !relationship.external) {
            File resolved = resolveRelationshipTarget(root, sourcePart, relationship.target);
            if (resolved.isFile()) return resolved;
        }
        File fallbackFile = safePart(root, fallback);
        return fallbackFile.isFile() ? fallbackFile : null;
    }

    private static Map<String, String> readStyleNames(Document styles) {
        Map<String, String> result = new HashMap<>();
        NodeList nodes = styles.getElementsByTagNameNS("*", "style");
        for (int index = 0; index < nodes.getLength(); index++) {
            Element style = (Element) nodes.item(index);
            String id = attributeByLocalName(style, "styleId");
            Element name = firstElement(style, "name");
            String value = name == null ? "" : attributeByLocalName(name, "val");
            if (!id.isEmpty()) result.put(id, value);
        }
        return result;
    }

    private static String readDefaultLanguage(Document styles) {
        NodeList languages = styles.getElementsByTagNameNS("*", "lang");
        for (int index = 0; index < languages.getLength(); index++) {
            String value = attributeByLocalName((Element) languages.item(index), "val");
            if (!value.isEmpty()) return value;
        }
        return "";
    }

    private static Map<String, String> readNotes(File file, String noteElementName) throws IOException {
        if (file == null || !file.isFile()) return Collections.emptyMap();
        Document document = parseXmlFile(file);
        Map<String, String> result = new HashMap<>();
        NodeList notes = document.getElementsByTagNameNS("*", noteElementName);
        for (int index = 0; index < notes.getLength(); index++) {
            Element note = (Element) notes.item(index);
            String id = attributeByLocalName(note, "id");
            if (id.isEmpty() || id.startsWith("-")) continue;
            String text = visibleText(note);
            if (!text.isEmpty()) result.put(id, text);
        }
        return result;
    }

    private static void collectBodyBlocks(
            Element body,
            Map<String, Relationship> relationships,
            Map<String, String> styleNames,
            List<ReadingStructuredDocument.Block> blocks,
            List<ReadingStructuredDocument.NavigationItem> navigation,
            Set<String> footnoteIds,
            Set<String> endnoteIds,
            int[] serial
    ) {
        NodeList children = body.getChildNodes();
        for (int index = 0; index < children.getLength(); index++) {
            Node node = children.item(index);
            if (node.getNodeType() != Node.ELEMENT_NODE) continue;
            Element element = (Element) node;
            String name = localName(element);
            if ("p".equals(name)) {
                addParagraph(
                        element,
                        relationships,
                        styleNames,
                        blocks,
                        navigation,
                        footnoteIds,
                        endnoteIds,
                        serial,
                        "paragraph"
                );
            } else if ("tbl".equals(name)) {
                collectTableCells(element, relationships, styleNames, blocks, footnoteIds, endnoteIds, serial);
            }
        }
    }

    private static void collectTableCells(
            Element table,
            Map<String, Relationship> relationships,
            Map<String, String> styleNames,
            List<ReadingStructuredDocument.Block> blocks,
            Set<String> footnoteIds,
            Set<String> endnoteIds,
            int[] serial
    ) {
        NodeList cells = table.getElementsByTagNameNS("*", "tc");
        for (int index = 0; index < cells.getLength(); index++) {
            Element cell = (Element) cells.item(index);
            collectReferences(cell, footnoteIds, endnoteIds);
            String text = visibleText(cell);
            if (!text.isEmpty()) {
                blocks.add(new ReadingStructuredDocument.Block(
                        "docx-" + (++serial[0]),
                        "table-cell",
                        text,
                        0,
                        "",
                        collectLinks(cell, relationships)
                ));
            }
            collectAltText(cell, blocks, serial);
        }
    }

    private static void addParagraph(
            Element paragraph,
            Map<String, Relationship> relationships,
            Map<String, String> styleNames,
            List<ReadingStructuredDocument.Block> blocks,
            List<ReadingStructuredDocument.NavigationItem> navigation,
            Set<String> footnoteIds,
            Set<String> endnoteIds,
            int[] serial,
            String defaultType
    ) {
        collectReferences(paragraph, footnoteIds, endnoteIds);
        String text = visibleText(paragraph);
        String type = defaultType;
        int level = 0;

        Element properties = firstDirectChild(paragraph, "pPr");
        if (properties != null) {
            Element style = firstElement(properties, "pStyle");
            String styleId = style == null ? "" : attributeByLocalName(style, "val");
            int headingLevel = headingLevel(styleId, styleNames.get(styleId));
            if (headingLevel > 0) {
                type = "heading";
                level = headingLevel;
            } else if (firstElement(properties, "numPr") != null) {
                type = "list-item";
            }
        }

        String bookmark = firstBookmarkName(paragraph);
        if (!text.isEmpty()) {
            String id = bookmark.isEmpty() ? "docx-" + (++serial[0]) : bookmark;
            List<ReadingStructuredDocument.Link> links = collectLinks(paragraph, relationships);
            blocks.add(new ReadingStructuredDocument.Block(id, type, text, level, bookmark.isEmpty() ? "" : "#" + bookmark, links));
            if ("heading".equals(type)) {
                navigation.add(new ReadingStructuredDocument.NavigationItem(text, "#" + id, level));
            }
        }
        collectAltText(paragraph, blocks, serial);
    }

    private static void collectAltText(Element scope, List<ReadingStructuredDocument.Block> blocks, int[] serial) {
        NodeList all = scope.getElementsByTagName("*");
        for (int index = 0; index < all.getLength(); index++) {
            Node node = all.item(index);
            if (!(node instanceof Element)) continue;
            Element element = (Element) node;
            String name = localName(element);
            if (!"docPr".equals(name) && !"cNvPr".equals(name)) continue;
            String description = clean(element.getAttribute("descr"));
            if (description.isEmpty()) description = clean(element.getAttribute("title"));
            if (description.isEmpty()) continue;
            blocks.add(new ReadingStructuredDocument.Block(
                    "docx-" + (++serial[0]),
                    "paragraph",
                    description,
                    0,
                    ""
            ));
        }
    }

    private static List<ReadingStructuredDocument.Link> collectLinks(
            Element scope,
            Map<String, Relationship> relationships
    ) {
        List<ReadingStructuredDocument.Link> result = new ArrayList<>();
        NodeList hyperlinks = scope.getElementsByTagNameNS("*", "hyperlink");
        for (int index = 0; index < hyperlinks.getLength(); index++) {
            Element hyperlink = (Element) hyperlinks.item(index);
            String text = visibleText(hyperlink);
            String relationshipId = attributeByLocalName(hyperlink, "id");
            String anchor = attributeByLocalName(hyperlink, "anchor");
            if (!relationshipId.isEmpty()) {
                Relationship relationship = relationships.get(relationshipId);
                if (relationship != null && !clean(relationship.target).isEmpty()) {
                    result.add(new ReadingStructuredDocument.Link(
                            text,
                            relationship.target,
                            relationship.external || isExternalHref(relationship.target)
                    ));
                }
            } else if (!anchor.isEmpty()) {
                result.add(new ReadingStructuredDocument.Link(text, "#" + anchor, false));
            }
        }

        NodeList footnotes = scope.getElementsByTagNameNS("*", "footnoteReference");
        for (int index = 0; index < footnotes.getLength(); index++) {
            String id = attributeByLocalName((Element) footnotes.item(index), "id");
            if (!id.isEmpty() && !id.startsWith("-")) {
                result.add(new ReadingStructuredDocument.Link(id, "#footnote-" + id, false));
            }
        }
        NodeList endnotes = scope.getElementsByTagNameNS("*", "endnoteReference");
        for (int index = 0; index < endnotes.getLength(); index++) {
            String id = attributeByLocalName((Element) endnotes.item(index), "id");
            if (!id.isEmpty() && !id.startsWith("-")) {
                result.add(new ReadingStructuredDocument.Link(id, "#endnote-" + id, false));
            }
        }
        return result;
    }

    private static void collectReferences(Element scope, Set<String> footnoteIds, Set<String> endnoteIds) {
        NodeList footnotes = scope.getElementsByTagNameNS("*", "footnoteReference");
        for (int index = 0; index < footnotes.getLength(); index++) {
            String id = attributeByLocalName((Element) footnotes.item(index), "id");
            if (!id.isEmpty() && !id.startsWith("-")) footnoteIds.add(id);
        }
        NodeList endnotes = scope.getElementsByTagNameNS("*", "endnoteReference");
        for (int index = 0; index < endnotes.getLength(); index++) {
            String id = attributeByLocalName((Element) endnotes.item(index), "id");
            if (!id.isEmpty() && !id.startsWith("-")) endnoteIds.add(id);
        }
    }

    private static void appendReferencedNotes(
            List<ReadingStructuredDocument.Block> blocks,
            Map<String, String> notes,
            Set<String> referenced,
            String prefix,
            int[] serial
    ) {
        for (String id : referenced) {
            String text = notes.get(id);
            if (text == null || text.isEmpty()) continue;
            String target = prefix + "-" + id;
            blocks.add(new ReadingStructuredDocument.Block(
                    target,
                    "paragraph",
                    text,
                    0,
                    "#" + target
            ));
            serial[0] += 1;
        }
    }

    private static String visibleText(Node node) {
        StringBuilder output = new StringBuilder();
        appendVisibleText(node, output, false);
        return normalizeWhitespace(output.toString());
    }

    private static void appendVisibleText(Node node, StringBuilder output, boolean hidden) {
        if (node == null) return;
        if (node.getNodeType() == Node.TEXT_NODE) return;
        if (node.getNodeType() != Node.ELEMENT_NODE) {
            NodeList children = node.getChildNodes();
            for (int index = 0; index < children.getLength(); index++) {
                appendVisibleText(children.item(index), output, hidden);
            }
            return;
        }

        Element element = (Element) node;
        String name = localName(element);
        boolean nowHidden = hidden || "del".equals(name) || "moveFrom".equals(name);
        if (!nowHidden && "t".equals(name)) appendToken(output, element.getTextContent());
        if (!nowHidden && ("tab".equals(name) || "br".equals(name) || "cr".equals(name))) appendToken(output, " ");
        if ("delText".equals(name)) return;

        NodeList children = element.getChildNodes();
        for (int index = 0; index < children.getLength(); index++) {
            appendVisibleText(children.item(index), output, nowHidden);
        }
    }

    private static int headingLevel(String styleId, String styleName) {
        String combined = (clean(styleId) + " " + clean(styleName)).toLowerCase(Locale.ROOT)
                .replace('í', 'i')
                .replace('ú', 'u');
        if (!(combined.contains("heading") || combined.contains("titulo") || combined.contains("encabezado"))) {
            return 0;
        }
        for (int level = 1; level <= 6; level++) {
            if (combined.matches(".*(?:^|[^0-9])" + level + "(?:[^0-9]|$).*") || combined.endsWith(String.valueOf(level))) {
                return level;
            }
        }
        return combined.contains("heading") ? 1 : 0;
    }

    private static String firstBookmarkName(Element paragraph) {
        NodeList bookmarks = paragraph.getElementsByTagNameNS("*", "bookmarkStart");
        if (bookmarks.getLength() == 0) return "";
        String name = attributeByLocalName((Element) bookmarks.item(0), "name");
        return name.startsWith("_") ? "" : name;
    }

    private static Document parseXmlFile(File file) throws IOException {
        try (InputStream input = new FileInputStream(file)) {
            return ReadingXml.parse(input);
        }
    }

    private static File resolveRelationshipTarget(File root, String sourcePart, String target) throws IOException {
        String cleanTarget = clean(target).replace('\\', '/');
        if (cleanTarget.startsWith("/")) return safePart(root, cleanTarget.substring(1));
        String source = normalizePartPath(sourcePart);
        int slash = source.lastIndexOf('/');
        String directory = slash < 0 ? "" : source.substring(0, slash + 1);
        return safePart(root, normalizePartPath(directory + cleanTarget));
    }

    private static File safePart(File root, String part) throws IOException {
        File canonicalRoot = root.getCanonicalFile();
        File candidate = new File(canonicalRoot, normalizePartPath(part)).getCanonicalFile();
        String rootPath = canonicalRoot.getPath();
        String candidatePath = candidate.getPath();
        if (!candidatePath.equals(rootPath) && !candidatePath.startsWith(rootPath + File.separator)) {
            throw new DocxException("invalid-docx", "DOCX relationship escapes package root");
        }
        return candidate;
    }

    private static String normalizePartPath(String value) {
        String normalized = clean(value).replace('\\', '/');
        while (normalized.startsWith("/")) normalized = normalized.substring(1);
        String[] pieces = normalized.split("/");
        List<String> output = new ArrayList<>();
        for (String piece : pieces) {
            if (piece.isEmpty() || ".".equals(piece)) continue;
            if ("..".equals(piece)) {
                if (!output.isEmpty()) output.remove(output.size() - 1);
                else return "../invalid";
            } else {
                output.add(piece);
            }
        }
        return join(output, "/");
    }

    private static String firstText(Element scope, String localName) {
        Element element = firstElement(scope, localName);
        return element == null ? "" : normalizeWhitespace(element.getTextContent());
    }

    private static Element firstElement(Element scope, String wantedLocalName) {
        if (scope == null) return null;
        NodeList all = scope.getElementsByTagNameNS("*", wantedLocalName);
        if (all.getLength() == 0) return null;
        return (Element) all.item(0);
    }

    private static Element firstDirectChild(Element parent, String wantedLocalName) {
        NodeList children = parent.getChildNodes();
        for (int index = 0; index < children.getLength(); index++) {
            Node node = children.item(index);
            if (node.getNodeType() == Node.ELEMENT_NODE && wantedLocalName.equals(localName(node))) {
                return (Element) node;
            }
        }
        return null;
    }

    private static String attributeByLocalName(Element element, String wantedLocalName) {
        String direct = clean(element.getAttribute(wantedLocalName));
        if (!direct.isEmpty()) return direct;
        NamedNodeMap attributes = element.getAttributes();
        for (int index = 0; index < attributes.getLength(); index++) {
            Node attribute = attributes.item(index);
            String local = attribute.getLocalName();
            if (wantedLocalName.equals(local) || wantedLocalName.equals(attribute.getNodeName())) {
                return clean(attribute.getNodeValue());
            }
        }
        return "";
    }

    private static String localName(Node node) {
        String local = node.getLocalName();
        if (local != null && !local.isEmpty()) return local;
        String name = node.getNodeName();
        int colon = name.indexOf(':');
        return colon >= 0 ? name.substring(colon + 1) : name;
    }

    private static boolean isExternalHref(String href) {
        String lower = clean(href).toLowerCase(Locale.ROOT);
        return lower.startsWith("http://")
                || lower.startsWith("https://")
                || lower.startsWith("mailto:")
                || lower.startsWith("tel:");
    }

    private static String normalizeWhitespace(String value) {
        return clean(value).replaceAll("\\s+", " ");
    }

    private static void appendToken(StringBuilder output, String value) {
        String token = value == null ? "" : value;
        if (token.isEmpty()) return;
        output.append(token);
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private static List<String> asList(String first, String second) {
        List<String> result = new ArrayList<>();
        result.add(first);
        result.add(second);
        return result;
    }

    private static String join(List<String> values, String separator) {
        StringBuilder output = new StringBuilder();
        for (String value : values) {
            if (output.length() > 0) output.append(separator);
            output.append(value);
        }
        return output.toString();
    }

    private static void deleteTree(File file) {
        if (file == null || !file.exists()) return;
        File[] children = file.listFiles();
        if (children != null) {
            for (File child : children) deleteTree(child);
        }
        if (!file.delete()) file.deleteOnExit();
    }

    private static final class Metadata {
        private String title = "";
        private String author = "";
        private String language = "";
    }

    private static final class Relationship {
        private final String type;
        private final String target;
        private final boolean external;

        private Relationship(String type, String target, boolean external) {
            this.type = clean(type);
            this.target = clean(target);
            this.external = external;
        }
    }

    public static final class DocxException extends IOException {
        private final String code;

        public DocxException(String code, String message) {
            super(message);
            this.code = code;
        }

        public DocxException(String code, String message, Throwable cause) {
            super(message, cause);
            this.code = code;
        }

        public String getCode() {
            return code;
        }
    }
}
