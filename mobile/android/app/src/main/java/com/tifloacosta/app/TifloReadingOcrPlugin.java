package com.tifloacosta.app;

import android.content.Context;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.tifloacosta.app.reading.ReadingBookRecord;
import com.tifloacosta.app.reading.ReadingLibraryDatabase;
import com.tifloacosta.app.reading.ReadingOcrService;
import com.tifloacosta.app.reading.ReadingPdfPageRenderer;

@CapacitorPlugin(name = "TifloReadingOcr")
public class TifloReadingOcrPlugin extends Plugin {
    private ReadingLibraryDatabase database;
    private ReadingOcrService ocrService;

    @Override
    public void load() {
        Context context = getContext().getApplicationContext();
        database = new ReadingLibraryDatabase(context);
        ocrService = new ReadingOcrService(new ReadingPdfPageRenderer(context));
    }

    @PluginMethod
    public void recognizePdfPage(PluginCall call) {
        String bookId = clean(call.getString("bookId"));
        String password = call.getString("password");
        String script = clean(call.getString("script"));
        Integer pageIndex = call.getInt("pageIndex");

        if (bookId.isEmpty() || pageIndex == null || pageIndex < 0) {
            call.reject("OCR book id and non-negative page index are required");
            return;
        }

        getBridge().execute(() -> {
            try {
                ReadingBookRecord book = database.findById(bookId);
                if (book == null || !"pdf".equalsIgnoreCase(clean(book.getFormat()))) {
                    call.resolve(errorJsResult(pageIndex));
                    return;
                }
                ReadingOcrService.Result result = ocrService.recognizePdfPage(
                        book.getRelativePath(),
                        password == null ? "" : password,
                        pageIndex,
                        script
                );
                call.resolve(toJsResult(result));
            } catch (RuntimeException error) {
                call.resolve(errorJsResult(pageIndex));
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (database != null) database.close();
        super.handleOnDestroy();
    }

    private static JSObject toJsResult(ReadingOcrService.Result ocrResult) {
        JSObject result = new JSObject();
        result.put("pageIndex", ocrResult.getPageIndex());
        result.put("text", ocrResult.getText());
        JSArray blocks = new JSArray();
        for (String block : ocrResult.getBlocks()) blocks.put(block);
        result.put("blocks", blocks);
        result.put("status", ocrResult.getStatus());
        return result;
    }

    private static JSObject errorJsResult(int pageIndex) {
        JSObject result = new JSObject();
        result.put("pageIndex", pageIndex);
        result.put("text", "");
        result.put("blocks", new JSArray());
        result.put("status", ReadingOcrService.STATUS_ERROR);
        return result;
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }
}
