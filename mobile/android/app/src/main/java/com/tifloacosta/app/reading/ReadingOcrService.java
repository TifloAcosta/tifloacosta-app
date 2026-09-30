package com.tifloacosta.app.reading;

import android.graphics.Bitmap;

import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.common.MlKitException;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions;
import com.google.mlkit.vision.text.devanagari.DevanagariTextRecognizerOptions;
import com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions;
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutionException;

public final class ReadingOcrService {
    public static final String SCRIPT_LATIN = "latin";
    public static final String SCRIPT_CHINESE = "chinese";
    public static final String SCRIPT_DEVANAGARI = "devanagari";
    public static final String SCRIPT_JAPANESE = "japanese";
    public static final String SCRIPT_KOREAN = "korean";

    public static final String STATUS_OK = "ok";
    public static final String STATUS_EMPTY = "empty";
    public static final String STATUS_MODEL_UNAVAILABLE = "model-unavailable";
    public static final String STATUS_UNSUPPORTED_SCRIPT = "unsupported-script";
    public static final String STATUS_ERROR = "error";

    interface PageSource {
        PageImage render(String relativePath, String password, int pageIndex) throws Exception;
    }

    interface PageImage extends AutoCloseable {
        Object getImage();
        @Override
        void close();
    }

    interface RecognizerFactory {
        Recognizer create(String script) throws Exception;
    }

    interface Recognizer extends AutoCloseable {
        Recognition recognize(Object image) throws Exception;
        @Override
        void close();
    }

    public static final class ModelUnavailableException extends Exception {
        public ModelUnavailableException(String message) {
            super(message);
        }

        public ModelUnavailableException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    public static final class Recognition {
        private final String text;
        private final List<String> blocks;

        public Recognition(String text, List<String> blocks) {
            this.text = text == null ? "" : text;
            this.blocks = immutableCopy(blocks);
        }

        public String getText() {
            return text;
        }

        public List<String> getBlocks() {
            return blocks;
        }
    }

    public static final class Result {
        private final int pageIndex;
        private final String text;
        private final List<String> blocks;
        private final String status;

        Result(int pageIndex, String text, List<String> blocks, String status) {
            this.pageIndex = pageIndex;
            this.text = text == null ? "" : text;
            this.blocks = immutableCopy(blocks);
            this.status = status;
        }

        public int getPageIndex() {
            return pageIndex;
        }

        public String getText() {
            return text;
        }

        public List<String> getBlocks() {
            return blocks;
        }

        public String getStatus() {
            return status;
        }
    }

    private final PageSource pageSource;
    private final RecognizerFactory recognizerFactory;

    public ReadingOcrService(ReadingPdfPageRenderer pageRenderer) {
        if (pageRenderer == null) throw new IllegalArgumentException("pageRenderer is required");
        this.pageSource = new AndroidPageSource(pageRenderer);
        this.recognizerFactory = new MlKitRecognizerFactory();
    }

    ReadingOcrService(PageSource pageSource, RecognizerFactory recognizerFactory) {
        if (pageSource == null) throw new IllegalArgumentException("pageSource is required");
        if (recognizerFactory == null) throw new IllegalArgumentException("recognizerFactory is required");
        this.pageSource = pageSource;
        this.recognizerFactory = recognizerFactory;
    }

    public Result recognizePdfPage(String relativePath, String password, int pageIndex, String script) {
        String normalizedScript = normalizeScript(script);
        if (!isSupportedScript(normalizedScript)) {
            return failure(pageIndex, STATUS_UNSUPPORTED_SCRIPT);
        }

        PageImage page = null;
        Recognizer recognizer = null;
        try {
            page = pageSource.render(relativePath, password == null ? "" : password, pageIndex);
            recognizer = recognizerFactory.create(normalizedScript);
            Recognition recognition = recognizer.recognize(page.getImage());
            if (recognition == null) return failure(pageIndex, STATUS_ERROR);

            String text = recognition.getText().trim();
            if (text.isEmpty()) {
                return new Result(pageIndex, "", Collections.emptyList(), STATUS_EMPTY);
            }
            return new Result(pageIndex, text, cleanBlocks(recognition.getBlocks()), STATUS_OK);
        } catch (ModelUnavailableException unavailable) {
            return failure(pageIndex, STATUS_MODEL_UNAVAILABLE);
        } catch (Exception error) {
            return failure(pageIndex, STATUS_ERROR);
        } finally {
            if (recognizer != null) {
                try {
                    recognizer.close();
                } catch (RuntimeException ignored) {
                    // Recognition result has already been determined; cleanup is best-effort.
                }
            }
            if (page != null) {
                try {
                    page.close();
                } catch (RuntimeException ignored) {
                    // Page image is private temporary memory and must not change the result status.
                }
            }
        }
    }

    private static Result failure(int pageIndex, String status) {
        return new Result(pageIndex, "", Collections.emptyList(), status);
    }

    private static String normalizeScript(String script) {
        if (script == null || script.trim().isEmpty()) return SCRIPT_LATIN;
        return script.trim().toLowerCase(Locale.ROOT);
    }

    private static boolean isSupportedScript(String script) {
        return SCRIPT_LATIN.equals(script)
                || SCRIPT_CHINESE.equals(script)
                || SCRIPT_DEVANAGARI.equals(script)
                || SCRIPT_JAPANESE.equals(script)
                || SCRIPT_KOREAN.equals(script);
    }

    private static List<String> cleanBlocks(List<String> blocks) {
        if (blocks == null || blocks.isEmpty()) return Collections.emptyList();
        List<String> cleaned = new ArrayList<>();
        for (String block : blocks) {
            if (block == null) continue;
            String value = block.trim();
            if (!value.isEmpty()) cleaned.add(value);
        }
        return cleaned;
    }

    private static <T> List<T> immutableCopy(List<T> items) {
        if (items == null || items.isEmpty()) return Collections.emptyList();
        return Collections.unmodifiableList(new ArrayList<>(items));
    }

    private static final class AndroidPageSource implements PageSource {
        private final ReadingPdfPageRenderer renderer;

        AndroidPageSource(ReadingPdfPageRenderer renderer) {
            this.renderer = renderer;
        }

        @Override
        public PageImage render(String relativePath, String password, int pageIndex) throws IOException {
            ReadingPdfPageRenderer.RenderedPage rendered = renderer.renderPage(
                    relativePath,
                    password,
                    pageIndex,
                    ReadingPdfPageRenderer.MAX_DIMENSION
            );
            Object image = rendered.getImage();
            if (!(image instanceof Bitmap)) {
                throw new IOException("Rendered OCR page is not an Android bitmap");
            }
            Bitmap bitmap = (Bitmap) image;
            return new PageImage() {
                @Override
                public Object getImage() {
                    return bitmap;
                }

                @Override
                public void close() {
                    if (!bitmap.isRecycled()) bitmap.recycle();
                }
            };
        }
    }

    private static final class MlKitRecognizerFactory implements RecognizerFactory {
        @Override
        public Recognizer create(String script) {
            TextRecognizer recognizer;
            switch (script) {
                case SCRIPT_CHINESE:
                    recognizer = TextRecognition.getClient(new ChineseTextRecognizerOptions.Builder().build());
                    break;
                case SCRIPT_DEVANAGARI:
                    recognizer = TextRecognition.getClient(new DevanagariTextRecognizerOptions.Builder().build());
                    break;
                case SCRIPT_JAPANESE:
                    recognizer = TextRecognition.getClient(new JapaneseTextRecognizerOptions.Builder().build());
                    break;
                case SCRIPT_KOREAN:
                    recognizer = TextRecognition.getClient(new KoreanTextRecognizerOptions.Builder().build());
                    break;
                case SCRIPT_LATIN:
                default:
                    recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
                    break;
            }
            return new MlKitRecognizer(recognizer);
        }
    }

    private static final class MlKitRecognizer implements Recognizer {
        private final TextRecognizer recognizer;

        MlKitRecognizer(TextRecognizer recognizer) {
            this.recognizer = recognizer;
        }

        @Override
        public Recognition recognize(Object image) throws Exception {
            if (!(image instanceof Bitmap)) throw new IllegalArgumentException("OCR image must be a Bitmap");
            try {
                Text result = Tasks.await(recognizer.process(InputImage.fromBitmap((Bitmap) image, 0)));
                List<String> blocks = new ArrayList<>();
                for (Text.TextBlock block : result.getTextBlocks()) {
                    String value = block.getText();
                    if (value != null && !value.trim().isEmpty()) blocks.add(value.trim());
                }
                return new Recognition(result.getText(), blocks);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                throw interrupted;
            } catch (ExecutionException execution) {
                Throwable cause = execution.getCause();
                if (cause instanceof MlKitException
                        && ((MlKitException) cause).getErrorCode() == MlKitException.UNAVAILABLE) {
                    throw new ModelUnavailableException("OCR model is not available yet", cause);
                }
                if (cause instanceof Exception) throw (Exception) cause;
                throw execution;
            }
        }

        @Override
        public void close() {
            recognizer.close();
        }
    }
}
