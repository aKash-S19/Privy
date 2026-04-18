import { p256 } from '@noble/curves/nist.js';
import * as ExpoCrypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { decryptMessage, deriveSharedKey, encryptMessage } from '@/lib/e2ee';

const GROUP_KEY_PREFIX = 'privy_group_key';

function toB64(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function keyStoreName(groupId: string, keyVersion: number): string {
  // SecureStore keys allow only alphanumeric, dot, hyphen, underscore.
  const safeGroupId = groupId.replace(/[^A-Za-z0-9._-]/g, '_');
  return `${GROUP_KEY_PREFIX}_${safeGroupId}_${keyVersion}`;
}

function legacyKeyStoreName(groupId: string, keyVersion: number): string {
  return `${GROUP_KEY_PREFIX}:${groupId}:${keyVersion}`;
}

function isValidSecureStoreKey(key: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(key);
}

export function randomGroupKeyB64(): string {
  return toB64(ExpoCrypto.getRandomBytes(32));
}

export async function saveGroupKey(groupId: string, keyVersion: number, keyB64: string): Promise<void> {
  await SecureStore.setItemAsync(keyStoreName(groupId, keyVersion), keyB64);
}

export async function loadGroupKey(groupId: string, keyVersion: number): Promise<string | null> {
  const current = await SecureStore.getItemAsync(keyStoreName(groupId, keyVersion));
  if (current) return current;

  // Backward compatibility in case old key format was used on platforms that accepted it.
  const legacy = legacyKeyStoreName(groupId, keyVersion);
  if (!isValidSecureStoreKey(legacy)) return null;

  try {
    return await SecureStore.getItemAsync(legacy);
  } catch {
    return null;
  }
}

export async function encryptGroupKeyEnvelope(recipientPublicKeyB64: string, groupKeyB64: string): Promise<string> {
  let ephPriv = ExpoCrypto.getRandomBytes(32);
  while (!p256.utils.isValidSecretKey(ephPriv)) {
    ephPriv = ExpoCrypto.getRandomBytes(32);
  }
  const ephPub = p256.getPublicKey(ephPriv, false);
  const shared = p256.getSharedSecret(ephPriv, fromB64(recipientPublicKeyB64), true).slice(1);
  const payload = await encryptMessage(shared, groupKeyB64);
  return `${toB64(ephPub)}:${payload}`;
}

export async function decryptGroupKeyEnvelope(envelope: string): Promise<string> {
  const idx = envelope.indexOf(':');
  if (idx <= 0) throw new Error('Invalid key envelope');
  const ephPubB64 = envelope.slice(0, idx);
  const payload = envelope.slice(idx + 1);

  // Use long-term private key and sender ephemeral pubkey to derive the envelope key.
  const shared = await deriveSharedKey(ephPubB64);
  return decryptMessage(shared, payload);
}

export async function ensureLocalGroupKey(
  groupId: string,
  keyVersion: number,
  encryptedEnvelope: string | null,
): Promise<string | null> {
  const existing = await loadGroupKey(groupId, keyVersion);
  if (existing) return existing;
  if (!encryptedEnvelope) return null;

  const keyB64 = await decryptGroupKeyEnvelope(encryptedEnvelope);
  await saveGroupKey(groupId, keyVersion, keyB64);
  return keyB64;
}
