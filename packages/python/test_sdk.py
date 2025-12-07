import sys
import os

# Add current directory to path so we can import scopeblind
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from scopeblind import ScopeBlindClient

def test_sdk():
    print("Initializing ScopeBlindClient...")
    client = ScopeBlindClient(site_id="test-site")
    
    # Mock a token since we can't hit the issuance API
    print("Injecting mock token...")
    client.token = b"mock_token_bytes_1234567890"
    
    print("Generating headers for POST /api/test...")
    headers = client.get_headers("POST", "/api/test")
    
    print("Headers generated:")
    print(headers)
    
    if "X-ScopeBlind-Proof" not in headers:
        print("FAIL: X-ScopeBlind-Proof header missing")
        sys.exit(1)
        
    if headers["X-ScopeBlind-Site"] != "test-site":
        print("FAIL: Incorrect site ID")
        sys.exit(1)
        
    print("SUCCESS: SDK verification passed!")

if __name__ == "__main__":
    test_sdk()
