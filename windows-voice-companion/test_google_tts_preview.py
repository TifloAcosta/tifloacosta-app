import unittest
from google_tts_preview import _body, SynthesisError, synthesize

class GoogleTests(unittest.TestCase):
    def test_empty_text(self):
        with self.assertRaises(ValueError):
            _body("", "Kore")

    def test_large_text(self):
        with self.assertRaises(ValueError):
            _body("a"*501, "Kore")

    def test_invalid_voice(self):
        with self.assertRaises(ValueError):
            _body("Hola", "unknown")

    def test_missing_key(self):
        class EmptyVault:
            def load(self, provider):
                return None
        with self.assertRaises(SynthesisError):
            synthesize("Hola", vault=EmptyVault())

if __name__ == "__main__":
    unittest.main()
