package com.tifloacosta.app;

import android.app.Application;
import android.app.Activity;
import android.os.Bundle;
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
        registerActivityLifecycleCallbacks(new ActivityLifecycleCallbacks() {
            @Override public void onActivityCreated(Activity activity, Bundle savedInstanceState) {
                if ("com.tifloacosta.nativeprototype.NativePrototypeActivity"
                        .equals(activity.getClass().getName())) {
                    NativeWebStateMigration.importIfNecessary(activity);
                }
            }
            @Override public void onActivityStarted(Activity activity) {}
            @Override public void onActivityResumed(Activity activity) {}
            @Override public void onActivityPaused(Activity activity) {}
            @Override public void onActivityStopped(Activity activity) {}
            @Override public void onActivitySaveInstanceState(Activity activity, Bundle outState) {}
            @Override public void onActivityDestroyed(Activity activity) {}
        });
    }
}
