"""One authenticated catalogue and one bounded media probe. No private data in logs."""
import os, sys, json, gzip, io, base64, urllib.request, urllib.parse, urllib.error, re

HOST = "https://audiocinemateca.com"
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

def main():
    user = os.environ.get("AUDIOCINEMATECA_USERNAME", "")
    password = os.environ.get("AUDIOCINEMATECA_PASSWORD", "")
    if not user or not password or ":" in user:
        raise ValueError("missing credentials")
    auth = "Basic " + base64.b64encode((user + ":" + password).encode()).decode()
    opener = urllib.request.build_opener(NoRedirect())
    def request(url, extra=None):
        p = urllib.parse.urlsplit(url)
        if p.scheme != "https" or p.netloc != "audiocinemateca.com" or p.fragment:
            raise ValueError("invalid origin")
        headers = {"Authorization": auth, "Accept-Encoding": "identity"}
        headers.update(extra or {})
        return opener.open(urllib.request.Request(url, headers=headers), timeout=40)
    def read_json(path, compressed_limit, decoded_limit):
        with request(HOST + path) as response:
            if response.status != 200:
                raise ValueError("unexpected catalogue status")
            data = response.read(compressed_limit + 1)
        if len(data) > compressed_limit:
            raise ValueError("compressed limit")
        with gzip.GzipFile(fileobj=io.BytesIO(data)) as stream:
            decoded = stream.read(decoded_limit + 1)
        if len(decoded) > decoded_limit:
            raise ValueError("decoded limit")
        return json.loads(decoded)
    version = read_json("/system/files/catalogo/version.json.gz", 262144, 1048576)
    if not isinstance(version, (dict, list)) or not version:
        raise ValueError("version invalid")
    print("Authenticated version: OK", flush=True)
    root = read_json("/system/files/catalogo/catalogo.json.gz", 32*1024*1024, 128*1024*1024)
    for category in ("peliculas", "series", "documentales", "cortometrajes"):
        if not isinstance(root.get(category), list):
            raise ValueError("category invalid")
        print(category + ": " + str(len(root[category])), flush=True)
    print("Authenticated catalogue: OK", flush=True)
    ref = next((link for row in root["peliculas"] for link in row.get("enlaces", []) if isinstance(link, str) and link and not link.startswith("//")), None)
    if not ref:
        raise ValueError("no sample")
    url = urllib.parse.urljoin(HOST + "/", ref)
    with request(url, {"Range": "bytes=0-4095"}) as response:
        print("Media HTTP " + str(response.status), flush=True)
        if response.status != 206:
            raise ValueError("range unsupported; body not read")
        match = re.fullmatch(r"bytes 0-(\d+)/(\d+)", response.headers.get("Content-Range", ""))
        if not match:
            raise ValueError("invalid range")
        end, total = map(int, match.groups())
        if end > 4095 or end >= total:
            raise ValueError("invalid bounds")
        data = response.read(4097)
        if len(data) != end + 1:
            raise ValueError("invalid length")
        print("Bounded media range: OK", flush=True)

if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as exc:
        print("HTTP failure: " + str(exc.code), file=sys.stderr)
        sys.exit(1)
    except Exception as exc:
        print("Diagnostic failed: " + type(exc).__name__, file=sys.stderr)
        sys.exit(1)
