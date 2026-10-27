package com.tifloacosta.app;

import android.content.ClipData;
import android.content.Intent;
import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TifloSavePlugin.class);
        registerPlugin(TifloSharePlugin.class);
        registerPlugin(TifloReadingPlugin.class);
        registerPlugin(TifloReadingLibraryPlugin.class);
        registerPlugin(TifloReadingBackupPlugin.class);
        registerPlugin(TifloReadingTtsPlugin.class);
        registerPlugin(TifloReadingOcrPlugin.class);
        registerPlugin(TifloReadingDerivedPlugin.class);
        registerPlugin(TifloReadingLanguagePlugin.class);
        registerPlugin(TifloReadingAudioPlugin.class);
        registerPlugin(TifloReadingAudioGroupPlugin.class);
        registerPlugin(TifloVideoScreenPlugin.class);
        registerPlugin(TifloWebFetchPlugin.class);
        registerPlugin(TifloUpdatePlugin.class);
        registerPlugin(TifloNativeFeaturesPlugin.class);
        super.onCreate(savedInstanceState);
        forwardDocumentShareToReader(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        forwardDocumentShareToReader(intent);
    }

    /**
     * Keep the existing Capacitor text-sharing path, but hand documents
     * shared by other apps straight to the native reader. Clone the incoming
     * intent so MIME type, ClipData and temporary URI grants survive the hop.
     * Never change the app package or the existing reading-library files.
     */
    private void forwardDocumentShareToReader(Intent incoming) {
        if (incoming == null) return;
        String action = incoming.getAction();
        if (!Intent.ACTION_SEND.equals(action) && !Intent.ACTION_SEND_MULTIPLE.equals(action)) return;
        boolean hasStream = incoming.hasExtra(Intent.EXTRA_STREAM);
        ClipData clip = incoming.getClipData();
        if (!hasStream && clip != null) {
            for (int i = 0; i < clip.getItemCount(); i++) {
                if (clip.getItemAt(i).getUri() != null) {
                    hasStream = true;
                    break;
                }
            }
        }
        if (!hasStream) return;
        Intent readerIntent = new Intent(incoming);
        readerIntent.setClass(this, com.tifloacosta.nativeprototype.NativePrototypeActivity.class);
        readerIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivity(readerIntent);
    }

    @Override
    public void onPause() {
        // Never keep the display awake after leaving the visible player.
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        super.onPause();
    }
}
