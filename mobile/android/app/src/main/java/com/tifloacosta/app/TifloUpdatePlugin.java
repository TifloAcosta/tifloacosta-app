package com.tifloacosta.app;

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
    private AppUpdateManager manager() {
        return AppUpdateManagerFactory.create(getContext());
    }

    @PluginMethod
    public void check(PluginCall call) {
        manager().getAppUpdateInfo()
            .addOnSuccessListener(info -> call.resolve(toJs(info)))
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
        AppUpdateManager manager = manager();
        manager.getAppUpdateInfo()
            .addOnSuccessListener(info -> {
                if (info.installStatus() != InstallStatus.DOWNLOADED) {
                    call.reject("update_unavailable");
                    return;
                }
                manager.completeUpdate()
                    .addOnSuccessListener(unused -> {
                        JSObject result = new JSObject();
                        result.put("completed", true);
                        call.resolve(result);
                    })
                    .addOnFailureListener(error -> call.reject("update_failed"));
            })
            .addOnFailureListener(error -> call.reject("update_failed"));
    }

    private void startFlow(PluginCall call, int type) {
        AppUpdateManager manager = manager();
        manager.getAppUpdateInfo()
            .addOnSuccessListener(info -> {
                boolean available = info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                    || (type == AppUpdateType.IMMEDIATE
                        && info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS);
                if (!available) {
                    call.reject("update_unavailable");
                    return;
                }
                AppUpdateOptions options = AppUpdateOptions.newBuilder(type).build();
                if (!info.isUpdateTypeAllowed(options)) {
                    call.reject("flow_not_allowed");
                    return;
                }
                manager.startUpdateFlow(info, getActivity(), options)
                    .addOnSuccessListener(resultCode -> {
                        JSObject result = new JSObject();
                        result.put("started", true);
                        result.put("resultCode", resultCode);
                        call.resolve(result);
                    })
                    .addOnFailureListener(error -> call.reject("update_failed"));
            })
            .addOnFailureListener(error -> call.reject("update_failed"));
    }

    private JSObject toJs(AppUpdateInfo info) {
        JSObject result = new JSObject();
        result.put("available", info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE);
        result.put("availability", info.updateAvailability());
        result.put("versionCode", info.availableVersionCode());
        result.put("priority", info.updatePriority());
        result.put("flexibleAllowed", info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE));
        result.put("immediateAllowed", info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE));
        result.put("installStatus", info.installStatus());
        return result;
    }
}
