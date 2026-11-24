#!/usr/bin/env python3
"""Inject the public Drive catalogue key into a temporary CI checkout.

The key is expected in GitHub Actions secret TIFLO_CINEMA_PUBLIC_DRIVE_API_KEY.
Never paste it into a tracked Info.plist or print it to a build log.
"""
from pathlib import Path
import os
import plistlib
import re
import sys

key = os.environ.get("TIFLO_CINEMA_PUBLIC_DRIVE_API_KEY", "").strip()
require = "--require" in sys.argv

if not key:
    if require:
        raise SystemExit(
            "Falta el secreto de GitHub TIFLO_CINEMA_PUBLIC_DRIVE_API_KEY. "
            "No se permite distribuir Multicines sin acceso público a Audesc."
        )
    print("Multicines: credencial pública Google Drive no configurada para esta ejecución.")
    raise SystemExit(0)

if not re.fullmatch(r"AIza[A-Za-z0-9_-]{25,196}", key):
    raise SystemExit("La clave de Google Drive no tiene el formato esperado.")

plist = Path(__file__).resolve().parents[1] / "Sources" / "Info.plist"
original = plist.read_bytes()
data = plistlib.loads(original)
if "TifloCinemaPublicDriveAPIKey" not in data:
    raise SystemExit("Falta TifloCinemaPublicDriveAPIKey en Info.plist.")

data["TifloCinemaPublicDriveAPIKey"] = key
plist.write_bytes(plistlib.dumps(data, fmt=plistlib.FMT_XML, sort_keys=False))
print("Multicines: clave restringida de Google Drive incorporada a la compilación.")
