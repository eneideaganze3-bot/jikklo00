// Hash sécurisé des mots de passe avec PBKDF2 (Web Crypto API — natif aux
// Cloudflare Workers, aucune dépendance externe nécessaire).
// Jamais de mot de passe stocké en clair (règle #21 du cahier des charges).

const ITERATIONS = 100_000;
const KEY_LENGTH = 32; // bytes

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export function generateSalt(): string {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return toHex(salt.buffer);
}

export async function hashPassword(
  password: string,
  salt?: string
): Promise<{ hash: string; salt: string }> {
  const usedSalt = salt ?? generateSalt();
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: fromHex(usedSalt),
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    KEY_LENGTH * 8
  );
  return { hash: toHex(derivedBits), salt: usedSalt };
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string
): Promise<boolean> {
  const { hash } = await hashPassword(password, storedSalt);
  // Comparaison en temps constant pour éviter les attaques par timing
  if (hash.length !== storedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) {
    diff |= hash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return diff === 0;
}
