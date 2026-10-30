package com.tifloacosta.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import com.onesignal.OneSignal;
import com.onesignal.Continue;

/** Executed only for a user's explicit request inside native Settings. */
public final class NativePushConsentReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !"com.tifloacosta.app.ENABLE_NOTIFICATIONS".equals(intent.getAction())) return;
        OneSignal.setConsentGiven(true);
        OneSignal.getNotifications().requestPermission(false, Continue.none());
    }
}
