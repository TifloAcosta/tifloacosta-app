# Android notifications design

Date: 2026-09-23

## Goal

Add native Android push notifications to the TifloAcosta Capacitor app using the existing OneSignal application already used by tifloacosta.com, while keeping web and Android audiences clearly distinguishable and preserving accessibility for users of different Android screen readers.

## Current state

- The Android app is built with Capacitor 8 and currently ships as `com.tifloacosta.app`.
- The current Android beta is version 1.1.0, versionCode 6.
- The app already contains an accessible notification settings section and a notification service abstraction, but that service is currently instantiated without a native adapter, so notification status is reported as unavailable.
- The current Android Gradle setup already anticipates `google-services.json`, but native push delivery is not configured yet.
- The public web app already uses OneSignal. The Android integration will reuse the same OneSignal app rather than creating a second OneSignal project.

## Product behavior

### Permission flow

- OneSignal initializes silently when the Android app starts.
- The app must not show the Android notification permission prompt automatically on startup.
- The existing Settings > Notifications section remains the user-facing control.
- Permission is requested only after an explicit user action on the existing Activate notifications button.
- If permission is denied, the existing Open system settings action remains available.
- The status text remains announced through the existing accessible live region.

### Audience separation

- Android push subscriptions must be distinguishable from Web Push subscriptions inside the same OneSignal app.
- The primary separation mechanism will use OneSignal's native subscription/device type targeting so Android can be selected independently from Web Push.
- An optional app tag such as `tiflo_client=android_app` may also be attached as a secondary aid for future segmentation, but platform targeting must not depend exclusively on that tag.
- Web subscribers remain unaffected.
- Notification campaigns can target Android only, web only, or both.
- No existing web notification behavior is changed as part of this work.

### Notification opening behavior

Each notification may include optional custom data describing a destination inside TifloAcosta.

Supported destinations for the first Android notification release:

- General: open the app normally.
- News: open the requested article in the existing clean reader flow.
- Video: open the requested YouTube video in the existing accessible player flow.
- Resource: open the requested resource using the app's existing resource behavior.
- Download URL: open the existing download-link flow with the supplied URL.

The payload will use a small internal contract, for example:

- `tiflo_type`: `news`, `video`, `resource`, `download`, or `general`.
- `tiflo_id`: optional stable app item identifier when available.
- `tiflo_url`: optional URL when the destination requires one.
- `tiflo_title`: optional title used only as supporting context, never as the routing key.

The app must validate notification data before acting on it.

If the destination is invalid, missing, outdated, or cannot be opened safely, the app falls back to the home screen rather than leaving the user in a broken state.

Notification clicks must work whether the app is already open, in the background, or launched from a stopped state.

### Accessibility

- The feature must not depend on TalkBack-specific gestures, APIs, wording, or behavior.
- Existing semantic HTML controls remain the main notification settings interface.
- Permission state changes continue to be exposed through the existing `aria-live="polite"` status.
- No autofocus is introduced.
- Notification titles and messages should be concise and meaningful when spoken by Android accessibility services.
- Opening a notification into an internal screen must preserve the app's existing heading-focus behavior where applicable.
- The integration must be tested with at least the normal Android accessibility APIs and should be usable with different screen readers, not only TalkBack.

## Technical approach

### OneSignal SDK

Use the official OneSignal Capacitor SDK rather than a custom native SDK bridge or direct Firebase-only implementation.

Responsibilities of the OneSignal integration module:

- Initialize OneSignal with the existing TifloAcosta OneSignal App ID.
- Expose a notification adapter compatible with the existing `createNotificationService` abstraction.
- Read current permission state without triggering a prompt.
- Request permission only when called from the explicit settings action.
- Open Android application notification settings when permission has been denied and the user asks to change it.
- Optionally apply the Android app tag used as a secondary segmentation aid.
- Listen for notification click events and pass validated destination data to the app router.

### App startup

Replace `createNotificationService(null)` with a real Android notification adapter.

Initialization order must avoid forcing navigation before the router and content store are ready. If a notification click arrives before app startup is complete, store the pending destination and process it after the normal startup sequence is ready.

### Routing

Add a small notification-destination resolver independent of OneSignal. It converts validated notification data into existing app actions rather than duplicating screen logic.

Where possible it will reuse existing functions and flows for:

- readable news,
- direct video playback,
- resource opening,
- download-link analysis,
- home fallback.

This resolver should be unit-testable without the OneSignal SDK.

### Android platform configuration

- Add the official OneSignal Capacitor package to the mobile project.
- Sync Capacitor Android dependencies.
- Configure Firebase Cloud Messaging credentials required by OneSignal for Android delivery.
- Ensure the Android 13+ notification runtime permission is correctly declared/handled by the SDK and application configuration.
- Add or provide `google-services.json` through a secure build path if required by the selected OneSignal/Firebase setup. Do not commit private credentials or service-account secrets to the repository.

## Testing

Automated tests should cover at least:

- Status checks do not request notification permission.
- Permission is requested only by explicit user action.
- Denied state can open system notification settings.
- Android push subscriptions can be targeted separately from Web Push subscriptions.
- General notification click opens/falls back to Home.
- News payload routes to the reader.
- Video payload routes to the accessible player.
- Resource payload routes to the existing resource behavior.
- Download payload routes to the download-link flow.
- Invalid or incomplete payloads fall back safely to Home.
- A click received before app initialization is processed after startup.
- Existing web notification code is untouched.
- Existing Android tests continue to pass.

Manual beta verification should cover:

- Fresh install with permission not yet requested.
- Permission granted.
- Permission denied.
- Permission later enabled through Android system settings.
- Notification received while app is foregrounded.
- Notification received while app is backgrounded.
- Notification tapped while app is stopped.
- Correct spoken labels and understandable focus behavior with more than one Android screen reader where practical.
- No duplicate notification or duplicate navigation when tapping a single notification.

## Release scope

This notification work will be bundled with the already completed recent Android fixes rather than publishing a separate beta only for notification scaffolding.

The next beta must bump Android `versionCode` above 6 and `versionName` above 1.1.0 after implementation is complete and verified.

## Out of scope for this first notification release

- User-selectable notification categories such as News, Courses, Videos, or Studies.
- Per-topic opt-in or opt-out controls.
- Replacing the existing OneSignal web integration.
- Creating a second OneSignal application solely for Android.
- Custom notification sounds or complex rich-notification layouts.
- Assuming TalkBack is the only supported Android screen reader.

These can be added later without changing the core integration if the first beta proves stable.
