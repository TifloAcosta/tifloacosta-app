package com.tifloacosta.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TifloSavePlugin.class);
        registerPlugin(TifloSharePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
