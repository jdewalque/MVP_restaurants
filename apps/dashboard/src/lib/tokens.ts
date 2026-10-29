import { decryptSecret, encryptSecret, parseEncryptionKey } from "@passaparola/shared/crypto";

function key() {
  return parseEncryptionKey(process.env.TOKEN_ENCRYPTION_KEY);
}

export function encryptToken(token: string): string {
  return encryptSecret(token, key());
}

export function decryptToken(encrypted: string): string {
  return decryptSecret(encrypted, key());
}
