# ScopeBlind Python SDK

Privacy-preserving rate limiting for Python applications, powered by VOPRF (RFC 9497).

## Features

- **🛡️ Privacy-First**: Uses VOPRF to blind tokens before sending them to the server.
- **⚡ High Performance**: Core cryptography implemented in Rust for maximum speed.
- **🤖 AI-Ready**: Includes a drop-in adapter for OpenAI and LangChain.

## Installation

```bash
pip install scopeblind
```

*Note: This package requires a Rust toolchain to build from source if a pre-built wheel is not available for your platform.*

## Usage

### Basic Usage

```python
from scopeblind import ScopeBlindClient

# Initialize client
client = ScopeBlindClient(api_key="sb_live_...")

# Make a protected request
# The client automatically handles token blinding, signing, and unblinding
response = client.request("POST", "https://api.yourservice.com/protected", json={"data": "foo"})

print(response.status_code)
```

### OpenAI / LangChain Integration

ScopeBlind provides a wrapper around the OpenAI client that automatically injects privacy-preserving proofs into every request. This is perfect for protecting LLM agents.

```python
from scopeblind import ScopeBlindOpenAI

# Initialize the wrapper
client = ScopeBlindOpenAI(
    api_key="sb_live_...",  # Your ScopeBlind API Key
    openai_api_key="sk-..." # Your OpenAI API Key
)

# Use it just like the standard OpenAI client
completion = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello world"}]
)

print(completion.choices[0].message.content)
```

### Manual Header Generation

If you use a different HTTP client (like `httpx` or `aiohttp`), you can generate the headers manually:

```python
headers = client.get_headers("POST", "/protected-endpoint")
# headers = {
#     "X-ScopeBlind-Proof": "...",
#     "X-ScopeBlind-Site": "..."
# }

# Use headers in your request
async with httpx.AsyncClient() as http:
    await http.post("...", headers=headers)
```

## Configuration

| Environment Variable | Description |
|----------------------|-------------|
| `SCOPEBLIND_API_KEY` | Your ScopeBlind API key (if not passed to constructor) |
| `SCOPEBLIND_ENV`     | `production` (default) or `development` |
