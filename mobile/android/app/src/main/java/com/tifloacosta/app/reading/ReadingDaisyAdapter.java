package com.tifloacosta.app.reading;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Reads DAISY 2.02 and DAISY 3 packages into the common semantic reading model.
 * The adapter never executes package content or fetches external resources.
 */
public final class ReadingDaisyAdapter {
    public ReadingDaisyBook read(InputStream input, File workRoot) throws IOException {
        if (input == null) throw new IllegalArgumentException("input is required");
        if (workRoot == null) throw new IllegalArgumentException("workRoot is required");

        ReadingPackageExtractor.Extraction extraction = null;
        try {
            extraction = new ReadingPackageExtractor().extract(input, workRoot, Collections.emptyList());
            File root = extraction.getRoot();
            List<String> entries = extraction.getEntries();
            rejectProtectedPackage(entries);

            String nccPath = findEntry(entries, "ncc.html", "ncc.htm");
            if (nccPath != null) return readDaisy202(root, entries, nccPath);

            String opfPath = findByExtension(entries, ".opf");
            if (opfPath != null) return readDaisy3(root, entries, opfPath);

            throw new DaisyException("invalid-daisy", "DAISY package has no NCC or OPF package document");
        } catch (DaisyException error) {
            throw error;
        } catch (ReadingPackageExtractor.PackageException error) {
            throw new DaisyException("invalid-daisy", error.getMessage(), error);
        } catch (IOException error) {
            throw new DaisyException("invalid-daisy", "Unable to read DAISY package", error);
        } catch (RuntimeException error) {
            throw new DaisyException("invalid-daisy", "Malformed DAISY package", error);
        } finally {
            if (extraction != null) deleteTree(extraction.getRoot());
        }
    }

    private static ReadingDaisyBook readDaisy202(File root, List<String> entries, String nccPath)
            throws IOException {
        Document ncc = parseFile(root, nccPath);
        Element html = ncc.getDocumentElement();

        String title = metaContent(ncc, "dc:title");
        if (title.isEmpty()) title = firstText(html, "title");
        String author = metaContent(ncc, "dc:creator");
        String language = metaContent(ncc, "dc:language");
        if (language.isEmpty()) language = xmlLanguage(html);

        LinkedHashSet<String> smilPaths = new LinkedHashSet<>();
        for (Element anchor : descendants(html, "a")) {
            String href = clean(anchor.getAttribute("href"));
            if (href.isEmpty()) continue;
            String resolved = resolveHref(nccPath, href);
            String filePath = stripFragmentAndQuery(resolved);
            if (filePath.toLowerCase(Locale.ROOT).endsWith(".smil")) smilPaths.add(filePath);
        }
        if (smilPaths.isEmpty()) {
            for (String entry : entries) {
                if (entry.toLowerCase(Locale.ROOT).endsWith(".smil")) smilPaths.add(entry);
            }
        }

        DaisyContent content = new DaisyContent();
        Map<String, String> smilTargets = new LinkedHashMap<>();
        for (String smilPath : smilPaths) {
            requireFile(root, smilPath);
            readSmil(root, smilPath, content, smilTargets);
        }

        for (String textPath : content.textResources) {
            requireFile(root, textPath);
            collectTextDocument(parseFile(root, textPath), textPath, content.blocks, content.pages);
        }

        List<ReadingStructuredDocument.NavigationItem> navigation = new ArrayList<>();
        for (int level = 1; level <= 6; level++) {
            for (Element heading : descendants(html, "h" + level)) {
                Element anchor = firstElement(heading, "a");
                if (anchor == null) continue;
                String label = normalizedText(anchor);
                String href = clean(anchor.getAttribute("href"));
                if (label.isEmpty() || href.isEmpty()) continue;
                String resolved = resolveHref(nccPath, href);
                navigation.add(new ReadingStructuredDocument.NavigationItem(
                        label,
                        mappedTarget(resolved, smilTargets),
                        level
                ));
            }
        }

        for (Element element : allElements(html)) {
            String classes = clean(element.getAttribute("class")).toLowerCase(Locale.ROOT);
            if (!containsPageClass(classes)) continue;
            Element anchor = "a".equals(localName(element)) ? element : firstElement(element, "a");
            if (anchor == null) continue;
            String label = normalizedText(anchor);
            String href = clean(anchor.getAttribute("href"));
            if (label.isEmpty() || href.isEmpty()) continue;
            String resolved = mappedTarget(resolveHref(nccPath, href), smilTargets);
            putPage(content.pages, label, resolved);
        }

        ReadingStructuredDocument document = new ReadingStructuredDocument(
                title,
                author,
                language,
                content.blocks,
                navigation,
                new ArrayList<>(content.pages.values()),
                content.sync
        );
        return new ReadingDaisyBook("daisy2.02", document, new ArrayList<>(content.audio.values()));
    }

    private static ReadingDaisyBook readDaisy3(File root, List<String> entries, String opfPath)
            throws IOException {
        Document opf = parseFile(root, opfPath);
        Element packageElement = opf.getDocumentElement();
        Element metadata = firstElement(packageElement, "metadata");
        String title = metadata == null ? "" : firstText(metadata, "title");
        String author = metadata == null ? "" : firstText(metadata, "creator");
        String language = metadata == null ? "" : firstText(metadata, "language");

        Map<String, ManifestItem> manifest = new LinkedHashMap<>();
        Element manifestElement = firstElement(packageElement, "manifest");
        if (manifestElement == null) {
            throw new DaisyException("invalid-daisy", "DAISY 3 manifest is missing");
        }
        for (Element item : childElements(manifestElement, "item")) {
            String id = clean(item.getAttribute("id"));
            String href = clean(item.getAttribute("href"));
            if (id.isEmpty() || href.isEmpty()) continue;
            manifest.put(id, new ManifestItem(id, resolveHref(opfPath, href), clean(item.getAttribute("media-type"))));
        }

        DaisyContent content = new DaisyContent();
        String ncxPath = null;
        LinkedHashSet<String> smilPaths = new LinkedHashSet<>();
        for (ManifestItem item : manifest.values()) {
            String lowerType = item.mediaType.toLowerCase(Locale.ROOT);
            String lowerPath = stripFragmentAndQuery(item.href).toLowerCase(Locale.ROOT);
            if (lowerType.contains("dtbncx") || lowerPath.endsWith(".ncx")) {
                ncxPath = stripFragmentAndQuery(item.href);
            } else if (lowerType.contains("smil") || lowerPath.endsWith(".smil")) {
                smilPaths.add(stripFragmentAndQuery(item.href));
            } else if (lowerType.startsWith("audio/")) {
                String audioPath = stripFragmentAndQuery(item.href);
                requireFile(root, audioPath);
                putAudio(content.audio, audioPath, fileTitle(audioPath));
            } else if (isDaisyTextType(lowerType, lowerPath)) {
                content.textResources.add(stripFragmentAndQuery(item.href));
            }
        }

        Map<String, String> smilTargets = new LinkedHashMap<>();
        for (String smilPath : smilPaths) {
            requireFile(root, smilPath);
            readSmil(root, smilPath, content, smilTargets);
        }

        for (String textPath : content.textResources) {
            requireFile(root, textPath);
            Document textDocument = parseFile(root, textPath);
            if (language.isEmpty()) language = xmlLanguage(textDocument.getDocumentElement());
            collectTextDocument(textDocument, textPath, content.blocks, content.pages);
        }

        List<ReadingStructuredDocument.NavigationItem> navigation = new ArrayList<>();
        if (ncxPath != null) {
            requireFile(root, ncxPath);
            Document ncx = parseFile(root, ncxPath);
            Element navMap = firstElement(ncx.getDocumentElement(), "navMap");
            if (navMap != null) collectNcxPoints(navMap, ncxPath, smilTargets, navigation, 1);
            Element pageList = firstElement(ncx.getDocumentElement(), "pageList");
            if (pageList != null) {
                for (Element target : descendants(pageList, "pageTarget")) {
                    Element labelElement = firstElement(target, "navLabel");
                    Element contentElement = firstElement(target, "content");
                    String label = labelElement == null ? "" : firstText(labelElement, "text");
                    String src = contentElement == null ? "" : clean(contentElement.getAttribute("src"));
                    if (label.isEmpty() || src.isEmpty()) continue;
                    putPage(content.pages, label, mappedTarget(resolveHref(ncxPath, src), smilTargets));
                }
            }
        }

        if (content.blocks.isEmpty() && content.audio.isEmpty()) {
            throw new DaisyException("invalid-daisy", "DAISY 3 package contains no readable text or audio");
        }

        ReadingStructuredDocument document = new ReadingStructuredDocument(
                title,
                author,
                language,
                content.blocks,
                navigation,
                new ArrayList<>(content.pages.values()),
                content.sync
        );
        return new ReadingDaisyBook("daisy3", document, new ArrayList<>(content.audio.values()));
    }

    private static void readSmil(
            File root,
            String smilPath,
            DaisyContent content,
            Map<String, String> smilTargets
    ) throws IOException {
        Document smil = parseFile(root, smilPath);
        for (Element par : descendants(smil.getDocumentElement(), "par")) {
            Element text = firstElement(par, "text");
            Element audio = firstElement(par, "audio");
            String textHref = "";
            String audioHref = "";

            if (text != null) {
                String src = clean(text.getAttribute("src"));
                if (!src.isEmpty()) {
                    textHref = resolveHref(smilPath, src);
                    String textPath = stripFragmentAndQuery(textHref);
                    requireFile(root, textPath);
                    content.textResources.add(textPath);
                }
            }
            if (audio != null) {
                String src = clean(audio.getAttribute("src"));
                if (!src.isEmpty()) {
                    audioHref = resolveHref(smilPath, src);
                    String audioPath = stripFragmentAndQuery(audioHref);
                    requireFile(root, audioPath);
                    putAudio(content.audio, audioPath, fileTitle(audioPath));
                    audioHref = withFragment(audioPath, fragmentOf(audioHref));
                }
            }

            String id = clean(par.getAttribute("id"));
            if (!id.isEmpty() && !textHref.isEmpty()) {
                smilTargets.put(smilPath + "#" + id, textHref);
            }
            if (!textHref.isEmpty() && !audioHref.isEmpty()) {
                content.sync.add(new ReadingStructuredDocument.MediaSyncReference(
                        textHref,
                        stripFragmentAndQuery(audioHref),
                        parseClockMs(firstNonEmpty(
                                audio.getAttribute("clipBegin"),
                                audio.getAttribute("clip-begin")
                        )),
                        parseClockMs(firstNonEmpty(
                                audio.getAttribute("clipEnd"),
                                audio.getAttribute("clip-end")
                        ))
                ));
            }
        }
    }

    private static void collectTextDocument(
            Document document,
            String documentPath,
            List<ReadingStructuredDocument.Block> blocks,
            Map<String, ReadingStructuredDocument.PageReference> pages
    ) throws IOException {
        if (document == null || document.getDocumentElement() == null) return;
        int[] serial = new int[]{blocks.size()};
        collectTextNode(document.getDocumentElement(), documentPath, blocks, pages, serial);
    }

    private static void collectTextNode(
            Node node,
            String documentPath,
            List<ReadingStructuredDocument.Block> blocks,
            Map<String, ReadingStructuredDocument.PageReference> pages,
            int[] serial
    ) throws IOException {
        if (node == null || node.getNodeType() != Node.ELEMENT_NODE) return;
        Element element = (Element) node;
        String name = localName(element).toLowerCase(Locale.ROOT);

        if ("script".equals(name) || "style".equals(name) || "object".equals(name)
                || "embed".equals(name) || "iframe".equals(name) || "form".equals(name)) {
            return;
        }

        if ("pagenum".equals(name)) {
            String label = normalizedText(element);
            String id = clean(element.getAttribute("id"));
            String href = id.isEmpty() ? documentPath : documentPath + "#" + id;
            if (!label.isEmpty()) putPage(pages, label, href);
            return;
        }

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
                String id = fragment.isEmpty() ? "daisy-" + (++serial[0]) : href;
                blocks.add(new ReadingStructuredDocument.Block(id, type, text, level, href));
            }
            return;
        }

        NodeList children = element.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            Node child = children.item(i);
            if (child.getNodeType() == Node.ELEMENT_NODE) {
                collectTextNode(child, documentPath, blocks, pages, serial);
            }
        }
    }

    private static void collectNcxPoints(
            Element parent,
            String ncxPath,
            Map<String, String> smilTargets,
            List<ReadingStructuredDocument.NavigationItem> output,
            int level
    ) throws IOException {
        for (Element point : childElements(parent, "navPoint")) {
            Element labelElement = firstElement(point, "navLabel");
            Element contentElement = firstElement(point, "content");
            String label = labelElement == null ? "" : firstText(labelElement, "text");
            String src = contentElement == null ? "" : clean(contentElement.getAttribute("src"));
            if (!label.isEmpty() && !src.isEmpty()) {
                output.add(new ReadingStructuredDocument.NavigationItem(
                        label,
                        mappedTarget(resolveHref(ncxPath, src), smilTargets),
                        level
                ));
            }
            collectNcxPoints(point, ncxPath, smilTargets, output, level + 1);
        }
    }

    private static String metaContent(Document document, String wantedName) {
        for (Element meta : descendants(document.getDocumentElement(), "meta")) {
            String name = clean(meta.getAttribute("name"));
            if (wantedName.equalsIgnoreCase(name)) return clean(meta.getAttribute("content"));
        }
        return "";
    }

    private static String xmlLanguage(Element element) {
        if (element == null) return "";
        String value = clean(element.getAttribute("xml:lang"));
        if (!value.isEmpty()) return value;
        value = clean(element.getAttributeNS("http://www.w3.org/XML/1998/namespace", "lang"));
        if (!value.isEmpty()) return value;
        return clean(element.getAttribute("lang"));
    }

    private static boolean isDaisyTextType(String mediaType, String path) {
        return mediaType.contains("dtbook")
                || mediaType.equals("application/xhtml+xml")
                || mediaType.equals("text/html")
                || path.endsWith(".xml") && !path.endsWith(".opf") && !path.endsWith(".ncx")
                || path.endsWith(".xhtml") || path.endsWith(".html") || path.endsWith(".htm");
    }

    private static void rejectProtectedPackage(List<String> entries) throws DaisyException {
        for (String entry : entries) {
            String lower = entry.toLowerCase(Locale.ROOT);
            if (lower.endsWith("/encryption.xml") || lower.equals("encryption.xml")
                    || lower.endsWith("/rights.xml") || lower.equals("rights.xml")
                    || lower.endsWith("license.lcpl") || lower.endsWith(".lcp")) {
                throw new DaisyException("protected-daisy", "Protected DAISY packages are not supported");
            }
        }
    }

    private static void requireFile(File root, String path) throws IOException {
        File file = safeFile(root, stripFragmentAndQuery(path));
        if (!file.isFile()) {
            throw new DaisyException("missing-daisy-resource", "DAISY resource is missing: " + path);
        }
    }

    private static Document parseFile(File root, String path) throws IOException {
        File file = safeFile(root, stripFragmentAndQuery(path));
        if (!file.isFile()) {
            throw new DaisyException("missing-daisy-resource", "DAISY resource is missing: " + path);
        }
        try (InputStream input = new FileInputStream(file)) {
            return ReadingXml.parse(input);
        } catch (IOException error) {
            if (error instanceof DaisyException) throw error;
            throw new DaisyException("invalid-daisy", "Invalid DAISY XML resource: " + path, error);
        }
    }

    private static File safeFile(File root, String path) throws IOException {
        String normalized = normalizeRelativePath(path);
        File file = new File(root, normalized.replace('/', File.separatorChar));
        String rootPath = root.getCanonicalPath();
        String filePath = file.getCanonicalPath();
        if (!filePath.startsWith(rootPath + File.separator)) {
            throw new DaisyException("invalid-daisy", "DAISY resource escapes package root");
        }
        return file;
    }

    private static String resolveHref(String basePath, String rawHref) throws IOException {
        String href = clean(rawHref).replace('\\', '/');
        if (href.isEmpty()) return "";
        String lower = href.toLowerCase(Locale.ROOT);
        if (href.startsWith("/") || lower.contains("://") || lower.startsWith("data:")
                || lower.startsWith("javascript:") || lower.startsWith("file:")) {
            throw new DaisyException("invalid-daisy", "External or absolute DAISY resource is not permitted");
        }

        String fragment = fragmentOf(href);
        String pathOnly = stripFragmentAndQuery(href);
        String base = stripFragmentAndQuery(basePath);
        int slash = base.lastIndexOf('/');
        String combined = pathOnly.isEmpty()
                ? base
                : (slash < 0 ? pathOnly : base.substring(0, slash + 1) + pathOnly);
        String normalized = normalizeRelativePath(combined);
        return withFragment(normalized, fragment);
    }

    private static String normalizeRelativePath(String path) throws IOException {
        String value = clean(path).replace('\\', '/');
        if (value.startsWith("/")) throw new DaisyException("invalid-daisy", "Absolute DAISY path is not permitted");
        String[] parts = value.split("/");
        List<String> normalized = new ArrayList<>();
        for (String part : parts) {
            if (part.isEmpty() || ".".equals(part)) continue;
            if ("..".equals(part)) {
                if (normalized.isEmpty()) {
                    throw new DaisyException("invalid-daisy", "DAISY path escapes package root");
                }
                normalized.remove(normalized.size() - 1);
            } else {
                normalized.add(part);
            }
        }
        return join(normalized, "/");
    }

    private static String stripFragmentAndQuery(String href) {
        if (href == null) return "";
        int hash = href.indexOf('#');
        int query = href.indexOf('?');
        int end = href.length();
        if (hash >= 0) end = Math.min(end, hash);
        if (query >= 0) end = Math.min(end, query);
        return href.substring(0, end);
    }

    private static String fragmentOf(String href) {
        if (href == null) return "";
        int hash = href.indexOf('#');
        if (hash < 0 || hash + 1 >= href.length()) return "";
        String fragment = href.substring(hash + 1);
        int query = fragment.indexOf('?');
        if (query >= 0) fragment = fragment.substring(0, query);
        return fragment;
    }

    private static String withFragment(String path, String fragment) {
        return clean(fragment).isEmpty() ? path : path + "#" + clean(fragment);
    }

    private static String mappedTarget(String target, Map<String, String> smilTargets) {
        String mapped = smilTargets.get(target);
        return mapped == null ? target : mapped;
    }

    private static void putAudio(
            Map<String, ReadingDaisyBook.AudioTrack> tracks,
            String path,
            String title
    ) {
        if (!tracks.containsKey(path)) tracks.put(path, new ReadingDaisyBook.AudioTrack(path, title));
    }

    private static void putPage(
            Map<String, ReadingStructuredDocument.PageReference> pages,
            String label,
            String href
    ) {
        String key = clean(href).isEmpty() ? clean(label) : clean(href);
        if (!key.isEmpty() && !pages.containsKey(key)) {
            pages.put(key, new ReadingStructuredDocument.PageReference(label, href));
        }
    }

    private static String findEntry(List<String> entries, String... names) {
        for (String entry : entries) {
            String lower = entry.toLowerCase(Locale.ROOT);
            for (String name : names) {
                if (lower.equals(name.toLowerCase(Locale.ROOT))
                        || lower.endsWith("/" + name.toLowerCase(Locale.ROOT))) return entry;
            }
        }
        return null;
    }

    private static String findByExtension(List<String> entries, String extension) {
        for (String entry : entries) {
            if (entry.toLowerCase(Locale.ROOT).endsWith(extension)) return entry;
        }
        return null;
    }

    private static String fileTitle(String path) {
        String file = stripFragmentAndQuery(path);
        int slash = file.lastIndexOf('/');
        if (slash >= 0) file = file.substring(slash + 1);
        int dot = file.lastIndexOf('.');
        if (dot > 0) file = file.substring(0, dot);
        return file;
    }

    private static long parseClockMs(String raw) {
        String value = clean(raw).toLowerCase(Locale.ROOT);
        if (value.isEmpty()) return 0L;
        if (value.startsWith("npt=")) value = value.substring(4).trim();
        try {
            if (value.endsWith("ms")) {
                return Math.max(0L, Math.round(Double.parseDouble(value.substring(0, value.length() - 2))));
            }
            if (value.endsWith("s")) {
                return Math.max(0L, Math.round(Double.parseDouble(value.substring(0, value.length() - 1)) * 1000.0));
            }
            String[] parts = value.split(":");
            if (parts.length == 3) {
                double seconds = Double.parseDouble(parts[2]);
                double total = Double.parseDouble(parts[0]) * 3600.0
                        + Double.parseDouble(parts[1]) * 60.0 + seconds;
                return Math.max(0L, Math.round(total * 1000.0));
            }
            if (parts.length == 2) {
                double total = Double.parseDouble(parts[0]) * 60.0 + Double.parseDouble(parts[1]);
                return Math.max(0L, Math.round(total * 1000.0));
            }
            return Math.max(0L, Math.round(Double.parseDouble(value) * 1000.0));
        } catch (NumberFormatException ignored) {
            return 0L;
        }
    }

    private static String readableText(Node node) {
        StringBuilder builder = new StringBuilder();
        appendReadableText(node, builder);
        return builder.toString().trim().replaceAll("\\s+", " ");
    }

    private static void appendReadableText(Node node, StringBuilder output) {
        if (node == null) return;
        if (node.getNodeType() == Node.TEXT_NODE || node.getNodeType() == Node.CDATA_SECTION_NODE) {
            String value = node.getNodeValue();
            if (value != null && !value.trim().isEmpty()) output.append(' ').append(value.trim());
            return;
        }
        if (node.getNodeType() != Node.ELEMENT_NODE) return;
        Element element = (Element) node;
        String name = localName(element).toLowerCase(Locale.ROOT);
        if ("script".equals(name) || "style".equals(name) || "object".equals(name)
                || "embed".equals(name) || "iframe".equals(name)) return;
        if ("img".equals(name)) {
            String alt = clean(element.getAttribute("alt"));
            if (!alt.isEmpty()) output.append(' ').append(alt);
            return;
        }
        NodeList children = element.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) appendReadableText(children.item(i), output);
    }

    private static String normalizedText(Node node) {
        return ReadingXml.normalizedText(node);
    }

    private static String firstText(Element root, String name) {
        Element element = firstElement(root, name);
        return element == null ? "" : normalizedText(element);
    }

    private static Element firstElement(Element root, String name) {
        if (root == null) return null;
        for (Element element : descendants(root, name)) return element;
        return null;
    }

    private static List<Element> childElements(Element parent, String name) {
        List<Element> output = new ArrayList<>();
        if (parent == null) return output;
        NodeList children = parent.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            Node node = children.item(i);
            if (node.getNodeType() == Node.ELEMENT_NODE && name.equalsIgnoreCase(localName(node))) {
                output.add((Element) node);
            }
        }
        return output;
    }

    private static List<Element> descendants(Element root, String name) {
        List<Element> output = new ArrayList<>();
        if (root == null) return output;
        collectDescendants(root, name, output);
        return output;
    }

    private static void collectDescendants(Element root, String name, List<Element> output) {
        if (name.equalsIgnoreCase(localName(root))) output.add(root);
        NodeList children = root.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            Node node = children.item(i);
            if (node.getNodeType() == Node.ELEMENT_NODE) collectDescendants((Element) node, name, output);
        }
    }

    private static List<Element> allElements(Element root) {
        List<Element> output = new ArrayList<>();
        collectAllElements(root, output);
        return output;
    }

    private static void collectAllElements(Element root, List<Element> output) {
        if (root == null) return;
        output.add(root);
        NodeList children = root.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            Node node = children.item(i);
            if (node.getNodeType() == Node.ELEMENT_NODE) collectAllElements((Element) node, output);
        }
    }

    private static String localName(Node node) {
        if (node == null) return "";
        String local = node.getLocalName();
        if (local != null && !local.isEmpty()) return local;
        String name = node.getNodeName();
        int colon = name == null ? -1 : name.indexOf(':');
        return colon >= 0 ? name.substring(colon + 1) : (name == null ? "" : name);
    }

    private static boolean containsPageClass(String classes) {
        for (String token : classes.split("\\s+")) {
            if ("page-normal".equals(token) || "page-front".equals(token) || "page-special".equals(token)) return true;
        }
        return false;
    }

    private static String firstNonEmpty(String first, String second) {
        String value = clean(first);
        return value.isEmpty() ? clean(second) : value;
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private static String join(List<String> values, String separator) {
        StringBuilder result = new StringBuilder();
        for (String value : values) {
            if (result.length() > 0) result.append(separator);
            result.append(value);
        }
        return result.toString();
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

        ManifestItem(String id, String href, String mediaType) {
            this.id = id;
            this.href = href;
            this.mediaType = mediaType;
        }
    }

    private static final class DaisyContent {
        final List<ReadingStructuredDocument.Block> blocks = new ArrayList<>();
        final LinkedHashMap<String, ReadingStructuredDocument.PageReference> pages = new LinkedHashMap<>();
        final List<ReadingStructuredDocument.MediaSyncReference> sync = new ArrayList<>();
        final LinkedHashMap<String, ReadingDaisyBook.AudioTrack> audio = new LinkedHashMap<>();
        final Set<String> textResources = new LinkedHashSet<>();
    }

    public static final class DaisyException extends IOException {
        private final String code;

        DaisyException(String code, String message) {
            super(message);
            this.code = code;
        }

        DaisyException(String code, String message, Throwable cause) {
            super(message, cause);
            this.code = code;
        }

        public String getCode() { return code; }
    }
}
