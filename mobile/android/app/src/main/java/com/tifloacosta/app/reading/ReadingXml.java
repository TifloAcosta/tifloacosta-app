package com.tifloacosta.app.reading;

import org.w3c.dom.Document;
import org.w3c.dom.Node;
import org.xml.sax.SAXException;

import java.io.IOException;
import java.io.InputStream;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;

public final class ReadingXml {
    private ReadingXml() {}

    public static Document parse(InputStream input) throws IOException {
        if (input == null) throw new IllegalArgumentException("input is required");
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
            DocumentBuilder builder = factory.newDocumentBuilder();
            return builder.parse(input);
        } catch (ParserConfigurationException | SAXException error) {
            throw new IOException("invalid-xml: unable to parse package XML safely", error);
        }
    }

    public static String normalizedText(Node node) {
        if (node == null) return "";
        String text = node.getTextContent();
        if (text == null) return "";
        return text.trim().replaceAll("\\s+", " ");
    }
}
