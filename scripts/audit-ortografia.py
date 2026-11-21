#!/usr/bin/env python3
"""Auditoría conservadora de ortografía visible en TifloAcosta.

No modifica archivos. Evita los nombres de archivos, URL e identificadores.
Detecta faltas inequívocas; la revisión humana del resto sigue siendo necesaria.
"""
from __future__ import annotations

from collections import Counter
from html import unescape
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
FIXES = {
    "pildora": "píldora", "pildoras": "píldoras",
    "tecnologia": "tecnología", "tecnologias": "tecnologías",
    "tecnologico": "tecnológico", "tecnologica": "tecnológica",
    "tecnologicos": "tecnológicos", "tecnologicas": "tecnológicas",
    "musica": "música", "pagina": "página", "paginas": "páginas",
    "espanol": "español", "espanola": "española", "espana": "España",
    "ingles": "inglés", "frances": "francés", "aleman": "alemán",
    "numero": "número", "numeros": "números", "ultimo": "último",
    "ultima": "última", "ultimos": "últimos", "ultimas": "últimas",
    "titulo": "título", "titulos": "títulos", "facil": "fácil",
    "faciles": "fáciles", "rapido": "rápido", "rapida": "rápida",
    "informacion": "información", "configuracion": "configuración",
    "reproduccion": "reproducción", "aplicacion": "aplicación",
    "seleccion": "selección", "seccion": "sección", "secciones": "secciones",
    "conexion": "conexión", "busqueda": "búsqueda",
    "cancion": "canción", "canciones": "canciones",
    "opcion": "opción", "opciones": "opciones",
    "exportacion": "exportación", "importacion": "importación",
    "navegacion": "navegación", "descripcion": "descripción",
    "audiodescripcion": "audiodescripción",
    "publicacion": "publicación", "publicaciones": "publicaciones",
    "capitulo": "capítulo", "capitulos": "capítulos",
    "articulo": "artículo", "articulos": "artículos",
    "version": "versión", "versiones": "versiones",
    "accesible": "accesible", "contrasena": "contraseña",
    "caracter": "carácter", "tambien": "también",
    "asi": "así", "aqui": "aquí", "detras": "detrás",
    "imagenes": "imágenes", "imagen": "imagen",
    "metodo": "método", "metodos": "métodos",
    "movil": "móvil", "moviles": "móviles",
    "telefono": "teléfono", "telefonos": "teléfonos",
    "pais": "país", "paises": "países",
    "senal": "señal", "senales": "señales",
    "tamano": "tamaño",
}
# Palabras polisémicas sin tilde no se sustituyen automáticamente:
# mas/más, si/sí, el/él, tu/tú, que/qué, como/cómo, esta/está,
# publico/público/publicó, continuo/continuó/continúo, etc.
WORDS = re.compile(r"\b(" + "|".join(map(re.escape, FIXES)) + r")\b", re.IGNORECASE)
MOJIBAKE = re.compile(r"\ufffd|Ã[¡©­³º±]|\u00c2[¿¡]|\u00e2\u20ac[\u2122\u0153\u009d]")
SKIP_DIRS = {".git", "node_modules", "dist", "build", "Pods", ".gradle", "__pycache__"}
SCANNED = []
FINDINGS = []

def inspect_text(path: Path, line: int, origin: str, value: str) -> None:
    if not value.strip():
        return
    for m in WORDS.finditer(value):
        found = m.group(0)
        # Las rutas y las URL se conservan sin tildes por compatibilidad.
        token = value[max(0, m.start()-55):m.end()+55]
        if re.search(r"https?://|(?:docs|images|audio|src|file)/", value) and origin != "visible":
            continue
        if origin != "visible" and re.search(r"[A-Za-z0-9_-]+\.[a-z]{2,6}", value):
            continue
        FINDINGS.append({
            "archivo": str(path.relative_to(ROOT)),
            "linea": line, "zona": origin,
            "hallado": found, "propuesta": FIXES[found.lower()],
            "contexto": token.strip().replace("\n", " ")[:140],
        })
    for m in MOJIBAKE.finditer(value):
        FINDINGS.append({
            "archivo": str(path.relative_to(ROOT)), "linea": line,
            "zona": origin, "hallado": m.group(0),
            "propuesta": "Revisar codificación UTF-8",
            "contexto": value[max(0,m.start()-45):m.end()+45].strip()[:140]
        })

class VisibleHTML(HTMLParser):
    def __init__(self, path: Path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.skipping = 0
    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "svg", "code", "pre"}:
            self.skipping += 1
        if not self.skipping:
            for key, val in attrs:
                if key in {"aria-label", "alt", "placeholder", "title", "aria-description"} and val:
                    inspect_text(self.path, self.getpos()[0], f"atributo {key}", unescape(val))
                if key == "content" and val and not val.startswith(("http:", "https:")):
                    inspect_text(self.path, self.getpos()[0], "meta", unescape(val))
    def handle_endtag(self, tag):
        if tag in {"script", "style", "svg", "code", "pre"}:
            self.skipping = max(0, self.skipping - 1)
    def handle_data(self, data):
        if not self.skipping:
            inspect_text(self.path, self.getpos()[0], "visible", data)

TEXT_EXTENSIONS = {".html", ".htm", ".mjs", ".js", ".swift", ".kt", ".java", ".xml", ".strings", ".json"}
# Excluir archivos generados y minificados de terceros.
for path in ROOT.rglob("*"):
    if not path.is_file() or path.suffix.lower() not in TEXT_EXTENSIONS:
        continue
    if any(part in SKIP_DIRS for part in path.relative_to(ROOT).parts):
        continue
    if path.stat().st_size > 350000:
        continue
    try:
        content = path.read_text(encoding="utf-8")
    except (UnicodeError, OSError):
        continue
    SCANNED.append(str(path.relative_to(ROOT)))
    if path.suffix.lower() in {".html", ".htm"}:
        VisibleHTML(path).feed(content)
        continue
    # Literales probablemente expuestos: texto entrecomillado, sin rutas ni código desnudo.
    for n, line in enumerate(content.splitlines(), 1):
        if path.suffix.lower() == ".json" and len(line) > 2500:
            continue
        for fragment in re.findall(r'(?:"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\')', line):
            if len(fragment) > 8000 or "/" in fragment or "\\" in fragment:
                continue
            inspect_text(path, n, "literal", fragment[1:-1])

FINDINGS.sort(key=lambda f: (f["archivo"], f["linea"], f["hallado"]))
output = ROOT / "auditoria-ortografia.json"
output.write_text(json.dumps({
    "archivos_inspeccionados": len(SCANNED),
    "incidencias_candidatas": len(FINDINGS),
    "advertencia": "La detección automática no certifica ausencia de faltas. Revisar cada caso manualmente antes de corregir.",
    "hallazgos": FINDINGS,
}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
counts = Counter(f["hallado"].lower() for f in FINDINGS)
print(f"Archivos examinados: {len(SCANNED)}")
print(f"Incidencias candidatas: {len(FINDINGS)}")
print("Términos destacados:", ", ".join(f"{k}={v}" for k,v in counts.most_common(30)))
for f in FINDINGS[:130]:
    print(f'{f["archivo"]}:{f["linea"]}: {f["hallado"]} -> {f["propuesta"]} [{f["zona"]}]')
if len(FINDINGS) > 130:
    print(f"... otras {len(FINDINGS)-130} en auditoria-ortografia.json")
summary = os.environ.get("GITHUB_STEP_SUMMARY")
if summary:
    with open(summary, "a", encoding="utf-8") as sink:
        sink.write(f"## Auditoría ortográfica\n\n")
        sink.write(f"Archivos examinados: {len(SCANNED)}. Posibles errores: {len(FINDINGS)}.\n\n")
        sink.write("Ver el artefacto JSON para los casos y contexto. Los falsos positivos requieren revisión editorial.\n")
sys.exit(0)
