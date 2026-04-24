export interface ParsedInviteToken {
  inviteId: string;
  secret: string;
  tokenPrefix: string;
}

export interface IssuedInviteToken {
  secretHash: string;
  token: string;
}

const textEncoder = new TextEncoder();

export class MembershipCrypto {
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

  async issueInviteToken(inviteId: string): Promise<IssuedInviteToken> {
    const secret = createRandomSecret(32);

    return {
      secretHash: await this.hashInviteSecret(secret),
      token: `${createInviteTokenPrefix(inviteId)}.${secret}`
    };
  }

  async matchesInviteSecret(secret: string, expectedHash: string): Promise<boolean> {
    const candidateHash = await this.hashInviteSecret(secret);

    return constantTimeEqual(candidateHash, expectedHash);
  }

  parseInviteToken(token: string): ParsedInviteToken | null {
    const [tokenPrefix, secret, ...rest] = token.split(".");

    if (!tokenPrefix || !secret || rest.length > 0 || !tokenPrefix.startsWith("spi_")) {
      return null;
    }

    return {
      inviteId: tokenPrefix.slice(4),
      secret,
      tokenPrefix
    };
  }

  private async hashInviteSecret(secret: string): Promise<string> {
    const key = await this.keyPromise;
    const digest = await crypto.subtle.sign("HMAC", key, textEncoder.encode(`invite:${secret}`));

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

function createInviteTokenPrefix(inviteId: string): string {
  return `spi_${inviteId}`;
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
