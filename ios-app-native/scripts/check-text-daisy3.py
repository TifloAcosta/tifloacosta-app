"""Check DAISY 3 package relationships beyond DTD validation."""
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

root = Path(sys.argv[1])
opf, ncx, smil, book = [
    ET.parse(root / f"book.{ext}").getroot() for ext in ("opf", "ncx", "smil", "xml")
]
manifest = {item.attrib["id"]: item.attrib["href"] for item in opf.findall(".//{*}item")}
assert set(manifest.values()) == {path.name for path in root.iterdir()}
assert [manifest[item.attrib["idref"]] for item in opf.findall(".//{*}itemref")] == ["book.smil"]
assert opf.find(".//{*}meta[@name='dtb:multimediaType']").attrib["content"] == "textNCX"
uid = opf.find(".//{*}Identifier").text
for doc in (ncx, smil, book):
    assert doc.find(".//{*}meta[@name='dtb:uid']").attrib["content"] == uid
paragraphs = {item.attrib["id"]: item.attrib["smilref"] for item in book.iter() if "smilref" in item.attrib}
segments = {node.attrib["id"]: node.find("{*}text").attrib["src"] for node in smil.findall(".//{*}par")}
assert len(paragraphs) == len(segments)
assert all(paragraphs[src.removeprefix("book.xml#")] == f"book.smil#{key}" for key, src in segments.items())
points = ncx.findall(".//{*}navPoint")
assert [int(node.attrib["playOrder"]) for node in points] == list(range(1, len(points) + 1))
assert all(node.find("{*}content").attrib["src"].removeprefix("book.smil#") in segments for node in points)
assert points[0].find("{*}navPoint") is not None
assert smil.find(".//{*}audio") is None
for link in book.findall(".//{*}a"):
    if link.attrib["href"].startswith("#"):
        assert link.attrib["href"][1:] in paragraphs
print("DAISY 3: manifest, spine, identifier, navigation hierarchy and synchronization verified.")
