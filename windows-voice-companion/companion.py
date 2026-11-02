"""Prototype of the Windows TifloAcosta voice companion.

Discovery only: no keys, document text, provider calls, or audio.
Use Python 3.11+ for local development. This is NOT an end-user installer.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json

HOST = "127.0.0.1"
PORT = 38761
ALLOWED_ORIGINS = frozenset({
    "https://tifloacosta.com",
    "https://www.tifloacosta.com",
})

class Handler(BaseHTTPRequestHandler):
    def _origin_allowed(self):
        return self.headers.get("Origin", "") in ALLOWED_ORIGINS

    def _headers(self, status, content_type="application/json; charset=utf-8"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Vary", "Origin")
        if self._origin_allowed():
            self.send_header("Access-Control-Allow-Origin", self.headers["Origin"])
        self.end_headers()

    def do_GET(self):
        if self.path != "/health":
            self._headers(404)
            self.wfile.write(b'{"error":"not_found"}')
            return
        if not self._origin_allowed():
            self._headers(403)
            self.wfile.write(b'{"error":"origin_not_allowed"}')
            return
        self._headers(200)
        self.wfile.write(json.dumps({
            "app": "TifloAcosta Voice Companion",
            "api_version": 1,
            "stage": "discovery_only",
            "credentials_enabled": False,
            "providers_enabled": False,
        }).encode("utf-8"))

    def do_POST(self):
        self._headers(405)
        self.wfile.write(b'{"error":"not_implemented"}')

    def do_OPTIONS(self):
        self._headers(405)
        self.wfile.write(b'{"error":"not_implemented"}')

    def log_message(self, format, *args):
        # No request details (including any future sensitive values) in logs.
        pass


def main():
    with ThreadingHTTPServer((HOST, PORT), Handler) as server:
        print("TifloAcosta Voice Companion: prueba local de detección activa.")
        print("Solo está habilitado /health. No introduzca claves API.")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass

if __name__ == "__main__":
    main()
