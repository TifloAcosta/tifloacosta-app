#!/bin/bash
set -euo pipefail
sdk="$1"
output="$2"
revision=3b38c100022bdfb49be7797c4828a476f1621d55
source="$output/source"
archs="${ARCHS:-arm64}"
stamp="$revision:$sdk:$archs"
if test -f "$output/stamp" && test "$(cat "$output/stamp")" = "$stamp" && test -f "$output/lib/libchromaprint.a"; then
  exit 0
fi
mkdir -p "$output"
if ! test -d "$source/.git"; then
  git init -q "$source"
  git -C "$source" fetch --depth 1 https://github.com/acoustid/chromaprint.git "$revision"
  git -C "$source" checkout -q --detach FETCH_HEAD
fi
test "$(git -C "$source" rev-parse HEAD)" = "$revision"
# AVAudioConverter supplies mono PCM at 11025 Hz. Compile only the MIT
# Chromaprint sources with Apple's vDSP, excluding FFmpeg and its resampler.
cmake -S "$source" -B "$output/build" -G "Unix Makefiles" \
  -DCMAKE_SYSTEM_NAME=iOS -DCMAKE_OSX_SYSROOT="$(xcrun --sdk "$sdk" --show-sdk-path)" \
  -DCMAKE_OSX_ARCHITECTURES="${archs// /;}" -DCMAKE_OSX_DEPLOYMENT_TARGET=17.0 \
  -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX="$output" \
  -DFFT_LIB=vdsp -DUSE_INTERNAL_AVRESAMPLE=OFF -DAUDIO_PROCESSOR_LIB=disabled \
  -DBUILD_SHARED_LIBS=OFF -DBUILD_TOOLS=OFF -DBUILD_TESTS=OFF
cmake --build "$output/build" --parallel 3
cmake --install "$output/build"
cp "$source/LICENSE.md" "$output/Chromaprint-license.txt"
printf '%s\n' "$stamp" > "$output/stamp"
