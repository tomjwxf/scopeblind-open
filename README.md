# ScopeBlind Open Source

Cryptographic rate limiting without CAPTCHAs, Redis, or user tracking.

## What is ScopeBlind?

ScopeBlind enforces per-user rate limits using **VOPRF cryptography** (the same protocol behind Privacy Pass). Users prove they haven't exceeded their quota without revealing who they are.

- **Privacy-first** — Zero PII stored or transmitted
- **Agent-friendly** — Works for browsers, CLIs, bots, and AI agents
- **Serverless** — No database required, runs at the edge

## Packages

### [`packages/client`](./packages/client) — JavaScript SDK
The core client library for minting tokens and generating proofs.

```bash
npm install @scopeblind/client
```

```javascript
import { ScopeBlindClient } from '@scopeblind/client';

const client = new ScopeBlindClient({ siteId: 'your-site-id' });
const response = await client.fetch('/api/protected', {
  method: 'POST',
  body: JSON.stringify({ data: '...' })
});
```

### [`packages/widget`](./packages/widget) — Embeddable Widget
Drop-in protection for any website with a single script tag.

```html
<script src="https://scopeblind.com/widget.js" data-site="YOUR_SITE_ID"></script>
<script>
  // All requests include ScopeBlind proofs automatically
  const response = await scopeblind.fetch('/api/chat', { method: 'POST', body: '...' });
</script>
```

### [`packages/python`](./packages/python) — Python SDK
For server-side token generation and verification.

```bash
pip install scopeblind
```

### [`gateway/`](./gateway) — Self-Hosted Gateway Template
Deploy your own gateway to verify ScopeBlind proofs before forwarding to your API.

```bash
cd gateway
cp wrangler.example.toml wrangler.toml
# Edit BACKEND_URL
npx wrangler deploy
```

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Client    │────▶│  ScopeBlind      │────▶│  Your API    │
│   (SDK)     │     │  (Issuer/Proxy)  │     │              │
└─────────────┘     └──────────────────┘     └──────────────┘
                            │
        1. Blind token      │  2. Verify proof
        3. Proxy request    │  4. Enforce quota
                            ▼
                    ┌──────────────┐
                    │   Verifier   │
                    └──────────────┘
```

## How It Works

1. **Client mints token** — Blinded, so the issuer sees nothing about the user
2. **Client generates proof** — Cryptographic proof attached to API requests
3. **Gateway/Proxy verifies** — Proof checked without learning user identity
4. **Quota enforced** — User-specific limits without tracking users

## Integration Options

| Option | Who Hosts | Effort | Best For |
|--------|-----------|--------|----------|
| **Widget** | ScopeBlind | 2 min | Websites, quick onboarding |
| **Gateway** | You | 10 min | Full control, LLMs, agents |
| **SDK** | You | 30 min | Custom integrations |

## Documentation

Full documentation available at [scopeblind.com/docs](https://scopeblind.com/docs)

## License

MIT License - see [LICENSE](./LICENSE)

## Support

- 📧 Email: tommy@scopeblind.com
- 🐛 Issues: [GitHub Issues](https://github.com/tomjwxf/scopeblind-open/issues)
- 📖 Docs: [scopeblind.com/docs](https://scopeblind.com/docs)
