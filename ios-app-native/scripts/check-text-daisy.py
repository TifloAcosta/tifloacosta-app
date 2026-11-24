"""Verify navigation through NCC, SMIL and XHTML on generated text-only books."""
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

root = Path(sys.argv[1])
ncc = ET.parse(root / "ncc.html").getroot()
content = ET.parse(root / "book.xhtml").getroot()
seq = ET.parse(root / "book.smil").getroot().find("body/seq")
html = "{http://www.w3.org/1999/xhtml}"
metadata = {item.attrib["name"]: item.attrib["content"]
            for item in ncc.iter(html + "meta") if "name" in item.attrib}
book_ids = [item.attrib["id"] for item in content.iter() if "id" in item.attrib]
segments = list(seq)
smil_ids = [segment.attrib["id"] for segment in segments]
assert len(set(smil_ids)) == len(smil_ids)
assert len(set(book_ids)) == len(book_ids)
assert seq.attrib["dur"] == "0.0s" and metadata["ncc:multimediaType"] == "textNcc"
assert all(segment.tag == "par" and len(segment) == 1 and segment[0].tag == "text"
           for segment in segments)
assert [segment[0].attrib["src"] for segment in segments] == ["book.xhtml#" + item for item in book_ids]
entries = list(ncc.find(html + "body"))
assert len(entries) == int(metadata["ncc:tocItems"])
for entry in entries:
    assert entry.tag in {html + f"h{level}" for level in range(1, 7)}
    assert entry.find(html + "a").attrib["href"] in {"book.smil#" + item for item in smil_ids}
for link in content.iter(html + "a"):
    href = link.attrib["href"]
    if href.startswith("#"):
        assert href[1:] in book_ids, href
print("DAISY 2.02 text: NCC, SMIL reading order and all internal links resolve.")
