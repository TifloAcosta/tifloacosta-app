#!/bin/bash
set -euo pipefail
platform="$1"
destination="$2"
revision=7281d8d64321f945f296e696d8561f68c8186c67
host="$(uname -m)"
case "$host" in arm64) host=arm64 ;; x86_64) host=x64 ;; *) exit 2 ;; esac
case "$platform" in
  iphoneos) triplet=arm64-ios ;;
  iphonesimulator) triplet=arm64-ios-simulator ;;
  macosx) triplet="$host-osx" ;;
  *) exit 2 ;;
esac
version="$revision-$triplet-qpdf"
if [ -f "$destination/version" ] && [ "$(cat "$destination/version")" = "$version" ]; then exit 0; fi
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
root="$work/vcpkg"
git init -q "$root"
git -C "$root" fetch --depth=1 https://github.com/microsoft/vcpkg.git "$revision"
git -C "$root" checkout --detach FETCH_HEAD
"$root/bootstrap-vcpkg.sh" -disableMetrics
mkdir -p "$work/triplets"
if [ "$platform" != macosx ]; then
  cat > "$work/triplets/$triplet.cmake" <<TRIPLET
set(VCPKG_TARGET_ARCHITECTURE arm64)
set(VCPKG_CRT_LINKAGE dynamic)
set(VCPKG_LIBRARY_LINKAGE static)
set(VCPKG_CMAKE_SYSTEM_NAME iOS)
set(VCPKG_OSX_SYSROOT $platform)
set(VCPKG_OSX_DEPLOYMENT_TARGET 17.0)
TRIPLET
fi
(
  cd "$root"
  ./vcpkg install --overlay-triplets="$work/triplets" --triplet="$triplet" 'qpdf[core]'
)
prefix="$root/installed/$triplet"
mkdir -p "$destination/include" "$destination/lib" "$destination/licenses"
cp -R "$prefix/include/qpdf" "$destination/include/"
for library in qpdf jpeg z; do
  cp "$prefix/lib/lib$library.a" "$destination/lib/"
done
for directory in "$prefix/share/"*; do
  if [ -f "$directory/copyright" ]; then
    cp "$directory/copyright" "$destination/licenses/${directory##*/}.txt"
  fi
done
printf '%s\n' "$version" > "$destination/version"
