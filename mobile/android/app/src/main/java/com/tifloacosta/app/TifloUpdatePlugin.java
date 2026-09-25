package com.tifloacosta.app;

import android.content.IntentSender;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;

@CapacitorPlugin(name = "TifloUpdate")
public class TifloUpdatePlugin extends Plugin {
    private static final int UPDATE_REQUEST_CODE = 4207;
    private AppUpdateManager appUpdateManager;

    @Override
    public void load() {
        appUpdateManager = AppUpdateManagerFactory.create(getContext());
    }

    @PluginMethod
    public void check(PluginCall call) {
        manager().getAppUpdateInfo()
            .addOnSuccessListener(info -> call.resolve(toResult(info)))
            .addOnFailureListener(error -> call.reject("update_failed"));
    }

    @PluginMethod
    public void startFlexible(PluginCall call) {
        startFlow(call, AppUpdateType.FLEXIBLE);
    }

    @PluginMethod
    public void startImmediate(PluginCall call) {
        startFlow(call, AppUpdateType.IMMEDIATE);
    }

    @PluginMethod
    public void completeFlexible(PluginCall call) {
        manager().getAppUpdateInfo()
            .addOnSuccessListener(info -> {
                if (info.installStatus() != InstallStatus.DOWNLOADED) {
                    call.reject("update_unavailable");
                    return;
                }
                manager().completeUpdate()
                    .addOnSuccessListener(unused -> call.resolve())
                    .addOnFailureListener(error -> call.reject("update_failed"));
            })
            .addOnFailureListener(error -> call.reject("update_failed"));
    }

    private AppUpdateManager manager() {
        if (appUpdateManager == null) {
            appUpdateManager = AppUpdateManagerFactory.create(getContext());
        }
        return appUpdateManager;
    }

    private void startFlow(PluginCall call, int updateType) {
        manager().getAppUpdateInfo()
            .addOnSuccessListener(info -> {
                boolean available = info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                    || info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS;
                AppUpdateOptions options = AppUpdateOptions.newBuilder(updateType).build();
                if (!available) {
                    call.reject("update_unavailable");
                    return;
                }
                if (!info.isUpdateTypeAllowed(options)) {
                    call.reject("flow_not_allowed");
                    return;
                }
                try {
                    boolean started = manager().startUpdateFlowForResult(
                        info,
                        getActivity(),
                        options,
                        UPDATE_REQUEST_CODE
                    );
                    if (!started) {
                        call.reject("update_failed");
                        return;
                    }
                    JSObject result = new JSObject();
                    result.put("started", true);
                    call.resolve(result);
                } catch (IntentSender.SendIntentException error) {
                    call.reject("update_failed");
                }
            })
            .addOnFailureListener(error -> call.reject("update_failed"));
    }

    private JSObject toResult(AppUpdateInfo info) {
        int availability = info.updateAvailability();
        boolean available = availability == UpdateAvailability.UPDATE_AVAILABLE
            || availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS;
        JSObject result = new JSObject();
        result.put("available", available);
        result.put("availability", availability);
        result.put("versionCode", info.availableVersionCode());
        result.put("priority", info.updatePriority());
        result.put("flexibleAllowed", info.isUpdateTypeAllowed(AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build()));
        result.put("immediateAllowed", info.isUpdateTypeAllowed(AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build()));
        result.put("installStatus", info.installStatus());
        return result;
    }
}
