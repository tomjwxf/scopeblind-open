import os
import base64
import hashlib

try:
    import scopeblind_voprf
    HAS_RUST_VOPRF = True
except ImportError:
    HAS_RUST_VOPRF = False
    print("[ScopeBlind] WARNING: Rust VOPRF extension not found. Using MOCK implementation (INSECURE).")

class ScopeBlindVoprfClient:
    def __init__(self):
        self.state = None

    def generate_blind_request(self, input_str: str) -> dict:
        if HAS_RUST_VOPRF:
            # Rust extension returns (request_bytes, state_bytes)
            request_bytes, state_bytes = scopeblind_voprf.blind(input_str)
            self.state = state_bytes
            self.input = input_str # Store input for finalize
            return {"request": request_bytes}
        else:
            # Mock implementation
            mock_request = os.urandom(32)
            return {"request": mock_request}

    def finalize(self, evaluation: bytes) -> bytes:
        if HAS_RUST_VOPRF:
            if not self.state:
                raise ValueError("No state found. Call generate_blind_request first.")
            # Use unblind_with_input
            return bytes(scopeblind_voprf.unblind_with_input(self.input, list(evaluation), list(self.state)))
        else:
            # Mock implementation
            return evaluation

def generate_spend_proof(token: bytes, data: str) -> str:
    if HAS_RUST_VOPRF:
        # Use Rust extension for DLEQ proof (TODO: Implement DLEQ in Rust)
        # For now, the Rust extension returns a TODO string, so we fallback to mock hash
        # to keep the SDK functional until DLEQ is ready.
        # proof = scopeblind_voprf.generate_proof(list(token), data)
        # return proof
        pass
    
    # Mock/Simple proof (SHA256 of token+data) matches current JS SDK behavior for now
    # The server expects DLEQ, so this will fail against production server
    # but works for structure verification.
    encoder = data.encode('utf-8')
    combined = token + encoder
    
    digest = hashlib.sha256(combined).digest()
    return base64.b64encode(digest).decode('utf-8')
