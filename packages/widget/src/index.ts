import { ScopeBlindVoprfClient, generateSpendProof } from './voprf';
import { WidgetUI } from './ui';
import { getOrCreateDeviceIdentity, signRequest, type DeviceIdentity } from './holder-binding';

interface ScopeBlindConfig {
    siteId: string;        // Site ID (maps to origin server-side)
    issuerUrl?: string;    // Token issuance server (defaults to https://issuer.scopeblind.com)
    proxyUrl?: string;     // Proxy server for API calls (defaults to https://proxy.scopeblind.com)
    showBadge?: boolean;   // Show "Powered by ScopeBlind" badge
}

class ScopeBlindWidget {
    private config: ScopeBlindConfig;
    private voprfClient: ScopeBlindVoprfClient;
    private token: Uint8Array | null = null;
    private ui: WidgetUI;
    private deviceIdentity: DeviceIdentity | null = null;

    constructor() {
        this.config = { siteId: '' };
        this.voprfClient = new ScopeBlindVoprfClient();
        this.ui = new WidgetUI();
    }

    async init(config: ScopeBlindConfig) {
        this.config = {
            ...config,
            issuerUrl: config.issuerUrl || 'https://issuer.scopeblind.com',
            proxyUrl: config.proxyUrl || 'https://proxy.scopeblind.com',
            showBadge: config.showBadge !== false
        };
        console.log('[ScopeBlind] Initialized with site:', this.config.siteId);

        // Initialize device identity (holder binding)
        this.deviceIdentity = await getOrCreateDeviceIdentity();
        console.log('[ScopeBlind] Device identity:', this.deviceIdentity.type);

        if (this.config.showBadge) {
            this.ui.showBadge();
        }

        await this.ensureToken();
    }

    private async ensureToken() {
        if (this.token) return this.token;

        // Check localStorage
        const stored = localStorage.getItem(`sb_token_${this.config.siteId}`);
        if (stored) {
            this.token = new Uint8Array(JSON.parse(stored));
            return this.token;
        }

        // Mint new token
        try {
            console.log('[ScopeBlind] Minting new token...');

            // 1. Generate blind request
            const input = crypto.randomUUID();
            const { request } = await this.voprfClient.generateBlindRequest(input);

            // 2. Base64 URL encode the request (matches issuer API format)
            const evalReqB64 = btoa(String.fromCharCode(...request))
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            // 3. Send to issuance API (uses separate issuer domain)
            const response = await fetch(`${this.config.issuerUrl}/issue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ evalReqB64 })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Failed to issue token: ${response.status} - ${errText}`);
            }

            const { evalB64 } = await response.json();

            // 4. Decode evaluation from base64 URL
            const evalPadded = evalB64.replace(/-/g, '+').replace(/_/g, '/');
            const evalBytes = Uint8Array.from(atob(evalPadded), c => c.charCodeAt(0));

            // 5. Finalize
            this.token = await this.voprfClient.finalize(evalBytes);

            // Store
            localStorage.setItem(`sb_token_${this.config.siteId}`, JSON.stringify(Array.from(this.token)));
            console.log('[ScopeBlind] Token minted successfully');
            return this.token;
        } catch (err) {
            console.error('[ScopeBlind] Token issuance failed:', err);
            throw err;
        }
    }

    async getToken(): Promise<string> {
        const token = await this.ensureToken();
        return btoa(String.fromCharCode.apply(null, Array.from(token)));
    }

    public lastStats: { cryptoTime: number; networkTime: number; totalTime: number } | null = null;

    async fetch(url: string, options: RequestInit = {}): Promise<Response> {
        const totalStart = performance.now();
        let cryptoStart = 0;
        let cryptoEnd = 0;
        let networkStart = 0;

        try {
            cryptoStart = performance.now();
            await this.ensureToken();

            // Generate spend proof for this specific request
            const method = options.method || 'GET';
            const path = new URL(url, window.location.origin).pathname;
            const bodyString = options.body ? String(options.body) : null;

            const proof = await generateSpendProof(this.token!, `${method}:${path}`);

            // Route through proxy with site ID
            const targetUrl = `${this.config.proxyUrl}/${this.config.siteId}${path}`;

            const headers = new Headers(options.headers);
            headers.set('X-ScopeBlind-Proof', proof);
            headers.set('X-ScopeBlind-Site', this.config.siteId);

            // Add holder binding signature (if WebCrypto available)
            const signature = await signRequest(method, path, bodyString);
            if (signature) {
                headers.set('X-ScopeBlind-Signature', signature);
            } else if (this.deviceIdentity?.type === 'fallback' && this.deviceIdentity.deviceId) {
                // Fallback: Send device ID
                headers.set('X-ScopeBlind-Device', this.deviceIdentity.deviceId);
            }
            cryptoEnd = performance.now();

            networkStart = performance.now();
            const response = await fetch(targetUrl, {
                ...options,
                headers
            });
            const networkEnd = performance.now();

            this.lastStats = {
                cryptoTime: Math.round(cryptoEnd - cryptoStart),
                networkTime: Math.round(networkEnd - networkStart),
                totalTime: Math.round(networkEnd - totalStart)
            };

            if (response.status === 429 || response.status === 402) {
                this.ui.showQuotaExceeded();
            }

            return response;
        } catch (err) {
            console.error('[ScopeBlind] Fetch failed:', err);
            throw err;
        }
    }
}

// Expose global instance
const scopeblind = new ScopeBlindWidget();
(window as any).scopeblind = scopeblind;

// Auto-init if script tag has data attributes
const script = document.currentScript;
if (script) {
    const siteId = script.getAttribute('data-site');
    const proxyUrl = script.getAttribute('data-proxy');
    const showBadge = script.getAttribute('data-badge');

    if (siteId) {
        scopeblind.init({
            siteId,
            proxyUrl: proxyUrl || undefined,
            showBadge: showBadge !== 'false'
        }).then(() => {
            // Auto-detect data-scopeblind-action buttons after init
            initDataAttributes();
        });
    }
}

/**
 * Auto-detect and attach listeners to data-scopeblind-action buttons
 * Enables no-code integration for Webflow/WordPress users
 */
function initDataAttributes() {
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-scopeblind-action]').forEach(element => {
            const btn = element as HTMLElement;
            const action = btn.getAttribute('data-scopeblind-action');
            const cost = parseInt(btn.getAttribute('data-scopeblind-cost') || '1');

            if (!action) return;

            btn.addEventListener('click', async (e) => {
                e.preventDefault();

                try {
                    const response = await scopeblind.fetch(`/api/${action}`, {
                        method: 'POST',
                        headers: { 'X-ScopeBlind-Cost': cost.toString() }
                    });

                    // Dispatch custom event for customer to handle
                    btn.dispatchEvent(new CustomEvent('scopeblind:success', {
                        detail: { response, action, cost },
                        bubbles: true
                    }));
                } catch (err) {
                    btn.dispatchEvent(new CustomEvent('scopeblind:error', {
                        detail: { error: err, action, cost },
                        bubbles: true
                    }));
                }
            });
        });
    });
}

export default scopeblind;
