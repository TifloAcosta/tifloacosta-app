package com.tifloacosta.app.reading;

import org.w3c.dom.Document;
import org.w3c.dom.DocumentType;
import org.w3c.dom.Node;
import org.xml.sax.InputSource;
import org.xml.sax.SAXException;

import java.io.IOException;
import java.io.InputStream;
import java.io.StringReader;
import java.util.Locale;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;

public final class ReadingXml {
    private static final String ACCESS_EXTERNAL_DTD_PROPERTY =
            "http://javax.xml.XMLConstants/property/accessExternalDTD";
    private static final String ACCESS_EXTERNAL_SCHEMA_PROPERTY =
            "http://javax.xml.XMLConstants/property/accessExternalSchema";

    private ReadingXml() {}

    public static Document parse(InputStream input) throws IOException {
        if (input == null) throw new IllegalArgumentException("input is required");
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", false);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
            disableExternalAccess(factory);

            DocumentBuilder builder = factory.newDocumentBuilder();
            builder.setEntityResolver((publicId, systemId) -> new InputSource(new StringReader("")));
            Document document = builder.parse(input);
            rejectUnexpectedDoctype(document.getDoctype());
            return document;
        } catch (ParserConfigurationException | SAXException error) {
            throw new IOException("invalid-xml: unable to parse package XML safely", error);
        }
    }

    private static void disableExternalAccess(DocumentBuilderFactory factory) {
        try {
            factory.setAttribute(ACCESS_EXTERNAL_DTD_PROPERTY, "");
        } catch (IllegalArgumentException ignored) {
            // Older Android XML implementations may not expose this attribute.
            // The entity features and the empty EntityResolver still block access.
        }
        try {
            factory.setAttribute(ACCESS_EXTERNAL_SCHEMA_PROPERTY, "");
        } catch (IllegalArgumentException ignored) {
            // See ACCESS_EXTERNAL_DTD_PROPERTY above.
        }
    }

    private static void rejectUnexpectedDoctype(DocumentType doctype) throws IOException {
        if (doctype == null) return;
        String name = doctype.getName() == null ? "" : doctype.getName().trim().toLowerCase(Locale.ROOT);
        if ("html".equals(name)
                || "ncx".equals(name)
                || "smil".equals(name)
                || "package".equals(name)
                || "dtbook".equals(name)) return;
        throw new IOException("invalid-xml: doctype is not permitted for package metadata");
    }

    public static String normalizedText(Node node) {
        if (node == null) return "";
        String text = node.getTextContent();
        if (text == null) return "";
        return text.trim().replaceAll("\\s+", " ");
    }
}
