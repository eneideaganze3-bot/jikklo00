// JSON Web Token minimal, signé en HMAC-SHA256 via Web Crypto.
// Pas de dépendance externe — fonctionne nativement sur Cloudflare Workers.

function base64UrlEncode(data: string): string {
  return btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(data: string): string {
  data = data.replace(/-/g, "+").replace(/_/g, "/");
  while (data.length % 4) data += "=";
  return atob(data);
}

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export type JwtPayload = {
  sub: string; // user id
  role: string;
  exp: number; // unix timestamp (secondes)
  [key: string]: unknown;
};

const EXPIRY_SECONDS = 60 * 60 * 24 * 7; // 7 jours

export async function signJwt(
  payload: Omit<JwtPayload, "exp">,
  secret: string
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const fullPayload: JwtPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + EXPIRY_SECONDS,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const toSign = `${encodedHeader}.${encodedPayload}`;

  const key = await getKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(toSign)
  );
  const encodedSignature = base64UrlEncode(
    String.fromCharCode(...new Uint8Array(signature))
  );

  return `${toSign}.${encodedSignature}`;
}

export async function verifyJwt(
  token: string,
  secret: string
): Promise<JwtPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  const key = await getKey(secret);
  const signatureBytes = Uint8Array.from(
    base64UrlDecode(encodedSignature),
    (c) => c.charCodeAt(0)
  );

  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
  );
  if (!valid) return null;

  const payload: JwtPayload = JSON.parse(base64UrlDecode(encodedPayload));
  if (payload.exp < Math.floor(Date.now() / 1000)) return null; // expiré

  return payload;
}
