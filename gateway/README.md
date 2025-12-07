# ScopeBlind Gateway

Self-hosted gateway for verifying ScopeBlind proofs before forwarding requests to your API.

## Quick Start

```bash
# Install dependencies
npm install

# Copy example config
cp wrangler.example.toml wrangler.toml

# Edit wrangler.toml with your BACKEND_URL

# Deploy to Cloudflare
npx wrangler deploy
```

## Configuration

Edit `wrangler.toml`:

```toml
[vars]
BACKEND_URL = "https://your-api.example.com"
SCOPEBLIND_VERIFIER_URL = "https://scopeblind-verifier-deterministic.tomjwxf.workers.dev"
```

## How It Works

1. Client sends request to your gateway with `X-ScopeBlind-Proof` header
2. Gateway verifies the proof with ScopeBlind's verifier
3. If valid, request is forwarded to your `BACKEND_URL`
4. Your backend receives the original request (with ScopeBlind headers stripped)

## Integration with Client SDK

```javascript
import { ScopeBlindClient } from '@scopeblind/client';

const client = new ScopeBlindClient({ 
  siteId: 'your-site-id',
  issuerUrl: 'https://issuer.scopeblind.com'
});

// This request will include the ScopeBlind proof header
const response = await client.fetch('https://your-gateway.workers.dev/api/chat', {
  method: 'POST',
  body: JSON.stringify({ message: 'Hello' })
});
```
