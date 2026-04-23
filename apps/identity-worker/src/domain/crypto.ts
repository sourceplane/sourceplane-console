export interface ParsedCredentialToken {
  kind: "api_key" | "session";
  recordId: string;
  secret: string;
  tokenPrefix: string;
}

export interface IssuedOpaqueToken {
  secretHash: string;
  token: string;
  tokenPrefix: string;
}

const textEncoder = new TextEncoder();

export class IdentityCrypto {
  private readonly keyPromise: Promise<CryptoKey>;

  constructor(secret: string) {
    this.keyPromise = crypto.subtle.importKey(
      "raw",
      textEncoder.encode(secret),
      {
        hash: "SHA-256",
        name: "HMAC"
      },
      false,
      ["sign"]
    );
  }

  async issueApiKeyToken(apiKeyId: string): Promise<IssuedOpaqueToken> {
    return this.issueOpaqueToken("api_key", `spk_${apiKeyId}`);
  }

  async issueLoginCode(): Promise<{ code: string; codeHash: string }> {
    const code = createNumericCode(6);

    return {
      code,
      codeHash: await this.hashValue("login_code", code)
    };
  }

  async issueSessionToken(sessionId: string): Promise<IssuedOpaqueToken> {
    return this.issueOpaqueToken("session", `sps_${sessionId}`);
  }

  async matchesApiKeySecret(secret: string, expectedHash: string): Promise<boolean> {
    return this.matchesHash("api_key", secret, expectedHash);
  }

  async matchesLoginCode(code: string, expectedHash: string): Promise<boolean> {
    return this.matchesHash("login_code", code, expectedHash);
  }

  async matchesSessionSecret(secret: string, expectedHash: string): Promise<boolean> {
    return this.matchesHash("session", secret, expectedHash);
  }

  parseCredentialToken(token: string): ParsedCredentialToken | null {
    const [tokenPrefix, secret, ...rest] = token.split(".");

    if (!tokenPrefix || !secret || rest.length > 0) {
      return null;
    }

    if (tokenPrefix.startsWith("sps_")) {
      return {
        kind: "session",
        recordId: tokenPrefix.slice(4),
        secret,
        tokenPrefix
      };
    }

    if (tokenPrefix.startsWith("spk_")) {
      return {
        kind: "api_key",
        recordId: tokenPrefix.slice(4),
        secret,
        tokenPrefix
      };
    }

    return null;
  }

  private async issueOpaqueToken(kind: "api_key" | "session", tokenPrefix: string): Promise<IssuedOpaqueToken> {
    const secret = createRandomSecret(32);

    return {
      secretHash: await this.hashValue(kind, secret),
      token: `${tokenPrefix}.${secret}`,
      tokenPrefix
    };
  }

  private async matchesHash(kind: "api_key" | "login_code" | "session", value: string, expectedHash: string): Promise<boolean> {
    const candidateHash = await this.hashValue(kind, value);

    return constantTimeEqual(candidateHash, expectedHash);
  }

  private async hashValue(kind: "api_key" | "login_code" | "session", value: string): Promise<string> {
    const key = await this.keyPromise;
    const digest = await crypto.subtle.sign("HMAC", key, textEncoder.encode(`${kind}:${value}`));

    return toBase64Url(new Uint8Array(digest));
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = textEncoder.encode(left);
  const rightBytes = textEncoder.encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < maxLength; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

function createNumericCode(length: number): string {
  const digits = new Uint32Array(length);
  crypto.getRandomValues(digits);

  return Array.from(digits, (digit) => String(digit % 10)).join("");
}

function createRandomSecret(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);

  return toBase64Url(bytes);
}

function toBase64Url(value: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...value));

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}