package com.tifloacosta.app;

import android.app.Application;
import com.onesignal.OneSignal;

/**
 * Initialize notifications without waiting for the Capacitor/WebView shell.
 * Consent is required and existing OneSignal consent state is not reset.
 */
public final class TifloAcostaApplication extends Application {
    private static final String ONESIGNAL_APP_ID = "ed030723-7f6f-4745-8cd3-6938a9d04377";

    @Override
    public void onCreate() {
        super.onCreate();
        OneSignal.setConsentRequired(true);
        OneSignal.initWithContext(this, ONESIGNAL_APP_ID);
    }
}
