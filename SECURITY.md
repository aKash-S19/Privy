# Privy — Security & Cryptography Reference

A full technical breakdown of every cryptographic primitive, protocol and security
control used across the app. Last updated: 7 March 2026.

---

## Table of Contents

1. [Emoji-PIN Authentication](#1-emoji-pin-authentication)
2. [Device Identity](#2-device-identity)
3. [Session Tokens](#3-session-tokens)
4. [End-to-End Encryption — Key Exchange (ECDH)](#4-end-to-end-encryption--key-exchange-ecdh)
5. [End-to-End Encryption — Message Encryption (AES-256-GCM)](#5-end-to-end-encryption--message-encryption-aes-256-gcm)
6. [Key & Secret Storage](#6-key--secret-storage)
7. [Wire Format](#7-wire-format)
8. [Account Recovery](#8-account-recovery)
9. [Transport Security](#9-transport-security)
10. [Rate Limiting & Brute-Force Protection](#10-rate-limiting--brute-force-protection)
11. [Database Security (RLS)](#11-database-security-rls)
12. [Summary Table](#12-summary-table)

---

## 1. Emoji-PIN Authentication

### What it is
Instead of a text password, the user picks **6 emojis** in sequence from a fixed grid.
The ordered sequence is the user's "PIN".

### How it is hashed

| Step | Detail |
|---|---|
| Input | Emoji sequence concatenated as a UTF-8 string, e.g. `"🦊🔥🎸🌈🐉🍕"` |
| Algorithm | **SHA-256** via Web Crypto API (`crypto.subtle.digest`) running inside the Supabase Deno Edge Function |
| Output | 64-character hex string (256-bit hash) |
| Stored field | `users.password_hash` in Postgres |

> **Note on history:** The original design called for Argon2id (a memory-hard KDF). This was
> changed to SHA-256 when `npm:argon2` (C++ native) crashed the Deno runtime.
> SHA-256 is fast but still provides 2²⁵⁶ possible hash values; the emoji keyspace
> (6 positions from ~60 emojis = 60⁶ ≈ 46 billion combinations) provides the practical
> brute-force resistance. Upgrading to Argon2id or bcrypt in a future server-side migration
> is recommended.

### Login flow
1. Client concatenates the 6 emojis + sends to Edge Function
2. Edge Function hashes with SHA-256
3. Hash compared with `users.password_hash` — **constant-time string comparison** (Deno string equality is not timing-safe; this is a known TODO)
4. On match → new session token issued

---

## 2. Device Identity

### What it is
A **256-bit random device ID** that ties a login to a specific physical device without
using hardware identifiers (IMEI, Android ID, MAC address).

### Generation

```
randomBytes(32)  →  expo-crypto.getRandomBytesAsync(32)
                 →  hex-encoded 64-char string
                 →  stored in SecureStore ("privy_device_id")
```

| Property | Value |
|---|---|
| Entropy source | `expo-crypto.getRandomBytesAsync` → OS CSPRNG (Android Keystore / iOS Security framework) |
| Size | 32 bytes = 256 bits |
| Encoding | Hex string (64 chars) |
| Storage | `expo-secure-store` → Android Keystore / iOS Keychain |
| DB field | `users.device_hash` (plain — used as a lookup key, not a secret) |

### Purpose
- Allows **passwordless re-login** on the same device (device ID + PIN hash must both match)
- On a new device, the user logs in with username + PIN → device_hash updated to new device

---

## 3. Session Tokens

### What it is
A **256-bit random opaque bearer token** issued on every successful login.
It is NOT a JWT — no expiry is encoded inside it; the server verifies it against the DB.

### Generation

```
crypto.getRandomValues(new Uint8Array(32))   // Deno Web Crypto
  → hex-encoded 64-char string
  → stored in DB as sessions.token_hash
  → returned to client as plaintext
```

| Property | Value |
|---|---|
| Algorithm | CSPRNG, 256-bit |
| Encoding | Hex |
| Expiry | 30 days from issuance (`sessions.expires_at`) |
| DB storage | `sessions` table — token stored as plain hex (lookup key) |
| Client storage | `expo-secure-store` → Android Keystore / iOS Keychain |

> The token is stored **unhashed** in the DB. A production hardening would store
> `SHA-256(token)` in the DB and compare hashes on lookup, so a DB breach doesn't
> yield live tokens.

### Session invalidation
- Signout: row deleted from `sessions` table
- Account deletion: all rows for `user_id` deleted
- Login on new device: old sessions purged, new one issued

---

## 4. End-to-End Encryption — Key Exchange (ECDH)

### What it is
Each user has an **ECDH P-256 key pair** generated on-device. The private key never
leaves the device. Public keys are uploaded to Supabase so peers can derive a shared secret.

### Key generation

```
randomBytes(32)                  →  private scalar (validated: must be in [1, n-1])
p256.getPublicKey(priv, false)   →  65-byte uncompressed public key (0x04 || x || y)
```

| Property | Value |
|---|---|
| Curve | **NIST P-256** (secp256r1) — `@noble/curves/nist` |
| Private key | 32 bytes — stored in SecureStore as base64 |
| Public key | 65 bytes uncompressed — stored in SecureStore + uploaded to `user_public_keys` table |
| Entropy | `expo-crypto.getRandomBytes(32)` — OS CSPRNG |

### Shared secret derivation

```
sharedPoint = ECDH(myPrivateKey, peerPublicKey)   // compressed 33 bytes
sharedKey   = sharedPoint[1..32]                  // x-coordinate = 32 bytes
```

The **x-coordinate of the ECDH shared point** is used directly as a 256-bit AES key.
This matches how WebCrypto's `deriveKey` works for P-256 ECDH.

| Property | Value |
|---|---|
| Protocol | **ECDH** (Elliptic-curve Diffie–Hellman) |
| Curve | P-256 |
| Output | 32-byte shared secret (x-coordinate) |
| Library | `@noble/curves` v2 — pure JS, no WebCrypto needed |
| Caching | Derived keys are cached in memory per peer (`Map<peerId, Uint8Array>`) |

---

## 5. End-to-End Encryption — Message Encryption (AES-256-GCM)

### What it is
Every message body (text, image b64, file b64 + metadata) is encrypted on the sender's
device with AES-256-GCM before being sent to Supabase. Only a holder of the correct
shared key can decrypt it.

### Encryption

```
IV  = randomBytes(12)                   // 96-bit random IV (fresh per message)
CT  = AES-256-GCM.encrypt(key, IV, plaintext)
wire = base64(IV) + "." + base64(CT)   // stored in messages.encrypted_body
```

| Property | Value |
|---|---|
| Algorithm | **AES-256-GCM** (Authenticated Encryption with Associated Data) |
| Key size | 256 bits (32 bytes) from ECDH |
| IV size | **96 bits (12 bytes)** — random, fresh per message |
| Auth tag | 128 bits (16 bytes) — appended to ciphertext by GCM, verified on decrypt |
| Library | `@noble/ciphers/aes` v2 — pure JS |
| Plaintext for text | Raw UTF-8 message string |
| Plaintext for image | `JSON.stringify({ b64: "<base64 of JPEG>" })` |
| Plaintext for file | `JSON.stringify({ b64, name, size, mimeType })` |

### Decryption

```
[ivB64, ctB64] = encrypted_body.split(".")
plaintext = AES-256-GCM.decrypt(key, base64ToBytes(ivB64), base64ToBytes(ctB64))
```

GCM authentication tag is automatically verified — any tampered ciphertext throws
and the message renders as `"🔒 Unable to decrypt"`.

### Properties achieved
- **Confidentiality**: only the two parties who derived the shared key can read messages
- **Integrity + Authenticity**: GCM tag detects any bit-flip or tampering
- **IV uniqueness**: random 96-bit IV — collision probability negligible (birthday bound ~2⁴⁸ messages per key pair)
- **Forward-secrecy**: not yet implemented — same static ECDH key pair is reused per user

---

## 6. Key & Secret Storage

| Secret | Storage | Mechanism |
|---|---|---|
| ECDH private key | `expo-secure-store` | Android Keystore / iOS Keychain — OS-level hardware-backed (where available) |
| ECDH public key | `expo-secure-store` + Supabase DB | SecureStore for local access; DB for peer discovery |
| Device ID | `expo-secure-store` | Android Keystore / iOS Keychain |
| Session token | `expo-secure-store` | Android Keystore / iOS Keychain |
| App settings | `expo-secure-store` | Android Keystore / iOS Keychain |
| Onboarding flag | `expo-secure-store` | Android Keystore / iOS Keychain |
| Emoji PIN | **Never stored** | Only the SHA-256 hash is stored in the DB; raw emojis are only in memory during login |
| Shared AES key | **Memory only** | In-memory `Map` cache, never persisted |

---

## 7. Wire Format

### Message on the wire (`messages.encrypted_body`)

```
<iv_base64>.<ciphertext_with_tag_base64>
```

Example:
```
mH3kZq8A2vJxPLwE.aB3dF7...==
```

- Everything Supabase stores is **opaque ciphertext** — the server cannot read any message content
- `file_name`, `file_size`, `mime_type` columns store **plaintext metadata** for UI display
  before decryption (e.g. showing the filename in the file bubble before the message is decrypted)

### Public key on the wire (`user_public_keys.public_key`)

```
base64( 0x04 || x[32 bytes] || y[32 bytes] )   // 65-byte uncompressed P-256 point
```

---

## 8. Account Recovery

Users can set a **security question + answer** at registration. On recovery:

1. User provides username + security answer
2. Server compares `answer.trim().toLowerCase()` with `users.security_answer_hash`
   (stored as plain lowercase string — **no hash applied**, this is a known weakness)
3. On match → user sets a new emoji PIN, new SHA-256 hash stored, new session issued

> **Security note:** The security answer is stored in plaintext (as lowercased text).
> A future improvement would SHA-256 or bcrypt the answer before storage.

---

## 9. Transport Security

| Layer | Mechanism |
|---|---|
| Client ↔ Supabase API | **HTTPS / TLS 1.2+** — enforced by Supabase infrastructure |
| Client ↔ Supabase Realtime | **WSS (WebSocket Secure)** — TLS-wrapped |
| Edge Function calls | HTTPS POST with `Content-Type: application/json` |
| Auth header | `sessionToken` sent in request body (not Authorization header — avoids JWT verification by Supabase gateway since `--no-verify-jwt` is set) |

All network communication is over encrypted channels. The app does not make any HTTP
(plain) requests.

---

## 10. Rate Limiting & Brute-Force Protection

| Control | Implementation |
|---|---|
| Login attempts table | `public.login_attempts` — records `(username, attempted_at)` |
| Rate limit index | `login_attempts_username_time_idx` on `(username, attempted_at)` for fast window queries |
| Username enumeration | `find-user` requires a valid session token before returning any user data |
| Device binding | Login requires both correct device ID **and** correct PIN hash — stolen hash alone is not enough without the device ID |
| Session expiry | 30-day rolling sessions; old sessions are purged on new-device login |

---

## 11. Database Security (RLS)

All tables have **Row Level Security (RLS)** enabled in Postgres.

| Table | Policy |
|---|---|
| `users` | `service_role` only (Edge Function) |
| `sessions` | `service_role` only |
| `login_attempts` | `service_role` only |
| `messages` | `service_role` full access + `anon` SELECT (for Realtime delivery) |
| `user_public_keys` | `service_role` full access + `anon` SELECT (for key exchange) |
| `friend_requests` | `service_role` only |
| `chats` / `chat_members` | `service_role` only |

The client never connects to Postgres directly — all mutations go through the Edge Function
which uses the `SUPABASE_SERVICE_ROLE_KEY` (never exposed to the client).

---

## 12. Summary Table

| What | Algorithm / Method | Key size | Where |
|---|---|---|---|
| Emoji PIN hashing | SHA-256 | 256-bit output | Edge Function (Deno Web Crypto) |
| Device ID generation | CSPRNG | 256-bit | `expo-crypto` → OS CSPRNG |
| Session token generation | CSPRNG | 256-bit | Deno `crypto.getRandomValues` |
| ECDH key pair | P-256 (secp256r1) | 256-bit private key | `@noble/curves` on-device |
| Key exchange | ECDH — x-coordinate extraction | 256-bit shared secret | `@noble/curves` on-device |
| Message encryption | AES-256-GCM | 256-bit key, 96-bit IV, 128-bit tag | `@noble/ciphers` on-device |
| Secret storage (client) | OS secure enclave | Hardware-backed | `expo-secure-store` |
| Transport | TLS 1.2+ / WSS | — | Supabase infrastructure |
| DB access control | Postgres RLS | — | Supabase Postgres |
| IV generation | CSPRNG | 96-bit | `expo-crypto` per message |
