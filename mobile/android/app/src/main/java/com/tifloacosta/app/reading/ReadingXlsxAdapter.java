package com.tifloacosta.app.reading;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import java.io.IOException;
import java.io.InputStream;
import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.HashSet;

public final class ReadingXlsxAdapter {
    private static final String WORKBOOK = "xl/workbook.xml";
    private static final Set<Integer> BUILT_IN_DATE_FORMATS = new HashSet<>();

    static {
        Collections.addAll(BUILT_IN_DATE_FORMATS, 14,15,16,17,18,19,20,21,22,45,46,47);
    }

    public ReadingStructuredDocument read(InputStream input) throws IOException {
        try {
            ReadingOfficeXmlPackage pkg = ReadingOfficeXmlPackage.read(input);
            if (pkg.isMacroEnabled()) throw new XlsxException("macro-enabled-xlsx");
            if (!pkg.has(WORKBOOK)) throw new XlsxException("invalid-xlsx");

            boolean english = Locale.getDefault().getLanguage().toLowerCase(Locale.ROOT).startsWith("en");
            Metadata metadata = metadata(pkg);
            Map<String, Relationship> rels = relationships(pkg, WORKBOOK);
            List<String> sharedStrings = sharedStrings(pkg);
            Styles styles = styles(pkg);
            Document workbook = pkg.xml(WORKBOOK);

            List<ReadingStructuredDocument.Block> blocks = new ArrayList<>();
            List<ReadingStructuredDocument.NavigationItem> navigation = new ArrayList<>();
            int serial = 0;

            NodeList sheets = workbook.getElementsByTagNameNS("*", "sheet");
            for (int sheetIndex = 0; sheetIndex < sheets.getLength(); sheetIndex++) {
                Element sheet = (Element) sheets.item(sheetIndex);
                String name = clean(sheet.getAttribute("name"));
                if (name.isEmpty()) name = (english ? "Sheet " : "Hoja ") + (sheetIndex + 1);
                Relationship relationship = rels.get(attributeByLocalName(sheet, "id"));
                if (relationship == null || relationship.external) continue;
                String part = ReadingOfficeXmlPackage.resolve(WORKBOOK, relationship.target);
                if (!pkg.has(part)) continue;

                String anchor = "xlsx-sheet-" + (sheetIndex + 1);
                blocks.add(new ReadingStructuredDocument.Block(
                        anchor,
                        "heading",
                        (english ? "Sheet: " : "Hoja: ") + name,
                        2,
                        "#" + anchor
                ));
                navigation.add(new ReadingStructuredDocument.NavigationItem(name, "#" + anchor, 1));

                List<Row> rows = rows(pkg.xml(part), sharedStrings, styles);
                if (rows.isEmpty()) {
                    blocks.add(new ReadingStructuredDocument.Block(
                            "xlsx-" + (++serial),
                            "paragraph",
                            english ? "Blank sheet" : "Hoja vacía",
                            0,
                            ""
                    ));
                    continue;
                }

                boolean headersPresent = hasHeaders(rows);
                Map<Integer, String> headers = new HashMap<>();
                if (headersPresent) {
                    for (Cell cell : rows.get(0).cells) {
                        if (!cell.value.isEmpty()) headers.put(cell.column, cell.value);
                    }
                    List<String> names = new ArrayList<>();
                    for (Cell cell : rows.get(0).cells) if (!cell.value.isEmpty()) names.add(cell.value);
                    blocks.add(new ReadingStructuredDocument.Block(
                            "xlsx-" + (++serial),
                            "paragraph",
                            (english ? "Headers: " : "Encabezados: ") + String.join(", ", names),
                            0,
                            ""
                    ));
                }

                int start = headersPresent ? 1 : 0;
                for (int rowIndex = start; rowIndex < rows.size(); rowIndex++) {
                    Row row = rows.get(rowIndex);
                    List<String> parts = new ArrayList<>();
                    for (Cell cell : row.cells) {
                        String label = headersPresent && headers.containsKey(cell.column)
                                ? headers.get(cell.column)
                                : (english ? "Column " : "Columna ") + columnName(cell.column);
                        if (!cell.value.isEmpty()) {
                            parts.add(label + ": " + cell.value);
                        } else if (!cell.formula.isEmpty()) {
                            parts.add(label + ": " + (english ? "Formula " : "Fórmula ") + cell.formula);
                        }
                    }
                    if (parts.isEmpty()) continue;
                    blocks.add(new ReadingStructuredDocument.Block(
                            "xlsx-" + (++serial),
                            "table-cell",
                            (english ? "Row " : "Fila ") + row.number + ". " + String.join(". ", parts),
                            0,
                            ""
                    ));
                }
            }

            if (blocks.isEmpty()) throw new XlsxException("empty-xlsx");
            return new ReadingStructuredDocument(
                    metadata.title,
                    metadata.author,
                    metadata.language,
                    blocks,
                    navigation,
                    Collections.emptyList(),
                    Collections.emptyList()
            );
        } catch (XlsxException error) {
            throw error;
        } catch (ReadingOfficeXmlPackage.OfficePackageException error) {
            throw new XlsxException(error.getCode(), error);
        } catch (IOException error) {
            throw new XlsxException("invalid-xlsx", error);
        } catch (RuntimeException error) {
            throw new XlsxException("invalid-xlsx", error);
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

    private static List<String> sharedStrings(ReadingOfficeXmlPackage pkg) throws IOException {
        if (!pkg.has("xl/sharedStrings.xml")) return Collections.emptyList();
        Document doc = pkg.xml("xl/sharedStrings.xml");
        List<String> result = new ArrayList<>();
        NodeList items = doc.getElementsByTagNameNS("*", "si");
        for (int index = 0; index < items.getLength(); index++) {
            result.add(textRuns((Element) items.item(index)));
        }
        return result;
    }

    private static Styles styles(ReadingOfficeXmlPackage pkg) throws IOException {
        Styles result = new Styles();
        if (!pkg.has("xl/styles.xml")) return result;
        Document doc = pkg.xml("xl/styles.xml");
        Map<Integer, String> customFormats = new HashMap<>();
        NodeList numFmts = doc.getElementsByTagNameNS("*", "numFmt");
        for (int index = 0; index < numFmts.getLength(); index++) {
            Element item = (Element) numFmts.item(index);
            customFormats.put(parseInt(item.getAttribute("numFmtId"), 0), item.getAttribute("formatCode"));
        }
        Element cellXfs = firstElement(doc.getDocumentElement(), "cellXfs");
        if (cellXfs == null) return result;
        NodeList children = cellXfs.getChildNodes();
        int styleIndex = 0;
        for (int index = 0; index < children.getLength(); index++) {
            Node node = children.item(index);
            if (!(node instanceof Element) || !"xf".equals(node.getLocalName())) continue;
            Element xf = (Element) node;
            int numFmtId = parseInt(xf.getAttribute("numFmtId"), 0);
            String custom = customFormats.get(numFmtId);
            if (BUILT_IN_DATE_FORMATS.contains(numFmtId) || looksLikeDateFormat(custom)) {
                result.dateStyles.add(styleIndex);
            }
            styleIndex++;
        }
        return result;
    }

    private static boolean looksLikeDateFormat(String format) {
        if (format == null || format.isEmpty()) return false;
        String cleaned = format.replaceAll("\"[^\"]*\"", "").replace("\\", "");
        return cleaned.matches(".*[dmyhsDMYHS].*");
    }

    private static List<Row> rows(Document sheet, List<String> sharedStrings, Styles styles) {
        List<Row> result = new ArrayList<>();
        NodeList rowNodes = sheet.getElementsByTagNameNS("*", "row");
        for (int rowIndex = 0; rowIndex < rowNodes.getLength(); rowIndex++) {
            Element rowElement = (Element) rowNodes.item(rowIndex);
            int number = parseInt(rowElement.getAttribute("r"), rowIndex + 1);
            List<Cell> cells = new ArrayList<>();
            NodeList children = rowElement.getChildNodes();
            for (int childIndex = 0; childIndex < children.getLength(); childIndex++) {
                Node node = children.item(childIndex);
                if (!(node instanceof Element) || !"c".equals(node.getLocalName())) continue;
                Element cellElement = (Element) node;
                String ref = clean(cellElement.getAttribute("r"));
                int column = columnIndex(ref);
                String formula = firstText(cellElement, "f");
                String value = cellValue(cellElement, sharedStrings, styles);
                if (value.isEmpty() && formula.isEmpty()) continue;
                cells.add(new Cell(column, value, formula));
            }
            if (!cells.isEmpty()) result.add(new Row(number, cells));
        }
        return result;
    }

    private static String cellValue(Element cell, List<String> sharedStrings, Styles styles) {
        String type = clean(cell.getAttribute("t"));
        String raw = firstText(cell, "v");
        if ("inlineStr".equals(type)) return textRuns(cell);
        if ("s".equals(type)) {
            int index = parseInt(raw, -1);
            return index >= 0 && index < sharedStrings.size() ? sharedStrings.get(index) : "";
        }
        if ("b".equals(type)) return "1".equals(raw) ? "Sí" : "No";
        if ("str".equals(type)) return raw;
        int styleIndex = parseInt(cell.getAttribute("s"), -1);
        if (styles.dateStyles.contains(styleIndex) && !raw.isEmpty()) {
            String date = excelDate(raw);
            if (!date.isEmpty()) return date;
        }
        return raw;
    }

    private static String excelDate(String raw) {
        try {
            double serial = Double.parseDouble(raw);
            double adjusted = serial >= 60 ? serial - 1 : serial;
            long millis = Math.round(adjusted * 86400000d);
            java.util.Calendar calendar = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC"), Locale.ROOT);
            calendar.clear();
            calendar.set(1899, java.util.Calendar.DECEMBER, 31);
            calendar.setTimeInMillis(calendar.getTimeInMillis() + millis);
            int year = calendar.get(java.util.Calendar.YEAR);
            int month = calendar.get(java.util.Calendar.MONTH) + 1;
            int day = calendar.get(java.util.Calendar.DAY_OF_MONTH);
            int hour = calendar.get(java.util.Calendar.HOUR_OF_DAY);
            int minute = calendar.get(java.util.Calendar.MINUTE);
            if (Math.abs(serial - Math.rint(serial)) < 0.0000001d) {
                return String.format(Locale.ROOT, "%04d-%02d-%02d", year, month, day);
            }
            return String.format(Locale.ROOT, "%04d-%02d-%02d %02d:%02d", year, month, day, hour, minute);
        } catch (NumberFormatException error) {
            return "";
        }
    }

    private static boolean hasHeaders(List<Row> rows) {
        if (rows.size() < 2) return false;
        List<Cell> first = rows.get(0).cells;
        if (first.size() < 2) return false;
        int textual = 0;
        for (Cell cell : first) if (!isNumeric(cell.value)) textual++;
        int nextValues = 0;
        for (int index = 1; index < Math.min(rows.size(), 3); index++) nextValues += rows.get(index).cells.size();
        return ((double) textual / (double) first.size()) >= 0.6d && nextValues >= 2;
    }

    private static boolean isNumeric(String value) {
        if (value == null || value.trim().isEmpty()) return false;
        try {
            Double.parseDouble(value.trim().replace(',', '.'));
            return true;
        } catch (NumberFormatException error) {
            return false;
        }
    }

    private static int columnIndex(String ref) {
        if (ref == null || ref.isEmpty()) return 1;
        int value = 0;
        for (int index = 0; index < ref.length(); index++) {
            char ch = Character.toUpperCase(ref.charAt(index));
            if (ch < 'A' || ch > 'Z') break;
            value = value * 26 + (ch - 'A' + 1);
        }
        return value <= 0 ? 1 : value;
    }

    private static String columnName(int index) {
        int value = Math.max(1, index);
        StringBuilder out = new StringBuilder();
        while (value > 0) {
            value--;
            out.insert(0, (char) ('A' + (value % 26)));
            value /= 26;
        }
        return out.toString();
    }

    private static String textRuns(Element root) {
        NodeList texts = root.getElementsByTagNameNS("*", "t");
        StringBuilder out = new StringBuilder();
        for (int index = 0; index < texts.getLength(); index++) {
            String value = clean(texts.item(index).getTextContent());
            if (value.isEmpty()) continue;
            if (out.length() > 0) out.append(' ');
            out.append(value);
        }
        return clean(out.toString());
    }

    private static Element firstElement(Element root, String localName) {
        NodeList all = root.getElementsByTagNameNS("*", localName);
        return all.getLength() == 0 ? null : (Element) all.item(0);
    }

    private static String firstText(Document doc, String localName) {
        NodeList all = doc.getElementsByTagNameNS("*", localName);
        return all.getLength() == 0 ? "" : clean(all.item(0).getTextContent());
    }

    private static String firstText(Element element, String localName) {
        NodeList all = element.getElementsByTagNameNS("*", localName);
        return all.getLength() == 0 ? "" : clean(all.item(0).getTextContent());
    }

    private static String attributeByLocalName(Element element, String localName) {
        if (element == null) return "";
        for (int index = 0; index < element.getAttributes().getLength(); index++) {
            Node item = element.getAttributes().item(index);
            if (localName.equals(item.getLocalName()) || localName.equals(item.getNodeName())) return clean(item.getNodeValue());
        }
        return "";
    }

    private static int parseInt(String value, int fallback) {
        try { return Integer.parseInt(clean(value)); }
        catch (NumberFormatException error) { return fallback; }
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

    private static final class Styles {
        private final Set<Integer> dateStyles = new HashSet<>();
    }

    private static final class Row {
        private final int number;
        private final List<Cell> cells;

        private Row(int number, List<Cell> cells) {
            this.number = number;
            this.cells = cells;
        }
    }

    private static final class Cell {
        private final int column;
        private final String value;
        private final String formula;

        private Cell(int column, String value, String formula) {
            this.column = column;
            this.value = value;
            this.formula = formula;
        }
    }

    public static final class XlsxException extends IOException {
        private final String code;

        XlsxException(String code) {
            super(code);
            this.code = code;
        }

        XlsxException(String code, Throwable cause) {
            super(code, cause);
            this.code = code;
        }

        public String getCode() {
            return code;
        }
    }
}
