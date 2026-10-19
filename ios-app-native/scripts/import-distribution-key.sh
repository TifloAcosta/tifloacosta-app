#!/bin/bash
set -euo pipefail
SIGNING="$RUNNER_TEMP/ios-signing"
KEYCHAIN="$RUNNER_TEMP/tifloacosta-native.keychain-db"
PASSWORD="$(openssl rand -hex 20)"
security create-keychain -p "$PASSWORD" "$KEYCHAIN"
security unlock-keychain -p "$PASSWORD" "$KEYCHAIN"
security set-keychain-settings -lut 21600 "$KEYCHAIN"
security list-keychains -d user -s "$KEYCHAIN" $(security list-keychains -d user | tr -d '"')
"$(brew --prefix openssl@3)/bin/openssl" pkcs12 -legacy -in "$SIGNING/TifloAcosta.p12" -passin env:P12_PASSWORD -nodes -out "$SIGNING/key-and-cert.pem"
/usr/bin/openssl pkcs12 -export -in "$SIGNING/key-and-cert.pem" -out "$SIGNING/modern.p12" -passout env:P12_PASSWORD -name "TifloAcosta Apple Distribution"
rm -f "$SIGNING/key-and-cert.pem"
security import "$SIGNING/modern.p12" -k "$KEYCHAIN" -P "$P12_PASSWORD" -T /usr/bin/codesign -T /usr/bin/security
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$PASSWORD" "$KEYCHAIN"
rm -f "$SIGNING/modern.p12" "$SIGNING/TifloAcosta.p12"
security find-identity -v -p codesigning "$KEYCHAIN" | grep -q "Apple Distribution"
echo "IOS_TEMP_KEYCHAIN=$KEYCHAIN" >> "$GITHUB_ENV"
