package com.tifloacosta.app;

import android.os.Bundle;

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
        registerPlugin(TifloReadingAudioPlugin.class);
        registerPlugin(TifloReadingAudioGroupPlugin.class);
        registerPlugin(TifloWebFetchPlugin.class);
        registerPlugin(TifloUpdatePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
