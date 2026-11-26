#!/bin/bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
xcrun swiftc -swift-version 5 "$root/Sources/NativeBackupManifest.swift" "$root/tests/backup-manifest-smoke.swift" -o "$work/backup-manifest-smoke"
"$work/backup-manifest-smoke"
