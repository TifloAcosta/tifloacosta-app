#!/bin/bash
set -euo pipefail

sample="$1"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
curl -fsSL --retry 2 --max-time 60 https://software.verapdf.org/releases/verapdf-installer.zip -o "$work/installer.zip"
echo "04415ef3f149526a3048b9889723e81320ddf013bd891bcc7f0f297f3eadcc23  $work/installer.zip" | shasum -a 256 -c
unzip -q "$work/installer.zip" -d "$work"
cat > "$work/install.xml" <<XML
<AutomatedInstallation langpack="eng">
  <com.izforge.izpack.panels.htmlhello.HTMLHelloPanel id="welcome"/>
  <com.izforge.izpack.panels.target.TargetPanel id="install_dir"><installpath>$work/cli</installpath></com.izforge.izpack.panels.target.TargetPanel>
  <com.izforge.izpack.panels.packs.PacksPanel id="sdk_pack_select">
    <pack index="0" name="veraPDF GUI" selected="false"/>
    <pack index="1" name="veraPDF CLI" selected="true"/>
    <pack index="2" name="veraPDF Documentation" selected="false"/>
    <pack index="3" name="veraPDF Sample Plugins" selected="false"/>
  </com.izforge.izpack.panels.packs.PacksPanel>
  <com.izforge.izpack.panels.install.InstallPanel id="install"/>
  <com.izforge.izpack.panels.finish.FinishPanel id="finish"/>
</AutomatedInstallation>
XML
java -jar "$work"/verapdf-greenfield-*/verapdf-izpack-installer-*.jar "$work/install.xml"
result=0
"$work/cli/verapdf" --flavour ua1 --format xml --verbose "$sample" > "$work/report.xml" || result=$?
test "$result" -le 1
python3 - "$work/report.xml" <<'PYTHON'
import sys
import xml.etree.ElementTree as ET

root = ET.parse(sys.argv[1]).getroot()
report = root.find(".//validationReport")
if report is None:
    raise SystemExit("veraPDF did not produce a validation report")
if report.attrib.get("isCompliant") == "true":
    print("veraPDF PDF/UA-1 automated checks passed. Manual checks are still required.")
else:
    print("::warning::The conversion sample failed the veraPDF PDF/UA-1 checks.")
    for rule in report.findall(".//rule"):
        if rule.attrib.get("status") == "failed":
            print(rule.attrib, rule.findtext("description", ""))
PYTHON
