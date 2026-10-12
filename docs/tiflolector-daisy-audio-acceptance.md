# TifloLector: DAISY and audiobook navigation — acceptance gate

This file tracks requirements that must be verified before packaging the next iOS TestFlight build. UI code alone does not certify native iOS media handling.

## General audiobooks
- [x] Web-layer playback controls exist: play/pause, seek by time, previous/next track, speed, sleep timer, bookmark and saved position.
- [x] Multi-track selector presents metadata title when supplied, else numbered file order, with accessible label and explicit Go action.
- [ ] Verify import of single MP3/M4A and supported audiobook bundles on iOS, including zip extraction, track ordering, failure messages for unsupported codecs/encrypted packages.
- [ ] Confirm native iOS audio bridge supports prepare/play/pause/seek/speed/track-change, background playback, interruptions, resume and persistence.
- [ ] Verify chapter navigation from embedded audio chapters when present; do not infer chapters merely from arbitrary file splits.

## DAISY 2.02 and DAISY 3
- [x] Android package adapter parses NCC/OPF, SMIL and navigation heading levels in supported content.
- [ ] Check that the imported navigation hierarchy (levels 1–6), page references and structural semantics reach the iOS reading model.
- [ ] Implement native iOS package import and media resources, or provide an explicitly supported cross-platform extraction route.
- [ ] Allow user to select navigation unit: chapter/heading level, section, paragraph, phrase, page or audio track **only when those structures exist**.
- [ ] For synchronized DAISY, map each navigation target through SMIL to the exact track and time offset; update both spoken text and position.
- [ ] Handle audio-only DAISY via NCC/NCX headings/SMIL instead of requiring text blocks.
- [ ] Preserve playback state, focus, VoiceOver announcement, bookmarking and progress when changing navigation level.
- [ ] Test nested levels, missing resources, malformed manifests, encrypted files, discontinuous SMIL and zipped packages.

## Release criteria
Run unit tests and a real iOS simulator/device build, then check with VoiceOver on device. Fail closed when native bridge or media resources are absent. Do not call any unchecked item complete or claim the TestFlight update is ready.
