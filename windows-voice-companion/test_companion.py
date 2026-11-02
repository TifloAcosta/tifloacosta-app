"""Tests for the intentionally limited localhost discovery endpoint."""
import http.client
import threading
import unittest
from http.server import ThreadingHTTPServer
from companion import Handler

class CompanionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, method, path="/health", origin=None, host=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        headers = {"Origin": origin} if origin else {}
        if host is not None:
            headers["Host"] = host
        connection.request(method, path, headers=headers)
        response = connection.getresponse()
        status, headers, body = response.status, dict(response.getheaders()), response.read()
        connection.close()
        return status, headers, body

    def test_allowed_site_can_read_only_health(self):
        status, headers, body = self.request("GET", origin="https://tifloacosta.com")
        self.assertEqual(status, 200)
        self.assertEqual(headers.get("Access-Control-Allow-Origin"), "https://tifloacosta.com")
        self.assertIn(b'"credentials_enabled": false', body)

    def test_other_origins_get_no_access(self):
        status, headers, _ = self.request("GET", origin="https://evil.example")
        self.assertEqual(status, 403)
        self.assertNotIn("Access-Control-Allow-Origin", headers)

    def test_no_origin_denied(self):
        status, _, _ = self.request("GET")
        self.assertEqual(status, 403)

    def test_rejects_dns_rebinding_host(self):
        status, _, body = self.request("GET", origin="https://tifloacosta.com", host="attacker.example")
        self.assertEqual(status, 403)
        self.assertIn(b"host_not_allowed", body)

    def test_mutation_never_enabled(self):
        status, _, body = self.request("POST", origin="https://tifloacosta.com")
        self.assertEqual(status, 405)
        self.assertIn(b"not_implemented", body)

if __name__ == "__main__":
    unittest.main()
