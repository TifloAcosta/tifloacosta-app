package com.tifloacosta.app;

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
        registerPlugin(TifloYouTubeAccountPlugin.class);
        registerPlugin(TifloWebFetchPlugin.class);
        registerPlugin(TifloUpdatePlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onPause() {
        // Never keep the display awake after leaving the visible player.
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        super.onPause();
    }
}
