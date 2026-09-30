package com.tifloacosta.app.reading;

import android.content.Context;
import android.graphics.Bitmap;

import com.tom_roush.pdfbox.android.PDFBoxResourceLoader;
import com.tom_roush.pdfbox.pdmodel.PDDocument;
import com.tom_roush.pdfbox.pdmodel.PDPage;
import com.tom_roush.pdfbox.rendering.ImageType;
import com.tom_roush.pdfbox.rendering.PDFRenderer;

import java.io.File;
import java.io.IOException;

public final class ReadingPdfPageRenderer {
    public static final int MIN_DIMENSION = 256;
    public static final int MAX_DIMENSION = 2400;

    public interface Backend {
        Document open(String relativePath, String password) throws IOException;
    }

    public interface Document extends AutoCloseable {
        int getPageCount();
        PageSize getPageSize(int pageIndex) throws IOException;
        Object render(int pageIndex, int width, int height) throws IOException;
        @Override
        void close() throws IOException;
    }

    public static final class PageSize {
        private final int width;
        private final int height;

        public PageSize(int width, int height) {
            if (width <= 0 || height <= 0) throw new IllegalArgumentException("Page dimensions must be positive");
            this.width = width;
            this.height = height;
        }

        public int getWidth() { return width; }
        public int getHeight() { return height; }
    }

    public static final class RenderedPage {
        private final int pageIndex;
        private final int width;
        private final int height;
        private final Object image;

        public RenderedPage(int pageIndex, int width, int height, Object image) {
            this.pageIndex = pageIndex;
            this.width = width;
            this.height = height;
            this.image = image;
        }

        public int getPageIndex() { return pageIndex; }
        public int getWidth() { return width; }
        public int getHeight() { return height; }
        public Object getImage() { return image; }
    }

    private final Backend backend;

    public ReadingPdfPageRenderer(Backend backend) {
        if (backend == null) throw new IllegalArgumentException("PDF renderer backend is required");
        this.backend = backend;
    }

    public ReadingPdfPageRenderer(Context context) {
        this(new AndroidBackend(context));
    }

    public RenderedPage renderPage(String relativePath, String password, int pageIndex, int maxDimension)
            throws IOException {
        if (relativePath == null || relativePath.trim().isEmpty()) {
            throw new IllegalArgumentException("relativePath is required");
        }
        int boundedMaximum = Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, maxDimension));
        try (Document document = backend.open(relativePath, password == null ? "" : password)) {
            int pageCount = document.getPageCount();
            if (pageIndex < 0 || pageIndex >= pageCount) {
                throw new IllegalArgumentException("pageIndex is outside the PDF page range");
            }
            PageSize source = document.getPageSize(pageIndex);
            int sourceMax = Math.max(source.getWidth(), source.getHeight());
            double scale = sourceMax > boundedMaximum ? (double) boundedMaximum / sourceMax : 1.0d;
            int width = Math.max(1, (int) Math.round(source.getWidth() * scale));
            int height = Math.max(1, (int) Math.round(source.getHeight() * scale));
            Object image = document.render(pageIndex, width, height);
            return new RenderedPage(pageIndex, width, height, image);
        }
    }

    private static final class AndroidBackend implements Backend {
        private final File root;

        AndroidBackend(Context context) {
            if (context == null) throw new IllegalArgumentException("Android context is required");
            Context application = context.getApplicationContext();
            PDFBoxResourceLoader.init(application);
            root = new File(application.getFilesDir(), "reading-library");
        }

        @Override
        public Document open(String relativePath, String password) throws IOException {
            File source = safeRelativeFile(relativePath);
            PDDocument document = PDDocument.load(source, password == null ? "" : password);
            return new PdfBoxDocument(document);
        }

        private File safeRelativeFile(String relativePath) throws IOException {
            File canonicalRoot = root.getCanonicalFile();
            File candidate = new File(canonicalRoot, relativePath).getCanonicalFile();
            String rootPath = canonicalRoot.getPath() + File.separator;
            if (!candidate.getPath().startsWith(rootPath)) {
                throw new IOException("Invalid reading-library relative path");
            }
            if (!candidate.isFile()) throw new IOException("Reading PDF does not exist");
            return candidate;
        }
    }

    private static final class PdfBoxDocument implements Document {
        private final PDDocument document;
        private final PDFRenderer renderer;

        PdfBoxDocument(PDDocument document) {
            this.document = document;
            this.renderer = new PDFRenderer(document);
        }

        @Override
        public int getPageCount() {
            return document.getNumberOfPages();
        }

        @Override
        public PageSize getPageSize(int pageIndex) {
            PDPage page = document.getPage(pageIndex);
            float width = page.getCropBox().getWidth();
            float height = page.getCropBox().getHeight();
            return new PageSize(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
        }

        @Override
        public Object render(int pageIndex, int width, int height) throws IOException {
            PageSize source = getPageSize(pageIndex);
            float scale = Math.min(
                    (float) width / (float) source.getWidth(),
                    (float) height / (float) source.getHeight()
            );
            Bitmap bitmap = renderer.renderImage(pageIndex, Math.max(0.01f, scale), ImageType.RGB);
            return bitmap;
        }

        @Override
        public void close() throws IOException {
            document.close();
        }
    }
}
