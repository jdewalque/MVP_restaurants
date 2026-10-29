import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret, parseEncryptionKey } from "./crypto";
import { suggestRestaurant } from "./matching";

const restaurants = [
  { id: "r1", name: "Trattoria Isola", instagramHandle: "@trattoria.isola" },
  { id: "r2", name: "Pho Nolo", instagramHandle: "pho_nolo" },
  { id: "r3", name: "Bar", instagramHandle: null },
];

describe("suggestRestaurant", () => {
  it("matches an @mention of the restaurant handle", () => {
    expect(suggestRestaurant("Cena top da @trattoria.isola. #milano", restaurants)).toEqual({ restaurantId: "r1", reason: "mention" });
  });

  it("matches the restaurant name, ignoring case and accents", () => {
    expect(suggestRestaurant("Il miglior brodo è da PHÒ NOLO!", restaurants)).toEqual({ restaurantId: "r2", reason: "name" });
  });

  it("returns null when nothing or several restaurants match", () => {
    expect(suggestRestaurant("Pranzo a Milano", restaurants)).toBeNull();
    expect(suggestRestaurant("Trattoria Isola poi Pho Nolo", restaurants)).toBeNull();
    expect(suggestRestaurant(null, restaurants)).toBeNull();
  });
});

describe("token encryption", () => {
  it("round-trips and uses a random IV", () => {
    const key = parseEncryptionKey(randomBytes(32).toString("base64"));
    const a = encryptSecret("EAAG-token", key);
    expect(a).not.toContain("EAAG");
    expect(a).not.toBe(encryptSecret("EAAG-token", key));
    expect(decryptSecret(a, key)).toBe("EAAG-token");
  });

  it("rejects a key of the wrong size or a tampered value", () => {
    expect(() => parseEncryptionKey("dG9vIHNob3J0")).toThrow(/32 bytes/);
    const key = parseEncryptionKey(randomBytes(32).toString("hex"));
    const [v, iv, tag, data] = encryptSecret("secret", key).split(":");
    expect(() => decryptSecret([v, iv, tag, `${data![0] === "A" ? "B" : "A"}${data!.slice(1)}`].join(":"), key)).toThrow();
  });
});
