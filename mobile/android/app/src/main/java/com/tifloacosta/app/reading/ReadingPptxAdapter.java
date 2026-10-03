package com.tifloacosta.app.reading;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class ReadingPptxAdapter {
    private static final String PRESENTATION = "ppt/presentation.xml";

    public ReadingStructuredDocument read(InputStream input) throws IOException {
        try {
            ReadingOfficeXmlPackage pkg = ReadingOfficeXmlPackage.read(input);
            if (pkg.isMacroEnabled()) throw new PptxException("macro-enabled-pptx");
            if (!pkg.has(PRESENTATION)) throw new PptxException("invalid-pptx");

            Metadata metadata = metadata(pkg);
            boolean english = Locale.getDefault().getLanguage().toLowerCase(Locale.ROOT).startsWith("en");
            Map<String, Relationship> presentationRels = relationships(pkg, PRESENTATION);
            Document presentation = pkg.xml(PRESENTATION);
            List<String> slideParts = new ArrayList<>();
            NodeList slideIds = presentation.getElementsByTagNameNS("*", "sldId");
            for (int index = 0; index < slideIds.getLength(); index++) {
                Element slideId = (Element) slideIds.item(index);
                Relationship relationship = presentationRels.get(attributeByLocalName(slideId, "id"));
                if (relationship == null || relationship.external) continue;
                String target = ReadingOfficeXmlPackage.resolve(PRESENTATION, relationship.target);
                if (pkg.has(target)) slideParts.add(target);
            }
            if (slideParts.isEmpty()) {
                for (String entry : pkg.entries()) {
                    if (entry.matches("ppt/slides/slide\\d+\\.xml") && pkg.has(entry)) slideParts.add(entry);
                }
                Collections.sort(slideParts, (a,b) -> Integer.compare(partNumber(a), partNumber(b)));
            }
            if (slideParts.isEmpty()) throw new PptxException("invalid-pptx");

            List<ReadingStructuredDocument.Block> blocks = new ArrayList<>();
            List<ReadingStructuredDocument.NavigationItem> navigation = new ArrayList<>();
            int serial = 0;

            for (int slideIndex = 0; slideIndex < slideParts.size(); slideIndex++) {
                int number = slideIndex + 1;
                String part = slideParts.get(slideIndex);
                Document slide = pkg.xml(part);
                String title = slideTitle(slide);
                String anchor = "pptx-slide-" + number;
                String heading = english
                        ? "Slide " + number + " of " + slideParts.size() + (title.isEmpty() ? "" : ": " + title)
                        : "Diapositiva " + number + " de " + slideParts.size() + (title.isEmpty() ? "" : ": " + title);

                blocks.add(new ReadingStructuredDocument.Block(anchor, "heading", heading, 2, "#" + anchor));
                navigation.add(new ReadingStructuredDocument.NavigationItem(
                        title.isEmpty() ? heading : title,
                        "#" + anchor,
                        1
                ));

                NodeList shapes = slide.getElementsByTagNameNS("*", "sp");
                for (int shapeIndex = 0; shapeIndex < shapes.getLength(); shapeIndex++) {
                    Element shape = (Element) shapes.item(shapeIndex);
                    String text = shapeText(shape);
                    if (text.isEmpty()) continue;
                    String placeholder = placeholderType(shape);
                    if (("title".equals(placeholder) || "ctrTitle".equals(placeholder)) && text.equals(title)) continue;
                    for (String paragraph : splitParagraphs(text)) {
                        blocks.add(new ReadingStructuredDocument.Block(
                                "pptx-" + number + "-" + (++serial),
                                "paragraph",
                                paragraph,
                                0,
                                ""
                        ));
                    }
                }

                NodeList tables = slide.getElementsByTagNameNS("*", "tbl");
                for (int tableIndex = 0; tableIndex < tables.getLength(); tableIndex++) {
                    Element table = (Element) tables.item(tableIndex);
                    List<Element> rows = directDescendants(table, "tr");
                    int columns = 0;
                    for (Element row : rows) columns = Math.max(columns, directDescendants(row, "tc").size());
                    String tableLabel = english
                            ? "Table with " + rows.size() + " rows and " + columns + " columns"
                            : "Tabla de " + rows.size() + " filas y " + columns + " columnas";
                    blocks.add(new ReadingStructuredDocument.Block(
                            "pptx-" + number + "-" + (++serial), "paragraph", tableLabel, 0, ""
                    ));
                    for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
                        List<Element> cells = directDescendants(rows.get(rowIndex), "tc");
                        List<String> values = new ArrayList<>();
                        for (int colIndex = 0; colIndex < cells.size(); colIndex++) {
                            String value = visibleText(cells.get(colIndex));
                            if (value.isEmpty()) continue;
                            values.add((english ? "Column " : "Columna ") + (colIndex + 1) + ": " + value);
                        }
                        if (!values.isEmpty()) {
                            blocks.add(new ReadingStructuredDocument.Block(
                                    "pptx-" + number + "-" + (++serial),
                                    "table-cell",
                                    (english ? "Row " : "Fila ") + (rowIndex + 1) + ". " + String.join(". ", values),
                                    0,
                                    ""
                            ));
                        }
                    }
                }

                NodeList pictures = slide.getElementsByTagNameNS("*", "pic");
                for (int pictureIndex = 0; pictureIndex < pictures.getLength(); pictureIndex++) {
                    Element picture = (Element) pictures.item(pictureIndex);
                    Element props = firstElement(picture, "cNvPr");
                    String description = props == null ? "" : clean(props.getAttribute("descr"));
                    if (description.isEmpty() && props != null) description = clean(props.getAttribute("title"));
                    if (!description.isEmpty()) {
                        blocks.add(new ReadingStructuredDocument.Block(
                                "pptx-" + number + "-" + (++serial),
                                "paragraph",
                                (english ? "Image description: " : "Descripción de imagen: ") + description,
                                0,
                                ""
                        ));
                    }
                }

                Map<String, Relationship> slideRels = relationships(pkg, part);
                for (Relationship relationship : slideRels.values()) {
                    if (relationship.external || !relationship.type.endsWith("/notesSlide")) continue;
                    String notesPart = ReadingOfficeXmlPackage.resolve(part, relationship.target);
                    if (!pkg.has(notesPart)) continue;
                    List<String> notes = notes(pkg.xml(notesPart));
                    if (notes.isEmpty()) continue;
                    String noteAnchor = "pptx-" + number + "-notes";
                    blocks.add(new ReadingStructuredDocument.Block(
                            noteAnchor,
                            "heading",
                            english ? "Speaker notes" : "Notas del presentador",
                            3,
                            "#" + noteAnchor
                    ));
                    for (String note : notes) {
                        blocks.add(new ReadingStructuredDocument.Block(
                                "pptx-" + number + "-" + (++serial),
                                "paragraph",
                                note,
                                0,
                                ""
                        ));
                    }
                }
            }

            if (blocks.isEmpty()) throw new PptxException("empty-pptx");
            return new ReadingStructuredDocument(
                    metadata.title,
                    metadata.author,
                    metadata.language,
                    blocks,
                    navigation,
                    Collections.emptyList(),
                    Collections.emptyList()
            );
        } catch (PptxException error) {
            throw error;
        } catch (ReadingOfficeXmlPackage.OfficePackageException error) {
            throw new PptxException(error.getCode(), error);
        } catch (IOException error) {
            throw new PptxException("invalid-pptx", error);
        } catch (RuntimeException error) {
            throw new PptxException("invalid-pptx", error);
        }
    }

    private static Metadata metadata(ReadingOfficeXmlPackage pkg) throws IOException {
        Metadata metadata = new Metadata();
        if (!pkg.has("docProps/core.xml")) return metadata;
        Document core = pkg.xml("docProps/core.xml");
        metadata.title = firstText(core, "title");
        metadata.author = firstText(core, "creator");
        metadata.language = firstText(core, "language");
        return metadata;
    }

    private static Map<String, Relationship> relationships(ReadingOfficeXmlPackage pkg, String part) throws IOException {
        String relPath = ReadingOfficeXmlPackage.relationshipsPath(part);
        if (!pkg.has(relPath)) return Collections.emptyMap();
        Document doc = pkg.xml(relPath);
        Map<String, Relationship> result = new LinkedHashMap<>();
        NodeList nodes = doc.getElementsByTagNameNS("*", "Relationship");
        for (int index = 0; index < nodes.getLength(); index++) {
            Element element = (Element) nodes.item(index);
            String id = clean(element.getAttribute("Id"));
            if (id.isEmpty()) continue;
            result.put(id, new Relationship(
                    clean(element.getAttribute("Type")),
                    clean(element.getAttribute("Target")),
                    "external".equalsIgnoreCase(clean(element.getAttribute("TargetMode")))
            ));
        }
        return result;
    }

    private static String slideTitle(Document slide) {
        NodeList shapes = slide.getElementsByTagNameNS("*", "sp");
        for (int index = 0; index < shapes.getLength(); index++) {
            Element shape = (Element) shapes.item(index);
            String type = placeholderType(shape);
            if (!"title".equals(type) && !"ctrTitle".equals(type)) continue;
            String text = shapeText(shape);
            if (!text.isEmpty()) return text;
        }
        return "";
    }

    private static List<String> notes(Document notes) {
        List<String> result = new ArrayList<>();
        NodeList shapes = notes.getElementsByTagNameNS("*", "sp");
        for (int index = 0; index < shapes.getLength(); index++) {
            Element shape = (Element) shapes.item(index);
            String type = placeholderType(shape);
            if ("sldImg".equals(type) || "dt".equals(type) || "ftr".equals(type)
                    || "hdr".equals(type) || "sldNum".equals(type)) continue;
            String text = shapeText(shape);
            result.addAll(splitParagraphs(text));
        }
        return result;
    }

    private static String placeholderType(Element shape) {
        Element ph = firstElement(shape, "ph");
        return ph == null ? "" : attributeByLocalName(ph, "type");
    }

    private static String shapeText(Element shape) {
        List<String> paragraphs = new ArrayList<>();
        NodeList nodes = shape.getElementsByTagNameNS("*", "p");
        for (int index = 0; index < nodes.getLength(); index++) {
            String text = visibleText(nodes.item(index));
            if (!text.isEmpty()) paragraphs.add(text);
        }
        return String.join("\n", paragraphs);
    }

    private static String visibleText(Node root) {
        StringBuilder output = new StringBuilder();
        NodeList texts = ((Element) root).getElementsByTagNameNS("*", "t");
        for (int index = 0; index < texts.getLength(); index++) {
            String value = clean(texts.item(index).getTextContent());
            if (value.isEmpty()) continue;
            if (output.length() > 0) output.append(' ');
            output.append(value);
        }
        return clean(output.toString());
    }

    private static List<String> splitParagraphs(String value) {
        List<String> result = new ArrayList<>();
        for (String item : String.valueOf(value == null ? "" : value).split("\\n+")) {
            String text = clean(item);
            if (!text.isEmpty()) result.add(text);
        }
        return result;
    }

    private static List<Element> directDescendants(Element root, String localName) {
        List<Element> result = new ArrayList<>();
        NodeList all = root.getElementsByTagNameNS("*", localName);
        for (int index = 0; index < all.getLength(); index++) result.add((Element) all.item(index));
        return result;
    }

    private static Element firstElement(Node root, String localName) {
        if (!(root instanceof Element)) return null;
        NodeList all = ((Element) root).getElementsByTagNameNS("*", localName);
        return all.getLength() == 0 ? null : (Element) all.item(0);
    }

    private static String firstText(Document doc, String localName) {
        NodeList all = doc.getElementsByTagNameNS("*", localName);
        return all.getLength() == 0 ? "" : clean(all.item(0).getTextContent());
    }

    private static String attributeByLocalName(Element element, String localName) {
        if (element == null) return "";
        for (int index = 0; index < element.getAttributes().getLength(); index++) {
            Node item = element.getAttributes().item(index);
            if (localName.equals(item.getLocalName()) || localName.equals(item.getNodeName())) {
                return clean(item.getNodeValue());
            }
        }
        return "";
    }

    private static int partNumber(String path) {
        String digits = path.replaceAll("^.*?(\\d+)\\.xml$", "$1");
        try { return Integer.parseInt(digits); }
        catch (NumberFormatException error) { return Integer.MAX_VALUE; }
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
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
            this.type = type;
            this.target = target;
            this.external = external;
        }
    }

    public static final class PptxException extends IOException {
        private final String code;

        PptxException(String code) {
            super(code);
            this.code = code;
        }

        PptxException(String code, Throwable cause) {
            super(code, cause);
            this.code = code;
        }

        public String getCode() {
            return code;
        }
    }
}
