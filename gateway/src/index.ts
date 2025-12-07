import { Hono } from 'hono';
import { cors } from 'hono/cors';

/**
 * ScopeBlind Gateway Template
 * 
 * This is a self-hosted gateway that sits in front of your API.
 * It verifies ScopeBlind proofs before forwarding requests to your backend.
 * 
 * Deploy to Cloudflare Workers with: npx wrangler deploy
 */

type Bindings = {
    BACKEND_URL: string;           // Your real API URL
    SCOPEBLIND_VERIFIER_URL: string; // ScopeBlind verifier endpoint
    SCOPEBLIND_SECRET?: string;    // Optional: for authenticating with verifier
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS middleware
app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-ScopeBlind-Proof', 'X-ScopeBlind-Token', 'Authorization'],
    maxAge: 86400,
}));

// Health check
app.get('/health', (c) => {
    return c.json({ status: 'ok', gateway: 'scopeblind-self-hosted' });
});

// Protected API routes
app.all('/api/*', async (c) => {
    const proofHeader = c.req.header('X-ScopeBlind-Proof');
    const tokenHeader = c.req.header('X-ScopeBlind-Token');

    // 1. Verify the ScopeBlind proof
    if (proofHeader || tokenHeader) {
        try {
            const verifierUrl = c.env.SCOPEBLIND_VERIFIER_URL || 'https://scopeblind-verifier-deterministic.tomjwxf.workers.dev';
            const verifyResponse = await fetch(`${verifierUrl}/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(c.env.SCOPEBLIND_SECRET ? { 'Authorization': `Bearer ${c.env.SCOPEBLIND_SECRET}` } : {})
                },
                body: JSON.stringify({
                    proof: proofHeader,
                    token: tokenHeader,
                    path: c.req.path,
                    method: c.req.method
                })
            });

            if (!verifyResponse.ok) {
                const err = await verifyResponse.text();
                console.error('[Gateway] Verification failed:', err);
                return c.json({ error: 'Invalid ScopeBlind proof', details: err }, 403);
            }

            const result = await verifyResponse.json();
            console.log('[Gateway] Proof verified:', result);
        } catch (verifyErr: any) {
            console.error('[Gateway] Verify error:', verifyErr);
            return c.json({ error: 'Verification service unavailable' }, 503);
        }
    } else {
        // No proof provided - reject or allow based on your policy
        // Option 1: Reject unauthenticated requests
        // return c.json({ error: 'ScopeBlind proof required' }, 401);

        // Option 2: Allow but mark as unprotected (e.g., for testing)
        console.log('[Gateway] No proof provided, allowing request');
    }

    // 2. Forward to your backend
    const backendUrl = c.env.BACKEND_URL;
    if (!backendUrl) {
        return c.json({ error: 'BACKEND_URL not configured' }, 500);
    }

    const targetUrl = new URL(c.req.path, backendUrl);
    targetUrl.search = new URL(c.req.url).search;

    // Copy headers, remove ScopeBlind ones
    const headers = new Headers();
    for (const [key, value] of c.req.raw.headers.entries()) {
        if (!key.toLowerCase().startsWith('x-scopeblind')) {
            headers.set(key, value);
        }
    }
    headers.set('Host', targetUrl.host);

    // Forward the request
    try {
        const response = await fetch(targetUrl.toString(), {
            method: c.req.method,
            headers,
            body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? c.req.raw.body : undefined
        });

        // Return response with CORS
        const responseHeaders = new Headers(response.headers);
        responseHeaders.set('Access-Control-Allow-Origin', '*');

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders
        });
    } catch (err: any) {
        console.error('[Gateway] Backend error:', err);
        return c.json({ error: 'Backend unreachable', details: err.message }, 502);
    }
});

export default app;
