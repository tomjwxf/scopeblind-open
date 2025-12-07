import { Oprf, OPRFClient, Evaluation } from '@cloudflare/voprf-ts';

export class ScopeBlindVoprfClient {
    private client: OPRFClient;
    private finData: any; // Store finalize data between steps

    constructor() {
        // Initialize OPRF client with P256-SHA256 suite
        this.client = new OPRFClient(Oprf.Suite.P256_SHA256);
    }

    async generateBlindRequest(input: string): Promise<{ request: Uint8Array }> {
        const [finData, evalReq] = await this.client.blind([new TextEncoder().encode(input)]);
        this.finData = finData;
        return { request: evalReq.serialize() };
    }

    async finalize(evaluation: Uint8Array): Promise<Uint8Array> {
        const evalObj = Evaluation.deserialize(Oprf.Suite.P256_SHA256, evaluation);
        const tokens = await this.client.finalize(
            this.finData,
            evalObj
        );
        return tokens[0];
    }
}

export async function generateSpendProof(token: Uint8Array, data: string): Promise<string> {
    // Mock spend proof generation for now, as it requires DLEQ proofs which are complex
    // In a real implementation, this would use the token to sign the data
    // For now, we'll return a base64 string of the token + data hash
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    const combined = new Uint8Array(token.length + dataBytes.length);
    combined.set(token);
    combined.set(dataBytes, token.length);

    // Simple hash for mock proof
    const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return btoa(String.fromCharCode.apply(null, hashArray));
}
