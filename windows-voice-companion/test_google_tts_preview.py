import unittest
import base64
import json
import struct
import wave
import io
from google_tts_preview import _body, SynthesisError, synthesize

class GoogleTests(unittest.TestCase):
    def test_request_voice_schema(self):
        config = _body("Hola", "Kore")["generationConfig"]
        self.assertEqual(config["speechConfig"]["voiceConfig"]["voice"], "Kore")
        self.assertEqual(config["responseFormat"]["audio"], {"mimeType": "AUDIO_L16", "sampleRate": 24000})

    def test_pcm_audio_returns_wav(self):
        pcm = struct.pack("<hhhh", 0, 120, -120, 0)
        response = {"candidates": [{"content": {"parts": [{"inlineData": {
            "mimeType": "audio/l16;rate=24000",
            "data": base64.b64encode(pcm).decode()
        }}]}}]}
        class FakeResponse:
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def read(self, _): return json.dumps(response).encode()
        class Vault:
            def load(self, _): return "fake-key"
        result = synthesize("Hola", vault=Vault(), opener=lambda *a, **kw: FakeResponse())
        with wave.open(io.BytesIO(result), "rb") as wav:
            self.assertEqual((wav.getnchannels(), wav.getsampwidth(), wav.getframerate()), (1, 2, 24000))
            self.assertEqual(wav.readframes(4), pcm)

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
