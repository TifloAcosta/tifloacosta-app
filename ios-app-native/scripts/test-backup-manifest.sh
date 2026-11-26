#!/bin/bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
xcrun swiftc -swift-version 5 "$root/Sources/NativeBackupManifest.swift" "$root/Sources/NativeBackupGenerationStore.swift" "$root/tests/backup-manifest-smoke.swift" -o "$work/backup-manifest-smoke"
"$work/backup-manifest-smoke"
xcrun swiftc -swift-version 5 "$root/Sources/NativeBackupRestoreTransaction.swift" "$root/tests/backup-restore-transaction-smoke.swift" -o "$work/backup-restore-transaction-smoke"
"$work/backup-restore-transaction-smoke"
xcrun swiftc -swift-version 5 "$root/Sources/NativeBackupRestoreTransaction.swift" "$root/Sources/NativeBackupFileRestore.swift" "$root/tests/backup-file-restore-smoke.swift" -o "$work/backup-file-restore-smoke"
"$work/backup-file-restore-smoke"
xcrun swiftc -swift-version 5 "$root/Sources/NativeBackupRestoreJournal.swift" "$root/tests/backup-restore-journal-smoke.swift" -o "$work/backup-restore-journal-smoke"
"$work/backup-restore-journal-smoke"
