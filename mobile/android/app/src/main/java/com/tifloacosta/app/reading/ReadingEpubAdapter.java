package com.tifloacosta.app.reading;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public final class ReadingEpubAdapter {
    private static final Set<String> BLOCKED_ELEMENTS = new HashSet<>();

    static {
        Collections.addAll(
                BLOCKED_ELEMENTS,
                "script", "style", "template", "object", "embed", "iframe",
                "form", "input", "button", "select", "textarea", "canvas", "svg"
        );
    }

    public ReadingStructuredDocument read(InputStream input, File workRoot) throws IOException {
        if (input == null) throw new IllegalArgumentException("input is required");
        if (workRoot == null) throw new IllegalArgumentException("workRoot is required");

        ReadingPackageExtractor.Extraction extraction = null;
        try {
            extraction = new ReadingPackageExtractor().extract(
                    input,
                    workRoot,
                    Collections.singletonList("META-INF/container.xml")
            );
            File root = extraction.getRoot();
            rejectProtectedPackage(root, extraction.getEntries());
            validateMimeTypeIfPresent(root, extraction.getEntries());

            String opfPath = readPackagePath(root);
            File opfFile = safePackageFile(root, opfPath);
            if (!opfFile.isFile()) throw new EpubException("invalid-epub", "EPUB package document is missing");

            PackageData packageData = parsePackage(root, opfPath, opfFile);
            if (packageData.spine.isEmpty()) {
                throw new EpubException("invalid-epub", "EPUB spine is empty");
            }

            List<ReadingStructuredDocument.Block> blocks = new ArrayList<>();
            List<ReadingStructuredDocument.MediaSyncReference> mediaSync = new ArrayList<>();
            int[] blockSerial = new int[]{0};

            for (String itemId : packageData.spine) {
                ManifestItem item = packageData.manifest.get(itemId);
                if (item == null || !isXhtml(item.mediaType)) continue;
                String itemPath = resolvePackageHref(opfPath, item.href);
                File xhtmlFile = safePackageFile(root, stripFragmentAndQuery(itemPath));
                if (!xhtmlFile.isFile()) {
                    throw new EpubException("invalid-epub", "EPUB spine resource is missing: " + item.href);
                }
                Document xhtml = parseXmlFile(xhtmlFile);
                collectBlocks(xhtml.getDocumentElement(), itemPath, blocks, blockSerial);

                if (!item.mediaOverlayId.isEmpty()) {
                    ManifestItem overlay = packageData.manifest.get(item.mediaOverlayId);
                    if (overlay != null && isSmil(overlay.mediaType)) {
                        String overlayPath = resolvePackageHref(opfPath, overlay.href);
                        File overlayFile = safePackageFile(root, stripFragmentAndQuery(overlayPath));
                        if (overlayFile.isFile()) {
                            collectMediaOverlay(parseXmlFile(overlayFile), overlayPath, mediaSync);
                        }
                    }
                }
            }

            if (blocks.isEmpty()) {
                throw new EpubException("invalid-epub", "EPUB contains no readable spine content");
            }

            NavigationData navigation = readNavigation(root, opfPath, packageData);
            return new ReadingStructuredDocument(
                    packageData.title,
                    packageData.author,
                    packageData.language,
                    blocks,
                    navigation.toc,
                    navigation.pages,
                    mediaSync
            );
        } catch (EpubException error) {
            throw error;
        } catch (ReadingPackageExtractor.PackageException error) {
            throw new EpubException("invalid-epub", error.getMessage(), error);
        } catch (IOException error) {
            throw new EpubException("invalid-epub", "Unable to read EPUB package", error);
        } catch (RuntimeException error) {
            throw new EpubException("invalid-epub", "Malformed EPUB package", error);
        } finally {
            if (extraction != null) deleteTree(extraction.getRoot());
        }
    }

    private static void rejectProtectedPackage(File root, List<String> entries) throws IOException {
        for (String entry : entries) {
            String lower = entry.toLowerCase(Locale.ROOT);
            if ("meta-inf/encryption.xml".equals(lower)
                    || "meta-inf/rights.xml".equals(lower)
                    || lower.endsWith("/encryption.xml")) {
                File protectedFile = safePackageFile(root, entry);
                if (protectedFile.isFile()) {
                    throw new EpubException("protected-epub", "Protected or encrypted EPUB is not supported");
                }
            }
        }
    }

    private static void validateMimeTypeIfPresent(File root, List<String> entries) throws IOException {
        if (!entries.contains("mimetype")) return;
        File mimetype = safePackageFile(root, "mimetype");
        String value = new String(Files.readAllBytes(mimetype.toPath()), StandardCharsets.US_ASCII).trim();
        if (!"application/epub+zip".equals(value)) {
            throw new EpubException("invalid-epub", "Invalid EPUB mimetype");
        }
    }

    private static String readPackagePath(File root) throws IOException {
        Document container = parseXmlFile(safePackageFile(root, "META-INF/container.xml"));
        NodeList rootfiles = container.getElementsByTagNameNS("*", "rootfile");
        if (rootfiles.getLength() == 0) {
            throw new EpubException("invalid-epub", "EPUB container has no rootfile");
        }
        Element rootfile = (Element) rootfiles.item(0);
        String path = clean(rootfile.getAttribute("full-path"));
        if (path.isEmpty()) throw new EpubException("invalid-epub", "EPUB rootfile path is empty");
        return normalizePackagePath(path);
    }

    private static PackageData parsePackage(File root, String opfPath, File opfFile) throws IOException {
        Document document = parseXmlFile(opfFile);
        PackageData data = new PackageData();

        Element metadata = firstElement(document.getDocumentElement(), "metadata");
        if (metadata != null) {
            data.title = firstText(metadata, "title");
            data.author = firstText(metadata, "creator");
            data.language = firstText(metadata, "language");
        }

        Element manifest = firstElement(document.getDocumentElement(), "manifest");
        if (manifest == null) throw new EpubException("invalid-epub", "EPUB manifest is missing");
        for (Element item : childElements(manifest, "item")) {
            String id = clean(item.getAttribute("id"));
            String href = clean(item.getAttribute("href"));
            if (id.isEmpty() || href.isEmpty()) continue;
            ManifestItem value = new ManifestItem(
                    id,
                    href,
                    clean(item.getAttribute("media-type")),
                    clean(item.getAttribute("properties")),
                    clean(item.getAttribute("media-overlay"))
            );
            data.manifest.put(id, value);
            if (hasProperty(value.properties, "nav")) data.navItem = value;
            if ("application/x-dtbncx+xml".equalsIgnoreCase(value.mediaType)) data.ncxItem = value;
        }

        Element spine = firstElement(document.getDocumentElement(), "spine");
        if (spine == null) throw new EpubException("invalid-epub", "EPUB spine is missing");
        data.spineTocId = clean(spine.getAttribute("toc"));
        for (Element itemref : childElements(spine, "itemref")) {
            String idref = clean(itemref.getAttribute("idref"));
            if (!idref.isEmpty()) data.spine.add(idref);
        }
        return data;
    }

    private static NavigationData readNavigation(File root, String opfPath, PackageData packageData) throws IOException {
        NavigationData result = new NavigationData();
        if (packageData.navItem != null) {
            String navPath = resolvePackageHref(opfPath, packageData.navItem.href);
            File navFile = safePackageFile(root, stripFragmentAndQuery(navPath));
            if (navFile.isFile()) {
                Document nav = parseXmlFile(navFile);
                for (Element navElement : descendants(nav.getDocumentElement(), "nav")) {
                    String type = epubType(navElement).toLowerCase(Locale.ROOT);
                    if (containsToken(type, "toc")) {
                        collectHtmlNavigation(navElement, navPath, result.toc);
                    } else if (containsToken(type, "page-list")) {
                        collectPageList(navElement, navPath, result.pages);
                    }
                }
            }
        }

        if (result.toc.isEmpty()) {
            ManifestItem ncx = packageData.ncxItem;
            if (ncx == null && !packageData.spineTocId.isEmpty()) {
                ncx = packageData.manifest.get(packageData.spineTocId);
            }
            if (ncx != null) {
                String ncxPath = resolvePackageHref(opfPath, ncx.href);
                File ncxFile = safePackageFile(root, stripFragmentAndQuery(ncxPath));
                if (ncxFile.isFile()) collectNcxNavigation(parseXmlFile(ncxFile), ncxPath, result.toc);
            }
        }
        return result;
    }

    private static void collectBlocks(
            Node node,
            String documentPath,
            List<ReadingStructuredDocument.Block> output,
            int[] serial
    ) throws IOException {
        if (node == null) return;
        if (node.getNodeType() != Node.ELEMENT_NODE) {
            NodeList children = node.getChildNodes();
            for (int i = 0; i < children.getLength(); i++) collectBlocks(children.item(i), documentPath, output, serial);
            return;
        }

        Element element = (Element) node;
        String name = localName(element).toLowerCase(Locale.ROOT);
        if (BLOCKED_ELEMENTS.contains(name)) return;

        String type = null;
        int level = 0;
        if (name.matches("h[1-6]")) {
            type = "heading";
            level = Integer.parseInt(name.substring(1));
        } else if ("p".equals(name)) {
            type = "paragraph";
        } else if ("li".equals(name)) {
            type = "list-item";
        } else if ("blockquote".equals(name)) {
            type = "quote";
        } else if ("td".equals(name) || "th".equals(name)) {
            type = "table-cell";
        }

        if (type != null) {
            String text = readableText(element);
            if (!text.isEmpty()) {
                String fragment = clean(element.getAttribute("id"));
                String href = fragment.isEmpty() ? documentPath : documentPath + "#" + fragment;
                String id = fragment.isEmpty() ? "epub-" + (++serial[0]) : documentPath + "#" + fragment;
                output.add(new ReadingStructuredDocument.Block(id, type, text, level, href));
            }
            return;
        }

        NodeList children = element.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            collectBlocks(children.item(i), documentPath, output, serial);
        }
    }

    private static String readableText(Node node) {
        StringBuilder builder = new StringBuilder();
        appendReadableText(node, builder);
        return normalizeWhitespace(builder.toString());
    }

    private static void appendReadableText(Node node, StringBuilder output) {
        if (node == null) return;
        if (node.getNodeType() == Node.TEXT_NODE || node.getNodeType() == Node.CDATA_SECTION_NODE) {
            appendToken(output, node.getNodeValue());
            return;
        }
        if (node.getNodeType() != Node.ELEMENT_NODE) return;

        Element element = (Element) node;
        String name = localName(element).toLowerCase(Locale.ROOT);
        if (BLOCKED_ELEMENTS.contains(name)) return;
        if ("img".equals(name)) {
            appendToken(output, element.getAttribute("alt"));
            return;
        }
        if ("br".equals(name)) {
            appendToken(output, " ");
            return;
        }

        NodeList children = element.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) appendReadableText(children.item(i), output);
    }

    private static void collectHtmlNavigation(
            Element nav,
            String navPath,
            List<ReadingStructuredDocument.NavigationItem> output
    ) throws IOException {
        for (Element anchor : descendants(nav, "a")) {
            String label = readableText(anchor);
            String href = clean(anchor.getAttribute("href"));
            if (label.isEmpty() || href.isEmpty()) continue;
            output.add(new ReadingStructuredDocument.NavigationItem(
                    label,
                    resolveHrefAllowExternal(navPath, href),
                    navigationDepth(anchor, nav)
            ));
        }
    }

    private static void collectPageList(
            Element nav,
            String navPath,
            List<ReadingStructuredDocument.PageReference> output
    ) throws IOException {
        for (Element anchor : descendants(nav, "a")) {
            String label = readableText(anchor);
            String href = clean(anchor.getAttribute("href"));
            if (label.isEmpty() || href.isEmpty()) continue;
            output.add(new ReadingStructuredDocument.PageReference(
                    label,
                    resolveHrefAllowExternal(navPath, href)
            ));
        }
    }

    private static void collectNcxNavigation(
            Document ncx,
            String ncxPath,
            List<ReadingStructuredDocument.NavigationItem> output
    ) throws IOException {
        Element navMap = firstElement(ncx.getDocumentElement(), "navMap");
        if (navMap == null) return;
        collectNcxPoints(navMap, ncxPath, output, 1);
    }

    private static void collectNcxPoints(
            Element parent,
            String ncxPath,
            List<ReadingStructuredDocument.NavigationItem> output,
            int level
    ) throws IOException {
        for (Element point : childElements(parent, "navPoint")) {
            Element labelElement = firstElement(point, "navLabel");
            Element content = firstElement(point, "content");
            String label = labelElement == null ? "" : readableText(labelElement);
            String src = content == null ? "" : clean(content.getAttribute("src"));
            if (!label.isEmpty() && !src.isEmpty()) {
                output.add(new ReadingStructuredDocument.NavigationItem(
                        label,
                        resolveHrefAllowExternal(ncxPath, src),
                        level
                ));
            }
            collectNcxPoints(point, ncxPath, output, level + 1);
        }
    }

    private static void collectMediaOverlay(
            Document smil,
            String smilPath,
            List<ReadingStructuredDocument.MediaSyncReference> output
    ) throws IOException {
        for (Element par : descendants(smil.getDocumentElement(), "par")) {
            Element text = firstElement(par, "text");
            Element audio = firstElement(par, "audio");
            if (text == null || audio == null) continue;
            String textSrc = clean(text.getAttribute("src"));
            String audioSrc = clean(audio.getAttribute("src"));
            if (textSrc.isEmpty() || audioSrc.isEmpty()) continue;
            output.add(new ReadingStructuredDocument.MediaSyncReference(
                    resolveHrefAllowExternal(smilPath, textSrc),
                    resolveHrefAllowExternal(smilPath, audioSrc),
                    parseClockMs(audio.getAttribute("clipBegin")),
                    parseClockMs(audio.getAttribute("clipEnd"))
            ));
        }
    }

    private static long parseClockMs(String raw) {
        String value = clean(raw).toLowerCase(Locale.ROOT);
        if (value.startsWith("npt=")) value = value.substring(4);
        try {
            if (value.endsWith("ms")) {
                return Math.max(0L, Math.round(Double.parseDouble(value.substring(0, value.length() - 2))));
            }
            if (value.endsWith("s")) {
                return Math.max(0L, Math.round(Double.parseDouble(value.substring(0, value.length() - 1)) * 1000.0));
            }
            String[] parts = value.split(":");
            if (parts.length == 2 || parts.length == 3) {
                double seconds = 0.0;
                for (String part : parts) seconds = seconds * 60.0 + Double.parseDouble(part);
                return Math.max(0L, Math.round(seconds * 1000.0));
            }
            if (!value.isEmpty()) return Math.max(0L, Math.round(Double.parseDouble(value) * 1000.0));
        } catch (NumberFormatException ignored) {
        }
        return 0L;
    }

    private static int navigationDepth(Element anchor, Element nav) {
        int depth = 1;
        Node node = anchor.getParentNode();
        while (node != null && node != nav) {
            if (node.getNodeType() == Node.ELEMENT_NODE && "li".equalsIgnoreCase(localName(node))) depth++;
            node = node.getParentNode();
        }
        return Math.max(1, depth - 1);
    }

    private static String epubType(Element element) {
        String value = clean(element.getAttributeNS("http://www.idpf.org/2007/ops", "type"));
        if (!value.isEmpty()) return value;
        value = clean(element.getAttribute("epub:type"));
        if (!value.isEmpty()) return value;
        return clean(element.getAttribute("type"));
    }

    private static String resolveHrefAllowExternal(String baseFile, String href) throws IOException {
        String value = clean(href);
        if (isExternalHref(value)) return value;
        return resolvePackageHref(baseFile, value);
    }

    private static boolean isExternalHref(String value) {
        return value.matches("^[A-Za-z][A-Za-z0-9+.-]*:.*") || value.startsWith("//");
    }

    private static String resolvePackageHref(String baseFile, String href) throws IOException {
        String value = clean(href).replace('\\', '/');
        String fragment = "";
        int hash = value.indexOf('#');
        if (hash >= 0) {
            fragment = value.substring(hash);
            value = value.substring(0, hash);
        }
        String query = "";
        int question = value.indexOf('?');
        if (question >= 0) {
            query = value.substring(question);
            value = value.substring(0, question);
        }
        if (value.isEmpty()) return normalizePackagePath(stripFragmentAndQuery(baseFile)) + query + fragment;
        if (value.startsWith("/")) throw new EpubException("invalid-epub", "Absolute EPUB resource path is not allowed");
        String base = stripFragmentAndQuery(baseFile).replace('\\', '/');
        int slash = base.lastIndexOf('/');
        String parent = slash >= 0 ? base.substring(0, slash + 1) : "";
        return normalizePackagePath(parent + value) + query + fragment;
    }

    private static String normalizePackagePath(String value) throws IOException {
        String input = clean(value).replace('\\', '/');
        if (input.isEmpty() || input.startsWith("/")) {
            throw new EpubException("invalid-epub", "Invalid EPUB package path");
        }
        Deque<String> stack = new ArrayDeque<>();
        for (String part : input.split("/")) {
            if (part.isEmpty() || ".".equals(part)) continue;
            if ("..".equals(part)) {
                if (stack.isEmpty()) throw new EpubException("invalid-epub", "EPUB resource escapes package root");
                stack.removeLast();
            } else {
                stack.addLast(part);
            }
        }
        if (stack.isEmpty()) throw new EpubException("invalid-epub", "Invalid EPUB package path");
        return String.join("/", stack);
    }

    private static File safePackageFile(File root, String relativePath) throws IOException {
        String normalized = normalizePackagePath(stripFragmentAndQuery(relativePath));
        File file = new File(root, normalized.replace('/', File.separatorChar));
        String rootPath = root.getCanonicalPath();
        String filePath = file.getCanonicalPath();
        if (!filePath.startsWith(rootPath + File.separator)) {
            throw new EpubException("invalid-epub", "EPUB resource escapes package root");
        }
        return file;
    }

    private static String stripFragmentAndQuery(String href) {
        String value = clean(href);
        int hash = value.indexOf('#');
        if (hash >= 0) value = value.substring(0, hash);
        int question = value.indexOf('?');
        if (question >= 0) value = value.substring(0, question);
        return value;
    }

    private static Document parseXmlFile(File file) throws IOException {
        try (InputStream input = new FileInputStream(file)) {
            return ReadingXml.parse(input);
        }
    }

    private static Element firstElement(Element parent, String name) {
        if (parent == null) return null;
        NodeList all = parent.getElementsByTagNameNS("*", name);
        return all.getLength() == 0 ? null : (Element) all.item(0);
    }

    private static List<Element> childElements(Element parent, String name) {
        List<Element> result = new ArrayList<>();
        if (parent == null) return result;
        NodeList children = parent.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            Node child = children.item(i);
            if (child.getNodeType() == Node.ELEMENT_NODE && name.equalsIgnoreCase(localName(child))) {
                result.add((Element) child);
            }
        }
        return result;
    }

    private static List<Element> descendants(Element parent, String name) {
        List<Element> result = new ArrayList<>();
        if (parent == null) return result;
        NodeList all = parent.getElementsByTagNameNS("*", name);
        for (int i = 0; i < all.getLength(); i++) result.add((Element) all.item(i));
        return result;
    }

    private static String firstText(Element parent, String name) {
        Element element = firstElement(parent, name);
        return element == null ? "" : ReadingXml.normalizedText(element);
    }

    private static String localName(Node node) {
        String local = node.getLocalName();
        return local == null || local.isEmpty() ? node.getNodeName().replaceFirst("^.*:", "") : local;
    }

    private static boolean isXhtml(String mediaType) {
        return "application/xhtml+xml".equalsIgnoreCase(clean(mediaType))
                || "text/html".equalsIgnoreCase(clean(mediaType));
    }

    private static boolean isSmil(String mediaType) {
        String value = clean(mediaType).toLowerCase(Locale.ROOT);
        return "application/smil+xml".equals(value) || "application/smil".equals(value);
    }

    private static boolean hasProperty(String properties, String token) {
        return containsToken(clean(properties).toLowerCase(Locale.ROOT), token.toLowerCase(Locale.ROOT));
    }

    private static boolean containsToken(String value, String token) {
        for (String part : clean(value).split("\\s+")) {
            if (token.equalsIgnoreCase(part)) return true;
        }
        return false;
    }

    private static void appendToken(StringBuilder builder, String raw) {
        String value = clean(raw);
        if (value.isEmpty()) return;
        if (builder.length() > 0 && !Character.isWhitespace(builder.charAt(builder.length() - 1))) builder.append(' ');
        builder.append(value);
    }

    private static String normalizeWhitespace(String value) {
        return value == null ? "" : value.replaceAll("\\s+", " ").trim();
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private static void deleteTree(File file) {
        if (file == null || !file.exists()) return;
        File[] children = file.listFiles();
        if (children != null) {
            for (File child : children) deleteTree(child);
        }
        file.delete();
    }

    private static final class ManifestItem {
        final String id;
        final String href;
        final String mediaType;
        final String properties;
        final String mediaOverlayId;

        ManifestItem(String id, String href, String mediaType, String properties, String mediaOverlayId) {
            this.id = id;
            this.href = href;
            this.mediaType = mediaType;
            this.properties = properties;
            this.mediaOverlayId = mediaOverlayId;
        }
    }

    private static final class PackageData {
        String title = "";
        String author = "";
        String language = "";
        String spineTocId = "";
        final Map<String, ManifestItem> manifest = new LinkedHashMap<>();
        final List<String> spine = new ArrayList<>();
        ManifestItem navItem;
        ManifestItem ncxItem;
    }

    private static final class NavigationData {
        final List<ReadingStructuredDocument.NavigationItem> toc = new ArrayList<>();
        final List<ReadingStructuredDocument.PageReference> pages = new ArrayList<>();
    }

    public static final class EpubException extends IOException {
        private final String code;

        public EpubException(String code, String message) {
            super(message);
            this.code = code;
        }

        public EpubException(String code, String message, Throwable cause) {
            super(message, cause);
            this.code = code;
        }

        public String getCode() {
            return code;
        }
    }
}
