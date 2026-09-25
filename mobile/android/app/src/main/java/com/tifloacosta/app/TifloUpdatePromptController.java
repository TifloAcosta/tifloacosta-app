package com.tifloacosta.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.IntentSender;

import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;

public final class TifloUpdatePromptController {
    private static final int UPDATE_REQUEST_CODE = 4208;

    private final Activity activity;
    private final AppUpdateManager manager;
    private final InstallStateUpdatedListener installListener;
    private int lastPromptedVersionCode = 0;
    private int dismissedVersionCode = 0;
    private boolean dialogVisible = false;
    private boolean started = false;

    public TifloUpdatePromptController(Activity activity) {
        this.activity = activity;
        this.manager = AppUpdateManagerFactory.create(activity);
        this.installListener = state -> {
            if (state.installStatus() == InstallStatus.DOWNLOADED) {
                activity.runOnUiThread(this::showCompletePrompt);
            }
        };
    }

    public void start() {
        if (started) return;
        manager.registerListener(installListener);
        started = true;
    }

    public void stop() {
        if (!started) return;
        manager.unregisterListener(installListener);
        started = false;
    }

    public void checkForUpdate() {
        manager.getAppUpdateInfo()
            .addOnSuccessListener(this::handleInfo)
            .addOnFailureListener(error -> {
                // Update checks are optional. The app remains usable if Google Play is unavailable.
            });
    }

    private void handleInfo(AppUpdateInfo info) {
        if (activity.isFinishing() || activity.isDestroyed()) return;

        if (info.installStatus() == InstallStatus.DOWNLOADED) {
            showCompletePrompt();
            return;
        }

        int availability = info.updateAvailability();
        boolean available = availability == UpdateAvailability.UPDATE_AVAILABLE
            || availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS;
        if (!available) return;

        int versionCode = info.availableVersionCode();
        if (versionCode > 0 && (versionCode == lastPromptedVersionCode || versionCode == dismissedVersionCode)) return;

        AppUpdateOptions immediate = AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build();
        AppUpdateOptions flexible = AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build();
        boolean immediateAllowed = info.isUpdateTypeAllowed(immediate);
        boolean flexibleAllowed = info.isUpdateTypeAllowed(flexible);
        boolean critical = info.updatePriority() == 5 && immediateAllowed;

        if (!critical && !flexibleAllowed && !immediateAllowed) return;
        int mode = critical ? AppUpdateType.IMMEDIATE : (flexibleAllowed ? AppUpdateType.FLEXIBLE : AppUpdateType.IMMEDIATE);
        showAvailablePrompt(info, versionCode, mode, critical);
    }

    private void showAvailablePrompt(AppUpdateInfo info, int versionCode, int mode, boolean critical) {
        if (dialogVisible) return;
        dialogVisible = true;
        if (versionCode > 0) lastPromptedVersionCode = versionCode;

        AlertDialog.Builder builder = new AlertDialog.Builder(activity)
            .setTitle(R.string.update_available_title)
            .setMessage(R.string.update_available_message)
            .setPositiveButton(R.string.update_now, (dialog, which) -> startFlow(info, mode));

        if (!critical) {
            builder.setNegativeButton(R.string.update_later, (dialog, which) -> {
                if (versionCode > 0) dismissedVersionCode = versionCode;
            });
        }

        AlertDialog dialog = builder.create();
        dialog.setOnDismissListener(value -> dialogVisible = false);
        dialog.show();
    }

    private void showCompletePrompt() {
        if (dialogVisible || activity.isFinishing() || activity.isDestroyed()) return;
        dialogVisible = true;
        AlertDialog dialog = new AlertDialog.Builder(activity)
            .setTitle(R.string.update_ready_title)
            .setMessage(R.string.update_ready_message)
            .setPositiveButton(R.string.update_complete, (value, which) -> manager.completeUpdate())
            .setNegativeButton(R.string.update_later, null)
            .create();
        dialog.setOnDismissListener(value -> dialogVisible = false);
        dialog.show();
    }

    private void startFlow(AppUpdateInfo info, int updateType) {
        try {
            AppUpdateOptions options = AppUpdateOptions.newBuilder(updateType).build();
            manager.startUpdateFlowForResult(info, activity, options, UPDATE_REQUEST_CODE);
        } catch (IntentSender.SendIntentException error) {
            // A failed update flow must never prevent the user from continuing to use the app.
        }
    }
}
