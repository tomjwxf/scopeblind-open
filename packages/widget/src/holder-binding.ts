/**
 * Holder Binding: Binds tokens to device-specific keypairs
 * Prevents token farming and reselling
 */

export interface DeviceIdentity {
    type: 'webcrypto' | 'fallback';
    publicKey?: Uint8Array;
    deviceId?: string;
}

/**
 * Generate or retrieve device-bound keypair
 * Uses WebCrypto with extractable: false for security
 * Falls back to device ID if WebCrypto unavailable
 */
export async function getOrCreateDeviceIdentity(): Promise<DeviceIdentity> {
    // Try WebCrypto first (strong binding)
    if (window.crypto?.subtle) {
        try {
            return await getWebCryptoIdentity();
        } catch (err) {
            console.warn('[ScopeBlind] WebCrypto failed, falling back to device ID:', err);
        }
    }

    // Fallback: Device ID (weaker, but works everywhere)
    return getFallbackIdentity();
}

/**
 * WebCrypto-based identity (strong binding)
 * Private key is non-extractable and cannot leave the browser
 */
async function getWebCryptoIdentity(): Promise<DeviceIdentity> {
    const DB_NAME = 'scopeblind';
    const STORE_NAME = 'identity';

    // Open IndexedDB
    const db = await openDB(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        }
    });

    // Check for existing keypair
    let publicKeyBytes = await db.get(STORE_NAME, 'publicKey');

    if (!publicKeyBytes) {
        // Generate new keypair
        const keypair = await crypto.subtle.generateKey(
            {
                name: 'ECDSA',
                namedCurve: 'P-256'
            },
            false, // ← CRITICAL: non-extractable (private key cannot be exported)
            ['sign', 'verify']
        );

        // Export and store public key
        const publicKey = await crypto.subtle.exportKey('spki', keypair.publicKey);
        publicKeyBytes = new Uint8Array(publicKey);
        await db.put(STORE_NAME, publicKeyBytes, 'publicKey');

        // Store private key reference (CryptoKey object, not the key itself)
        // This persists across page reloads within the same origin
        await db.put(STORE_NAME, keypair.privateKey, 'privateKey');
    }

    return {
        type: 'webcrypto',
        publicKey: publicKeyBytes
    };
}

/**
 * Fallback identity (weaker binding)
 * Uses random device ID stored in localStorage
 */
function getFallbackIdentity(): DeviceIdentity {
    const STORAGE_KEY = 'sb_device_id';

    let deviceId = localStorage.getItem(STORAGE_KEY);
    if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem(STORAGE_KEY, deviceId);
    }

    return {
        type: 'fallback',
        deviceId
    };
}

/**
 * Sign a request using the device's private key
 * Only works with WebCrypto identity
 */
export async function signRequest(
    method: string,
    path: string,
    body: string | null
): Promise<string | null> {
    const DB_NAME = 'scopeblind';
    const STORE_NAME = 'identity';

    try {
        const db = await openDB(DB_NAME, 1);
        const privateKey = await db.get(STORE_NAME, 'privateKey');

        if (!privateKey) {
            return null; // No WebCrypto identity
        }

        // Create canonical request string
        const canonical = `${method}:${path}:${body || ''}`;
        const encoder = new TextEncoder();
        const data = encoder.encode(canonical);

        // Sign with private key
        const signature = await crypto.subtle.sign(
            {
                name: 'ECDSA',
                hash: 'SHA-256'
            },
            privateKey,
            data
        );

        // Return base64-encoded signature
        return btoa(String.fromCharCode(...new Uint8Array(signature)));
    } catch (err) {
        console.error('[ScopeBlind] Signing failed:', err);
        return null;
    }
}

/**
 * Helper for IndexedDB operations
 */
interface IDBWrapper {
    get(storeName: string, key: string): Promise<any>;
    put(storeName: string, value: any, key: string): Promise<void>;
}

function wrapDB(db: IDBDatabase): IDBWrapper {
    return {
        get(storeName: string, key: string): Promise<any> {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(storeName, 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.get(key);

                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
            });
        },

        put(storeName: string, value: any, key: string): Promise<void> {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.put(value, key);

                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            });
        }
    };
}

/**
 * Open IndexedDB with helper methods
 */
async function openDB(
    name: string,
    version: number,
    options?: { upgrade?: (db: IDBDatabase) => void }
): Promise<IDBDatabase & IDBWrapper> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name, version);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            if (options?.upgrade) {
                options.upgrade((event.target as IDBOpenDBRequest).result);
            }
        };
    });

    return Object.assign(db, wrapDB(db));
}
