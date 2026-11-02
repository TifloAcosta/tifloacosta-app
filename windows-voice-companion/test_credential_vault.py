"""Credential vault tests; Windows-only encryption roundtrip is skipped elsewhere."""
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from credential_vault import CredentialVault

class VaultTests(unittest.TestCase):
    def test_invalid_provider_rejected(self):
        with tempfile.TemporaryDirectory() as root:
            vault = CredentialVault(root)
            with self.assertRaises(ValueError):
                vault.configured("../escape")
            with self.assertRaises(ValueError):
                vault.remove("unexpected")

    def test_empty_secret_rejected(self):
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaises(ValueError):
                CredentialVault(root).save("google", "")

    @unittest.skipUnless(os.name == "nt", "DPAPI requires Windows")
    def test_encrypted_roundtrip_per_user(self):
        with tempfile.TemporaryDirectory() as root:
            vault = CredentialVault(root)
            vault.save("google", "test-key-not-real")
            self.assertTrue(vault.configured("google"))
            self.assertNotIn(b"test-key-not-real", (Path(root) / "google.dpapi").read_bytes())
            self.assertEqual(vault.load("google"), "test-key-not-real")
            vault.remove("google")
            self.assertFalse(vault.configured("google"))

if __name__ == "__main__":
    unittest.main()
