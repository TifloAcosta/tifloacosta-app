# Microsoft Speech in TifloLector — Design

Goal: Let a person choose the iPhone voice or Azure Speech to read an entire document, with accessible playback controls. Investigate Edge Neural as a separate provider without claiming undocumented integration is supported.

Approaches: (1) Replace iOS TTS with a cloud engine — rejected because it breaks offline reading. (2) Convert entire documents to a single audio file — rejected because a long book would consume time, memory, and quota before the first word. (3) Keep iOS TTS and add optional Azure playback in short successive text chunks — selected for incremental playback and controllable usage. Edge remains a researched, not-yet-enabled provider until an authorized sustainable mechanism is verified.

Requirements: The default is always iOS voices. Azure is opt-in, requires the user's region and own subscription key in Keychain, and communicates possible charges. A failure is announced rather than silently consuming another provider. Reading keeps pause/resume, stop, progress, bookmarks, jumps and library position; the network must not play stale audio after a stop. Audio-only books retain their current player. No secret enters source code or UserDefaults. External testing must cover physical iPhone, background audio, and VoiceOver.

Constraints: Swift 5.9, iOS 17+, XcodeGen project, AVFoundation. Linux can run contract tests but cannot compile or sign the iOS app. Do not publish/TestFlight until physical validation and explicit confirmation. Edge public third-party API and permission are currently unverified.
