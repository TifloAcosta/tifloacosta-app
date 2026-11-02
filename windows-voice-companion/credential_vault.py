"""Windows DPAPI credential vault, available only to the local companion process.

Prototype library, NOT exposed over HTTP. Uses Windows CryptProtectData and
CryptUnprotectData with additional entropy. Never logs or returns secrets to web
clients. Requires Windows. No cross-user synchronization.
"""
import ctypes
from ctypes import wintypes
import os
from pathlib import Path
import struct

if os.name == "nt":
    crypt32 = ctypes.WinDLL("Crypt32.dll")
    kernel32 = ctypes.WinDLL("Kernel32.dll")
    class DATA_BLOB(ctypes.Structure):
        _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_byte))]
    crypt32.CryptProtectData.argtypes = [ctypes.POINTER(DATA_BLOB), wintypes.LPCWSTR,
        ctypes.POINTER(DATA_BLOB), ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD,
        ctypes.POINTER(DATA_BLOB)]
    crypt32.CryptProtectData.restype = wintypes.BOOL
    crypt32.CryptUnprotectData.argtypes = [ctypes.POINTER(DATA_BLOB), ctypes.c_void_p,
        ctypes.POINTER(DATA_BLOB), ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD,
        ctypes.POINTER(DATA_BLOB)]
    crypt32.CryptUnprotectData.restype = wintypes.BOOL
    kernel32.LocalFree.argtypes = [ctypes.c_void_p]
    kernel32.LocalFree.restype = ctypes.c_void_p

ENTROPY = b"TifloAcosta-Windows-Voice-Companion-v1"
PROVIDER_IDS = frozenset({"google", "elevenlabs", "azure", "polly"})

def _blob(data: bytes):
    buffer = ctypes.create_string_buffer(data)
    return DATA_BLOB(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_byte))), buffer

def _protect(data: bytes):
    if os.name != "nt":
        raise OSError("DPAPI storage is available only on Windows")
    source, keep = _blob(data)
    salt, keep_salt = _blob(ENTROPY)
    output = DATA_BLOB()
    if not crypt32.CryptProtectData(ctypes.byref(source), None, ctypes.byref(salt),
                                     None, None, 0, ctypes.byref(output)):
        raise ctypes.WinError()
    try:
        return ctypes.string_at(output.pbData, output.cbData)
    finally:
        kernel32.LocalFree(output.pbData)

def _unprotect(data: bytes):
    if os.name != "nt":
        raise OSError("DPAPI storage is available only on Windows")
    source, keep = _blob(data)
    salt, keep_salt = _blob(ENTROPY)
    output = DATA_BLOB()
    if not crypt32.CryptUnprotectData(ctypes.byref(source), None, ctypes.byref(salt),
                                       None, None, 0, ctypes.byref(output)):
        raise ctypes.WinError()
    try:
        return ctypes.string_at(output.pbData, output.cbData)
    finally:
        kernel32.LocalFree(output.pbData)

class CredentialVault:
    def __init__(self, directory=None):
        self.directory = Path(directory) if directory else Path(os.environ["LOCALAPPDATA"]) / "TifloAcosta" / "VoiceCompanion"

    def _path(self, provider):
        if provider not in PROVIDER_IDS:
            raise ValueError("Unsupported provider identifier")
        return self.directory / (provider + ".dpapi")

    def save(self, provider, secret):
        if not isinstance(secret, str) or not secret.strip():
            raise ValueError("Empty credential")
        destination = self._path(provider)
        destination.parent.mkdir(parents=True, exist_ok=True)
        encrypted = _protect(secret.encode("utf-8"))
        temporary = destination.with_suffix(".tmp")
        try:
            with open(temporary, "wb") as file:
                file.write(encrypted)
            os.replace(temporary, destination)
        finally:
            temporary.unlink(missing_ok=True)

    def load(self, provider):
        destination = self._path(provider)
        return _unprotect(destination.read_bytes()).decode("utf-8") if destination.exists() else None

    def remove(self, provider):
        self._path(provider).unlink(missing_ok=True)

    def configured(self, provider):
        return self._path(provider).is_file()
