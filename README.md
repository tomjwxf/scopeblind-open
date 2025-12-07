# ScopeBlind SDK

**Cryptographic rate limiting without user tracking.**

ScopeBlind uses VOPRF (Verifiable Oblivious Pseudorandom Functions) to enforce quotas without storing any user data. Perfect for AI demos, anonymous trials, and abuse prevention.

> **Security Model**: The client SDK is fully open source and auditable. The verifier runs on our edge infrastructure — if you need a self-hosted option, [contact us](mailto:tommy@scopeblind.com).

## How It Works

1. **Client mints a token** (anonymous, unlinkable)
2. **Client generates a spend proof** for each action
3. **Your API verifies the proof** against the quota
4. **Zero PII stored** — just math

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│  Client  │ ──1──▶  │  Issuer  │         │ Your API │
│          │ ◀──2──  │          │         │          │
│          │ ─────────────3─────────────▶ │          │
│          │ ◀────────────4───────────── │          │
└──────────┘         └──────────┘         └──────────┘
     │                                          │
     │  Token (private)              Nullifier (unlinkable)
```

## Packages

### JavaScript Client SDK

```html
<script src="https://cdn.scopeblind.com/client.js"></script>
<script>
  const client = new ScopeBlindClient({ siteId: 'your-site-id' });
  
  // Mint token (once per epoch)
  await client.mintToken();
  
  // Generate proof for each request
  const proof = await client.generateProof('/api/chat');
  
  fetch('/api/chat', {
    headers: { 'X-ScopeBlind-Proof': proof }
  });
</script>
```

### Python SDK

```bash
pip install scopeblind
```

```python
from scopeblind import ScopeBlindClient

client = ScopeBlindClient(site_id="your-site-id")

# Automatic token management
response = client.request("POST", "https://your-api.com/chat", json={"message": "hi"})
```

## Verification

To verify proofs on your backend, use the ScopeBlind Verifier:

```javascript
import { verify } from '@scopeblind/verifier';

const result = await verify({
  proof: request.headers['x-scopeblind-proof'],
  action: 'chat',
  limit: 10,
  epochHours: 24
});

if (!result.allowed) {
  return Response.json({ error: 'Rate limited' }, { status: 429 });
}
```

## Architecture

| Component | Description |
|-----------|-------------|
| **Client SDK** | Mints tokens, generates spend proofs |
| **Issuer** | Signs blinded tokens (hosted by ScopeBlind) |
| **Verifier** | Validates proofs, tracks nullifiers |

The issuer never sees what action you're performing. The verifier only sees an unlinkable nullifier that resets each epoch.

## Privacy Guarantees

- **No cookies** — tokens are stored locally
- **No IP tracking** — nullifiers are derived cryptographically
- **No cross-epoch linking** — new nullifier each day
- **No user accounts required** — works anonymously

## Use Cases

- **AI Demo Protection** — Let users try your LLM demo without abuse
- **Anonymous Trials** — 10 free actions, no signup required
- **Agent Rate Limiting** — Works on scripts and bots, not just browsers
- **Privacy-First Products** — GDPR-compliant by design

## Getting Started

1. **Get a Site ID** at [scopeblind.com](https://scopeblind.com)
2. **Add the client SDK** to your frontend
3. **Add verification** to your API

See the [documentation](https://scopeblind.com/docs) for detailed integration guides.

## License

MIT

---

Built by [ScopeBlind](https://scopeblind.com) — Private rate limiting for the AI era.
