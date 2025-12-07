import os
import json
import base64
import requests
import time
from urllib.parse import urlparse
from .voprf import ScopeBlindVoprfClient, generate_spend_proof

class ScopeBlindClient:
    def __init__(self, site_id: str, proxy_url: str = "https://proxy.scopeblind.com"):
        self.site_id = site_id
        self.proxy_url = proxy_url.rstrip('/')
        self.voprf_client = ScopeBlindVoprfClient()
        self.token = None
        self._token_file = f".sb_token_{site_id}"

    def _load_token(self):
        if os.path.exists(self._token_file):
            try:
                with open(self._token_file, 'r') as f:
                    data = json.load(f)
                    self.token = bytes(data)
            except Exception:
                pass

    def _save_token(self):
        if self.token:
            with open(self._token_file, 'w') as f:
                json.dump(list(self.token), f)

    def ensure_token(self):
        if self.token:
            return self.token

        self._load_token()
        if self.token:
            return self.token

        # Mint new token
        try:
            # 1. Generate blind request
            input_val = base64.b64encode(os.urandom(16)).decode('utf-8')
            blind_result = self.voprf_client.generate_blind_request(input_val)
            request_bytes = blind_result['request']

            # 2. Send to issuance API
            issuance_request = {
                "siteId": self.site_id,
                "request": list(request_bytes)
            }

            response = requests.post(
                f"{self.proxy_url}/issue",
                json=issuance_request,
                headers={"Content-Type": "application/json"}
            )
            response.raise_for_status()
            
            data = response.json()
            evaluation = bytes(data['evaluation'])

            # 3. Finalize
            self.token = self.voprf_client.finalize(evaluation)
            self._save_token()
            
            return self.token
        except Exception as e:
            print(f"[ScopeBlind] Token issuance failed: {e}")
            raise

    def get_headers(self, method: str, url: str, body: str = None) -> dict:
        """
        Generates the necessary headers for a ScopeBlind-protected request.
        """
        self.ensure_token()
        
        parsed = urlparse(url)
        path = parsed.path
        
        # Generate spend proof
        data_to_sign = f"{method.upper()}:{path}"
        proof = generate_spend_proof(self.token, data_to_sign)
        
        return {
            "X-ScopeBlind-Proof": proof,
            "X-ScopeBlind-Site": self.site_id
        }

    def request(self, method: str, url: str, **kwargs):
        """
        Wrapper around requests.request that automatically adds ScopeBlind headers.
        """
        headers = kwargs.pop('headers', {})
        
        # Add ScopeBlind headers
        sb_headers = self.get_headers(method, url, kwargs.get('data') or kwargs.get('json'))
        headers.update(sb_headers)
        
        # If using the proxy, rewrite the URL
        # For the Gateway wedge, we might hit the gateway directly or through the proxy.
        # The JS SDK rewrites to `${proxyUrl}/${siteId}${path}`.
        # Here we assume the user might want to hit their API directly if they are using the Gateway,
        # OR use the proxy if they are using the Widget backend.
        # For now, let's assume direct access but with headers, 
        # unless the user explicitly asks to use the proxy wrapper.
        
        return requests.request(method, url, headers=headers, **kwargs)
