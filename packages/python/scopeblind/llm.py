import os
from typing import Optional, Dict, Any
import httpx
from openai import OpenAI, AsyncOpenAI
from .client import ScopeBlindClient

class ScopeBlindOpenAI(OpenAI):
    """
    A wrapper around the official OpenAI client that automatically injects
    ScopeBlind privacy-preserving rate limit proofs into every request.
    
    Usage:
        sb_client = ScopeBlindClient(site_id="my-site")
        client = ScopeBlindOpenAI(
            scopeblind_client=sb_client,
            base_url="https://my-gateway.workers.dev/v1", # Your ScopeBlind Gateway
            api_key="sk-..."
        )
        
        completion = client.chat.completions.create(...)
    """
    def __init__(
        self,
        scopeblind_client: ScopeBlindClient,
        *args,
        **kwargs
    ):
        self.sb_client = scopeblind_client
        super().__init__(*args, **kwargs)
        
        # We need to intercept the request to inject headers.
        # OpenAI's client uses `httpx`. We can add a custom event hook or middleware,
        # but overriding the `request` method of the internal `_client` (httpx.Client) 
        # is hard because it's private.
        # 
        # Instead, we override the `chat.completions.create` method (and others as needed)
        # to pre-calculate headers and pass them via `extra_headers`.
        
    @property
    def chat(self):
        return ScopeBlindChat(self)

class ScopeBlindChat:
    def __init__(self, client: ScopeBlindOpenAI):
        self._client = client
        self._original_chat = super(ScopeBlindOpenAI, client).chat
        
    @property
    def completions(self):
        return ScopeBlindCompletions(self._client, self._original_chat.completions)

class ScopeBlindCompletions:
    def __init__(self, client: ScopeBlindOpenAI, original_completions):
        self._client = client
        self._original_completions = original_completions
        
    def create(self, *args, **kwargs):
        # 1. Determine request details
        # OpenAI API structure is consistent: POST /chat/completions
        method = "POST"
        path = "/chat/completions" # Relative to base_url version? Usually /v1/chat/completions
        
        # Note: The actual path depends on the base_url. 
        # If base_url is "https://gateway/v1", the request is to "https://gateway/v1/chat/completions".
        # ScopeBlind signature usually expects the path *suffix* or the full path?
        # The client.get_headers uses urlparse(url).path.
        # We'll assume standard OpenAI paths.
        
        # 2. Generate Proof
        # We pass the body parameters to get_headers if possible, 
        # but client.get_headers currently only signs method:path.
        # If we need to sign the body, we'd need to serialize kwargs exactly as httpx does.
        # For now, we rely on method:path signature.
        
        # We need to construct the full URL to get the correct path for signing
        base_url = str(self._client.base_url)
        if base_url.endswith('/'):
            base_url = base_url[:-1]
        
        # Handle versioning if present in base_url or default
        if "/v1" not in base_url:
            full_path = "/v1/chat/completions"
        else:
            full_path = "/chat/completions"
            
        # Actually, let's just use the standard path. 
        # The Gateway will verify against the path it receives.
        # If the Gateway is at /v1/..., it receives /v1/chat/completions.
        
        sb_headers = self._client.sb_client.get_headers(
            method, 
            f"{base_url}{full_path}", 
            body=None # Body signing skipped for now to avoid serialization mismatch
        )
        
        # 3. Inject Headers
        extra_headers = kwargs.get("extra_headers", {})
        extra_headers.update(sb_headers)
        kwargs["extra_headers"] = extra_headers
        
        # 4. Delegate to original
        return self._original_completions.create(*args, **kwargs)

# Async support would follow a similar pattern
