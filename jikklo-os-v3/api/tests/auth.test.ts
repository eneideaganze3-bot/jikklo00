import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../src/lib/password";
import { signJwt, verifyJwt } from "../src/lib/jwt";

describe("password hashing", () => {
  it("hash un mot de passe et le vérifie correctement", async () => {
    const { hash, salt } = await hashPassword("MonMotDePasse123!");
    expect(await verifyPassword("MonMotDePasse123!", hash, salt)).toBe(true);
  });
  it("rejette un mauvais mot de passe", async () => {
    const { hash, salt } = await hashPassword("MonMotDePasse123!");
    expect(await verifyPassword("Mauvais", hash, salt)).toBe(false);
  });
  it("ne stocke jamais le mot de passe en clair", async () => {
    const { hash } = await hashPassword("MonMotDePasse123!");
    expect(hash).not.toContain("MonMotDePasse123!");
  });
});

describe("JWT", () => {
  const secret = "test-secret-do-not-use-in-production";
  it("signe et vérifie un token valide", async () => {
    const token = await signJwt({ sub: "user_123", role: "admin" }, secret);
    const payload = await verifyJwt(token, secret);
    expect(payload?.sub).toBe("user_123");
  });
  it("rejette un token signé avec un secret différent", async () => {
    const token = await signJwt({ sub: "user_123", role: "admin" }, secret);
    expect(await verifyJwt(token, "autre-secret")).toBeNull();
  });
});
