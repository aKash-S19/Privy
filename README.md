# Privy

Privy is a privacy-first messaging application built with Expo (React Native) and Supabase.
It provides encrypted direct chat, encrypted group chat, invite-based communities, secure signaling for voice calls, and hardened backend access through Edge Functions.

This README documents the current technical behavior of the app in detail.

## 1. Product Summary

Privy is designed around a simple principle: sensitive content should be encrypted on the client before it leaves the device.

The app currently includes:
- Username-based identity (no phone number required)
- Emoji PIN authentication
- End-to-end encrypted direct messaging
- End-to-end encrypted group messaging with per-group key distribution
- Image and document sharing in encrypted payloads
- Secure call signaling and call history events
- Push notifications for messages and incoming calls
- Friends, requests, groups, invite links, and moderation/reporting controls
- Profile, privacy, and notification settings

## 2. Feature Inventory

### 2.1 Authentication and Identity

- Register/login via Supabase Edge Function actions.
- Username is normalized to lowercase and validated client-side and server-side.
- Authentication secret is a 6-emoji PIN.
- Session token is stored in SecureStore.
- Device identity is generated and persisted locally.
- Public ECDH key is generated on-device and registered with backend.
- Username recovery flow is supported through dedicated backend actions.
- Username history is tracked and queryable for chat/group surfaces.

### 2.2 Direct Messaging

- One-to-one encrypted message exchange.
- Message types supported in schema/client: text, image, file, voice, video.
- Text, image, and document sending flows are implemented in chat UI.
- Optimistic sending state with pending and failed transitions.
- Message states: sent, delivered, read.
- Read marking performed through backend action.
- Typing indicator uses Supabase channel broadcast events.
- Date separators and timestamp formatting in message timeline.
- Media viewer with zoom/share/save actions.
- Message forwarding flow to other direct chats.
- Delete for me and delete for everyone behavior.
- Broadcast sync for delete-for-everyone UI updates.
- Call events are rendered as structured timeline cards in chat.

### 2.3 Group Messaging and Group Management

- Group list with member count and last activity preview.
- Group detail/info screen with:
- member list
- add/remove members
- promote/demote roles
- leave group
- delete (archive) group
- destroy group permanently
- Group avatar and banner upload via signed storage URL flow.
- Invite links and invite codes for group join.
- Group request flows: accept, decline, report.
- Group chat uses encrypted group key per group.
- Group message types include text, image, and file sending paths.
- Group key recovery includes admin re-wrap/self-healing paths.
- Resilience path for transient gateway failures during group context loading.

### 2.4 Voice Calling

- 1:1 call button from direct chat.
- Incoming call prompts in active chat and globally.
- Secure signaling actions:
- send-call-signal
- get-call-signals
- get-pending-call-signals
- ack-call-signals
- Signal types: offer, answer, ice, end, decline, busy.
- Signal payloads are encrypted client-side before transport.
- Incoming call notifications include action buttons (accept/decline).
- Call history is logged as encrypted call event messages and rendered in chat.
- Current runtime call mode is external room handoff (Talky) while preserving encrypted signaling metadata flow.
- Native WebRTC path is present in code and gated by call mode configuration.

### 2.5 Notifications

- Runtime configuration via expo-notifications.
- Message notifications for direct and group contexts.
- Incoming call notification category with actionable buttons.
- Android channels configured for default and calls (ringtone-style usage for calls).
- Notification tap routing deep-links into target screen.
- Duplicate notification suppression for already-open chat/group context.
- Push token registration and unregister lifecycle via backend actions.
- Expo Go safe fallback/mocking path is included for notification APIs.

### 2.6 Requests and Friends

- Search users by username.
- Send, accept, decline, and cancel friend requests.
- Remove friend action.
- Requests screen includes friend and group request tabs.
- Group invite request moderation includes report flow.

### 2.7 Profile, Preferences, and Privacy Controls

- Profile avatar upload/update.
- Username update flow.
- Copy/share identity and QR code rendering.
- Dark mode, accent color, bubble style, font size controls.
- Read receipts and typing indicator preferences.
- Disappearing message default preference.
- Auto-download media preference.
- Biometric lock toggle with local authentication checks.
- Message/group notification toggles and DND controls.
- Active sessions listing and revocation controls.

### 2.8 Screenshot and Capture Policy

Screen capture is restricted by route-level policy:
- On most app routes, screenshot/screen-recording is prevented.
- Capture is allowed on profile/settings routes for usability.

This behavior is enforced from the root layout using expo-screen-capture APIs.

## 3. Encryption and Cryptography Model

Privy encryption primitives are implemented with pure JS noble libraries for React Native compatibility.

### 3.1 Algorithms

- Key agreement: ECDH over NIST P-256
- Message cipher: AES-256-GCM
- IV length: 12 bytes random per encryption
- Authenticated encryption tag: included by GCM in ciphertext payload

### 3.2 Wire Format

- Public keys are base64-encoded uncompressed P-256 points (65 bytes).
- Encrypted payload format is:

`<iv_base64>.<ciphertext_plus_tag_base64>`

This format is validated server-side by migration constraints for message rows.

### 3.3 Key Storage

- Private and public ECDH key material is stored in SecureStore on device.
- Session token and selected local identity fields are stored in SecureStore.

### 3.4 Direct Chat Key Derivation

- Each client derives a shared 32-byte secret from local private key and peer public key.
- Shared key is cached per peer in-memory to reduce repeated derivations.

### 3.5 Group Key Distribution

- Each group has a symmetric group key used to encrypt group messages.
- Admins wrap group key for each member using ECDH-derived peer shared keys.
- Wrapped keys are persisted in group key distribution table.
- Non-admin members decrypt their wrapped copy and store locally.
- Admin recovery path re-wraps keys for all members if key mismatch/decrypt errors are detected.

### 3.6 Call Signaling Encryption

- Call signaling payloads are encrypted with the same peer shared key model.
- Backend stores encrypted signaling blobs and metadata only.
- Signal transport does not require plaintext SDP/ICE at rest in the database.

## 4. Voice Call Technical Flow

Current call flow (external mode) is:

1. Caller opens call screen from direct chat.
2. App ensures shared encryption key is available.
3. App creates call_id and external room identifier.
4. Encrypted offer signal is sent through Edge Function.
5. Receiver polls/receives pending call signal.
6. Receiver can accept or decline from in-app prompt/notification action.
7. On accept, receiver sends encrypted answer payload.
8. Both peers open external call room.
9. End/decline/busy states are sent as signaling events.
10. Call event is logged to chat history with encrypted call event payload and rendered as structured timeline item.

Native WebRTC branch is available in code path with:
- STUN/TURN configuration via app config env values
- Offer/answer/ICE exchange through encrypted signaling actions
- Connection state management and timeout logic

## 5. Backend Architecture

### 5.1 API Surface

The mobile app calls a single Supabase Edge Function endpoint with action-based routing.

Key action families include:
- auth/session/account lifecycle
- user search and requests
- chats and messages
- group management and membership
- group key state and key upsert
- call signaling and call event logging
- push token registration lifecycle
- settings sync and profile updates

### 5.2 Client Invocation and Retry

Client function caller includes:
- gateway/transient retry handling (502/503/504 and related transient statuses)
- network retry with backoff
- schema cache refresh attempt path for migration lag scenarios
- normalized error messages for app UI

## 6. Database and Security Hardening

### 6.1 Schema Areas

Migrations cover:
- users, sessions, login attempts, settings
- chats, chat_members, messages
- friend requests and profile metadata
- groups, group_members, group invites, reports, bans
- group key distribution
- call signaling
- user push tokens

### 6.2 RLS and Access Strategy

- Active app tables are configured with RLS enabled and FORCE RLS.
- Direct anon/authenticated table privileges are revoked on sensitive/active tables.
- service_role policies are used for Edge Function mediated access.
- App clients use Edge Function actions rather than unrestricted direct table operations for core flows.

### 6.3 Platform Hardening

App config includes:
- Android allowBackup disabled
- Android cleartext traffic disabled
- Microphone permission declaration for calls

## 7. Project Structure

High-level layout:
- app: Expo Router screens (auth, tabs, chat, groups, calls, profile)
- contexts: auth/session and settings providers
- lib: crypto, supabase caller, notifications, device id, responsive helpers
- supabase/functions/auth: Edge Function action router
- supabase/migrations: SQL schema and security migrations

## 8. Configuration and Environment

Environment values consumed by app config include:
- SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL
- SUPABASE_ANON_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY
- TURN_URLS or EXPO_PUBLIC_TURN_URLS
- TURN_USERNAME or EXPO_PUBLIC_TURN_USERNAME
- TURN_CREDENTIAL or EXPO_PUBLIC_TURN_CREDENTIAL
- EAS_PROJECT_ID or EXPO_PUBLIC_EAS_PROJECT_ID
- ANDROID_PACKAGE or EXPO_PUBLIC_ANDROID_PACKAGE

Reference template: .env.example

## 9. Local Development

Install dependencies:

```bash
npm install
```

Run app:

```bash
npm run start
```

Other scripts:

```bash
npm run android
npm run ios
npm run web
npm run lint
```

## 10. Build and Release

EAS build profiles include:
- development
- apk (internal APK)
- preview
- production

Build internal APK:

```bash
npx eas build -p android --profile apk
```

## 11. Operational Notes

- The app display name is Privy.
- Encryption and key derivation happen on-device.
- Most screens block capture by default; profile/settings are allowed.
- Group key mismatch handling includes admin-assisted rekey/re-wrap healing.
- Call signaling is secure and encrypted; current media path is external room mode unless native call mode is enabled.

## 12. License

See LICENSE.
