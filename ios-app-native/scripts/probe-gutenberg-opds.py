"""Single OPDS request, following Project Gutenberg's documented client rules."""
import json
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from urllib.parse import urlparse

URL = "https://www.gutenberg.org/ebooks/search.opds/"
req = urllib.request.Request(URL, headers={
    "User-Agent": "TifloAcosta/1.7 (tifloacosta@gmail.com)",
    "Accept": "application/atom+xml, application/opds+json, application/json",
})
try:
    with urllib.request.urlopen(req, timeout=25) as response:
        print("HTTP", response.status, "content type", response.headers.get("Content-Type"))
        assert urlparse(response.url).scheme == "https"
        data = response.read(5 * 1024 * 1024 + 1)
except urllib.error.HTTPError as error:
    print("Gutenberg HTTP", error.code, "Retry-After", error.headers.get("Retry-After", "not specified"))
    raise SystemExit(1)
except urllib.error.URLError as error:
    print("Connection failed:", error.reason)
    raise SystemExit(1)
assert len(data) <= 5 * 1024 * 1024, "OPDS feed too large"
if data.lstrip().startswith(b"{"):
    root = json.loads(data)
    print("OPDS JSON publications:", len(root.get("publications", [])), "navigation:", len(root.get("navigation", [])))
    assert root.get("publications") or root.get("navigation") or root.get("groups")
else:
    root = ET.fromstring(data)
    assert root.tag.split("}")[-1] == "feed", "Response is not an Atom feed"
    entries = root.findall("{*}entry")
    print("Atom catalogue entries:", len(entries))
    assert entries, "Catalogue is empty"
    acquisitions = [link for entry in entries for link in entry.findall("{*}link")
                    if link.get("rel", "") in ("http://opds-spec.org/acquisition", "http://opds-spec.org/acquisition/open-access")]
    print("Direct acquisition links:", len(acquisitions))
    if acquisitions:
        print("Acquisition schemes:", sorted({urlparse(link.get("href", "")).scheme for link in acquisitions}))
print("Official Gutenberg catalogue received; no additional requests or downloads made.")
