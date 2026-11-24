#!/bin/bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

mkdir -p "$work/Sources/ConversionSmoke"
cp "$root/Sources/NativeDocumentConversion.swift"   "$root/Sources/NativeConversionMarkup.swift"   "$root/Sources/NativeEpubSpine.swift"   "$root/tests/document-conversion-smoke.swift" "$work/Sources/ConversionSmoke/"
cat > "$work/Package.swift" <<'SWIFT'
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ConversionSmoke",
    platforms: [.macOS(.v14)],
    dependencies: [.package(url: "https://github.com/weichsel/ZIPFoundation.git", from: "0.9.0")],
    targets: [.executableTarget(
        name: "ConversionSmoke",
        dependencies: [.product(name: "ZIPFoundation", package: "ZIPFoundation")]
    )]
)
SWIFT
swift run --package-path "$work" ConversionSmoke
