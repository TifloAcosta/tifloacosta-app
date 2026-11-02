"""Local consent gate for future sensitive voice operations.

An explicit local approval issues a random, short-lived capability. Neither
the browser nor GET /health can grant themselves authorization.
This module is not yet connected to the HTTP service.
"""
import secrets
import time

class ConsentGate:
    def __init__(self, lifetime_seconds=300, clock=time.monotonic):
        self.lifetime_seconds = lifetime_seconds
        self.clock = clock
        self._tokens = {}

    def approve_locally(self, provider, operation):
        if provider not in {"google", "elevenlabs", "azure", "polly"}:
            raise ValueError("Unknown provider")
        if operation not in {"connect", "preview", "synthesize", "disconnect"}:
            raise ValueError("Unknown operation")
        token = secrets.token_urlsafe(32)
        self._tokens[token] = (provider, operation, self.clock() + self.lifetime_seconds)
        return token

    def consume(self, token, provider, operation):
        if not isinstance(token, str):
            return False
        record = self._tokens.pop(token, None)
        if record is None:
            return False
        expected_provider, expected_operation, expiry = record
        return (secrets.compare_digest(expected_provider, provider)
                and secrets.compare_digest(expected_operation, operation)
                and self.clock() < expiry)

    def revoke_all(self):
        self._tokens.clear()
