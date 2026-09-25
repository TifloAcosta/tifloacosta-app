package com.tifloacosta.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private TifloUpdatePromptController updatePromptController;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TifloSavePlugin.class);
        registerPlugin(TifloSharePlugin.class);
        registerPlugin(TifloWebFetchPlugin.class);
        registerPlugin(TifloUpdatePlugin.class);
        super.onCreate(savedInstanceState);
        updatePromptController = new TifloUpdatePromptController(this);
        updatePromptController.start();
        updatePromptController.checkForUpdate();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (updatePromptController != null) {
            updatePromptController.checkForUpdate();
        }
    }

    @Override
    protected void onDestroy() {
        if (updatePromptController != null) {
            updatePromptController.stop();
        }
        super.onDestroy();
    }
}
