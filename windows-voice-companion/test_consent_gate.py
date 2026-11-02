import unittest
from consent_gate import ConsentGate

class ConsentTests(unittest.TestCase):
    def test_requires_explicit_local_approval_and_one_use(self):
        gate=ConsentGate()
        self.assertFalse(gate.consume("not-a-token","google","connect"))
        token=gate.approve_locally("google","connect")
        self.assertTrue(gate.consume(token,"google","connect"))
        self.assertFalse(gate.consume(token,"google","connect"))

    def test_wrong_provider_or_operation_fails_and_consumes_token(self):
        gate=ConsentGate()
        token=gate.approve_locally("google","connect")
        self.assertFalse(gate.consume(token,"azure","connect"))
        self.assertFalse(gate.consume(token,"google","connect"))

    def test_expiration(self):
        current=[0.0]
        gate=ConsentGate(lifetime_seconds=10,clock=lambda: current[0])
        token=gate.approve_locally("google","preview")
        current[0]=10.0
        self.assertFalse(gate.consume(token,"google","preview"))

    def test_revoke(self):
        gate=ConsentGate()
        token=gate.approve_locally("google","connect")
        gate.revoke_all()
        self.assertFalse(gate.consume(token,"google","connect"))

if __name__=="__main__":
    unittest.main()
