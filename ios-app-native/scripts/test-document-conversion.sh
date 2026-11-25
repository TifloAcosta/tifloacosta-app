#!/bin/bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

mkdir -p "$work/Sources/ConversionSmoke"
cp "$root/Sources/NativeDocumentConversion.swift"   "$root/Sources/NativeConversionMarkup.swift"   "$root/Sources/NativeODTConversionMarkup.swift" "$root/Sources/NativeODTConversionWriter.swift" "$root/Sources/NativeRTFConversionWriter.swift" "$root/Sources/NativeDOCXConversionMarkup.swift"   "$root/Sources/NativeEpubSpine.swift"   "$root/tests/document-conversion-smoke.swift" "$work/Sources/ConversionSmoke/"
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
schema="$work/fb2-schema"
mkdir -p "$schema"
revision=4d3740e319039911c30d291abb0c8b26ec99703b
for file in FictionBook.xsd FictionBookLinks.xsd FictionBookGenres.xsd FictionBookLang.xsd; do
  curl -fsSL --retry 3 "https://raw.githubusercontent.com/gribuser/fb2/$revision/$file" -o "$schema/$file"
done
samples="${CONVERSION_SAMPLES_DIR:-$work/samples}"
mkdir -p "$samples"
swift run --package-path "$work" ConversionSmoke "$schema/FictionBook.xsd" "$samples"

dtd="$work/dtd"
mkdir -p "$dtd"
for file in xhtml1-transitional.dtd xhtml-lat1.ent xhtml-special.ent xhtml-symbol.ent; do
  curl -fsSL --retry 3 "https://www.w3.org/TR/xhtml1/DTD/$file" -o "$dtd/$file"
done
curl -fsSL --retry 3 https://www.w3.org/TR/1998/REC-smil-19980615/SMIL10.dtd -o "$dtd/SMIL10.dtd"
xmllint --nonet --noout --dtdvalid "$dtd/xhtml1-transitional.dtd" "$samples/ncc.html" "$samples/book.xhtml"
xmllint --nonet --noout --dtdvalid "$dtd/SMIL10.dtd" "$samples/book.smil"
python3 "$root/scripts/check-text-daisy.py" "$samples"

revision=deaab821336558ed5dc673dd38af71db49608c94
base="https://raw.githubusercontent.com/daisy/pipeline/$revision/modules"
while read -r module file; do
  curl -fsSL --retry 3 "$base/$module/src/main/resources/xml/dtd/$file" -o "$dtd/$file"
done <<'DTDS'
daisy3-utils oeb12.ent
daisy3-utils oebpkg12.dtd
daisy3-utils ncx-2005-1.dtd
dtbook-utils dtbook-2005-3.dtd
smil-utils dtbsmil-2005-1.dtd
DTDS
cat > "$dtd/catalog.xml" <<'XML'
<catalog xmlns="urn:oasis:names:tc:entity:xmlns:xml:catalog">
  <system systemId="http://openebook.org/dtds/oeb-1.2/oeb12.ent" uri="oeb12.ent"/>
</catalog>
XML
while read -r extension file; do
  XML_CATALOG_FILES="$dtd/catalog.xml" xmllint --nonet --noout --dtdvalid "$dtd/$file" "$samples/daisy3/book.$extension"
done <<'DTDS'
opf oebpkg12.dtd
ncx ncx-2005-1.dtd
xml dtbook-2005-3.dtd
smil dtbsmil-2005-1.dtd
DTDS
python3 "$root/scripts/check-text-daisy3.py" "$samples/daisy3"
