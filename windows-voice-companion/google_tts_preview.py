"""Opt-in Gemini TTS preview from the local Windows process, never from web.

This may consume the user's Google quota or generate charges. No calls happen
on import. The CLI requires explicit confirmation before each request.
"""
import base64
import json
import io
import wave
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from credential_vault import CredentialVault

MODEL = "gemini-3.8-flash-lite-tts"
ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
MAX_CHARACTERS = 500
MAX_RESPONSE_BYTES = 8 * 1024 * 1024

class SynthesisError(Exception):
    pass

def _body(text, voice):
    if not isinstance(text, str) or not text.strip() or len(text) > MAX_CHARACTERS:
        raise ValueError("El texto debe tener entre 1 y 500 caracteres.")
    if voice not in ("Kore", "Puck", "Aoede", "Charon", "Fenrir"):
        raise ValueError("Voz no reconocida para esta prueba.")
    return {
        "contents": [{"role": "user", "parts": [{"text": text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "responseFormat": {"audio": {"mimeType": "AUDIO_L16", "sampleRate": 24000}},
            "speechConfig": {"voiceConfig": {"voice": voice}}
        }
    }

def synthesize(text, voice="Kore", vault=None, opener=urlopen):
    payload = _body(text, voice)
    key = (vault or CredentialVault()).load("google")
    if not key:
        raise SynthesisError("No hay clave de Google guardada en Windows.")
    request = Request(
        ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
        method="POST"
    )
    try:
        with opener(request, timeout=35) as response:
            response_bytes = response.read(MAX_RESPONSE_BYTES + 1)
            if len(response_bytes) > MAX_RESPONSE_BYTES:
                raise SynthesisError("La respuesta de audio es demasiado grande.")
    except (HTTPError, URLError, TimeoutError) as exc:
        # Do not expose response bodies, URLs, or secrets.
        raise SynthesisError("Google no completó la síntesis. Comprueba la cuota, los permisos o la conexión.") from None
    try:
        reply = json.loads(response_bytes)
        parts = reply["candidates"][0]["content"]["parts"]
        audio = next(part["inlineData"] for part in parts if "inlineData" in part)
        mime = audio.get("mimeType", "").lower()
        data = base64.b64decode(audio["data"], validate=True)
        if mime.startswith("audio/wav") or mime.startswith("audio/x-wav"):
            if not data.startswith(b"RIFF"):
                raise ValueError("Invalid WAV")
            return data
        if mime.startswith("audio/l16") or mime.startswith("audio/pcm"):
            if not data or len(data) % 2:
                raise SynthesisError("Google ha devuelto datos PCM incompletos.")
            with io.BytesIO() as stream:
                with wave.open(stream, "wb") as wav:
                    wav.setnchannels(1)
                    wav.setsampwidth(2)
                    wav.setframerate(24000)
                    wav.writeframes(data)
                return stream.getvalue()
        raise SynthesisError("Google ha devuelto un formato de audio no admitido por esta prueba.")
    except SynthesisError:
        raise
    except (ValueError, KeyError, TypeError, IndexError, StopIteration):
        raise SynthesisError("Google no devolvió un audio WAV válido.") from None

def main():
    import os
    if os.name != "nt":
        print("Esta prueba requiere Windows y el almacén de claves local.")
        return
    print("Prueba de síntesis de Google, independiente de TifloLector web.")
    print("Puede consumir cuota o generar cargos en tu cuenta Google.")
    text = input("Texto breve (máximo 500 caracteres): ")
    try:
        _body(text, "Kore")
        if input("¿Autorizar UNA solicitud a Google? Escribe AUTORIZO: ").strip() != "AUTORIZO":
            print("Cancelado. No se ha enviado ninguna solicitud.")
            return
        audio = synthesize(text)
        destination = Path.home() / "Music" / "TifloAcosta-prueba-Google.wav"
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(audio)
        print("Audio guardado en la carpeta Música con el nombre TifloAcosta-prueba-Google.wav.")
    except (SynthesisError, ValueError, OSError) as exc:
        print("No se pudo generar la muestra:", str(exc))

if __name__ == "__main__":
    main()
