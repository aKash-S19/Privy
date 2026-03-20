// @ts-nocheck
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ok   = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json", ...CORS } });
const fail = (msg: string, status = 400) =>
  new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json", ...CORS } });

function db() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

function token() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("");
}

async function sessionUserId(supabase: ReturnType<typeof db>, sessionToken?: string) {
  if (!sessionToken) return null;
  const { data: session } = await supabase
    .from("sessions")
    .select("user_id")
    .eq("token_hash", sessionToken)
    .maybeSingle();
  return session?.user_id ?? null;
}

async function groupMembership(
  supabase: ReturnType<typeof db>,
  groupId: string,
  userId: string,
) {
  let { data, error } = await supabase
    .from("group_chat_members")
    .select("group_id, user_id, role, muted_until")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error?.message?.includes("Could not find the table 'public.group_chat_members'")) {
    await reloadSchemaCache(supabase);
    const retried = await supabase
      .from("group_chat_members")
      .select("group_id, user_id, role, muted_until")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle();
    data = retried.data;
  }

  return data ?? null;
}

async function reloadSchemaCache(supabase: ReturnType<typeof db>) {
  try {
    await supabase.rpc("reload_schema_cache");
  } catch {
    // Best-effort only. If the function is unavailable, normal flow continues.
  }
}

function canModerate(role: string) {
  return role === "admin" || role === "super_admin";
}

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: CORS });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fail("Invalid JSON"); }

  const { action } = body;
  if (!action) return fail("Missing action");

  const supabase = db();

  const groupActionsNeedingFreshSchema = new Set([
    "create-group",
    "list-groups",
    "create-group-invite",
    "join-group-via-invite",
    "get-group-join-requests",
    "resolve-group-join-request",
    "list-group-members",
    "add-group-member",
    "update-group-member",
    "set-group-settings",
    "rotate-group-key",
    "get-group-state",
    "send-group-message",
    "get-group-messages",
    "set-group-receipt",
    "set-group-typing",
    "report-group-user",
  ]);
  if (typeof action === "string" && groupActionsNeedingFreshSchema.has(action)) {
    await reloadSchemaCache(supabase);
  }

  if (action === "reload-schema-cache") {
    await reloadSchemaCache(supabase);
    return ok({ success: true });
  }

  // ?????? register ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
  // ── register ─────────────────────────────────────────────────────────────
  if (action === "register") {
    const { username, emojiKey, deviceId } = body;
    if (!username) return fail("Missing username", 400);
    if (!emojiKey) return fail("Missing emojiKey", 400);
    if (!deviceId) return fail("Missing deviceId", 400);

    const uname = (username as string).trim().toLowerCase();
    const dId   = (deviceId  as string).trim();
    const pin   = Array.isArray(emojiKey) ? (emojiKey as string[]).join("") : String(emojiKey);
    const hashedPin = await hashPin(pin);

    // Validate username server-side
    if (!/^[a-z0-9_]{4,20}$/.test(uname)) return fail("Invalid username format");

    // Check device not already registered
    const { data: existingDevice } = await supabase.from("users").select("id").eq("device_hash", dId).limit(1).maybeSingle();
    if (existingDevice) return fail("Device already registered", 409);

    // Check username not taken
    const { data: existingName } = await supabase.from("users").select("id").eq("username", uname).limit(1).maybeSingle();
    if (existingName) return fail("Username already taken", 409);

    const { data: newUser, error } = await supabase
      .from("users")
      .insert({
        username:      uname,
        password_hash: hashedPin,
        device_hash:   dId,
      })
      .select("id, username, created_at")
      .single();

    if (error) return fail(error.message, 500);

    const sessionToken = token();
    const exp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("sessions").insert({ user_id: newUser.id, token_hash: sessionToken, expires_at: exp });

    // Store ECDH public key atomically so peers can find it immediately
    if (body.publicKey) {
      await supabase.from("user_public_keys").upsert({
        user_id:    newUser.id,
        public_key: body.publicKey as string,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    }

    return ok({ success: true, user: newUser, sessionToken });
  }

  // ?????? login ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
  // ── login (device-based) ─────────────────────────────────────────────────────────
  if (action === "login") {
    const { emojiKey, deviceId } = body;
    if (!emojiKey || !deviceId) return fail("Missing fields");

    const pin = Array.isArray(emojiKey) ? (emojiKey as string[]).join("") : String(emojiKey);
    const hashedPin = await hashPin(pin);

    const { data: user, error: userError } = await supabase.from("users")
      .select("id, username, password_hash, created_at")
      .eq("device_hash", (deviceId as string).trim()).limit(1).maybeSingle();

    if (userError || !user || user.password_hash !== hashedPin) return fail("Invalid credentials", 401);

    const sessionToken = token();
    const exp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("sessions").insert({ user_id: user.id, token_hash: sessionToken, expires_at: exp });

    return ok({ success: true, user: { id: user.id, username: user.username, created_at: user.created_at }, sessionToken });
  }

  // ── login-username (manual login) ──────────────────────────────────────────────
  if (action === "login-username") {
    const { username, emojiKey, deviceId } = body;
    if (!username || !emojiKey || !deviceId) return fail("Missing fields");

    const uname = (username as string).trim().toLowerCase();
    const pin = Array.isArray(emojiKey) ? (emojiKey as string[]).join("") : String(emojiKey);
    const hashedPin = await hashPin(pin);

    // Look up by username
    const { data: user, error: userError } = await supabase.from("users")
      .select("id, username, password_hash, created_at")
      .eq("username", uname).limit(1).maybeSingle();

    if (userError || !user || user.password_hash !== hashedPin) return fail("Invalid username or pin", 401);

    // Update their device_hash to the new device so future logins work seamlessly
    await supabase.from("users").update({ device_hash: (deviceId as string).trim() }).eq("id", user.id);

    // Clear old sessions and issue a new one
    await supabase.from("sessions").delete().eq("user_id", user.id);
    const sessionToken = token();
    const exp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("sessions").insert({ user_id: user.id, token_hash: sessionToken, expires_at: exp });

    // Store ECDH public key atomically
    if (body.publicKey) {
      await supabase.from("user_public_keys").upsert({
        user_id:    user.id,
        public_key: body.publicKey as string,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    }

    return ok({ success: true, user: { id: user.id, username: user.username, created_at: user.created_at }, sessionToken });
  }

  // ?????? recover-init ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
  if (action === "recover-init") {
    const { username } = body as { username?: string };
    if (!username) return fail("Missing username");
    const { data } = await supabase.from("users").select("security_question").eq("username", (username as string).trim().toLowerCase()).maybeSingle();
    return ok({ question: data?.security_question ?? "What's a word only you would think of?" });
  }

  // ?????? recover-verify ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
  if (action === "recover-verify") {
    const { username, answer, newEmojiKey } = body;
    if (!username || !answer || !newEmojiKey) return fail("Missing fields");
    const uname = (username as string).trim().toLowerCase();
    const { data: user } = await supabase.from("users").select("id, username, security_answer_hash, created_at").eq("username", uname).limit(1).maybeSingle();
    if (!user) return fail("Invalid credentials", 401);
    if (user.security_answer_hash !== (answer as string).trim().toLowerCase()) return fail("Invalid credentials", 401);
    const pin = Array.isArray(newEmojiKey) ? (newEmojiKey as string[]).join("") : String(newEmojiKey);
    const hashedPin = await hashPin(pin);
    await supabase.from("users").update({ password_hash: hashedPin }).eq("id", user.id);
    await supabase.from("sessions").delete().eq("user_id", user.id);
    const sessionToken = token();
    const exp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("sessions").insert({ user_id: user.id, token_hash: sessionToken, expires_at: exp });

    if (body.publicKey) {
      await supabase.from("user_public_keys").upsert({
        user_id:    user.id,
        public_key: body.publicKey as string,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    }

    return ok({ success: true, user: { id: user.id, username: user.username, created_at: user.created_at }, sessionToken });
  }

  // ?????? signout ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
  if (action === "signout") {
    const { sessionToken } = body as { sessionToken?: string };
    if (sessionToken) await supabase.from("sessions").delete().eq("token_hash", sessionToken);
    return ok({ success: true });
  }

  // ?????? delete-account ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
  if (action === "delete-account") {
    const { sessionToken, emojiKey } = body;
    if (!sessionToken || !emojiKey) return fail("Missing fields");
    const { data: session } = await supabase.from("sessions").select("user_id").eq("token_hash", sessionToken as string).maybeSingle();
    if (!session) return fail("Invalid session", 401);
    const { data: user } = await supabase.from("users").select("password_hash").eq("id", session.user_id).limit(1).maybeSingle();
    if (!user) return fail("User not found", 404);
    const pin = Array.isArray(emojiKey) ? (emojiKey as string[]).join("") : String(emojiKey);
    const hashedPin = await hashPin(pin);
    if (user.password_hash !== hashedPin) return fail("Invalid credentials", 401);
    await supabase.from("users").delete().eq("id", session.user_id);
    return ok({ success: true });
  }

  // ── find-user ─────────────────────────────────────────────────────────────
  if (action === "find-user") {
    const { query, sessionToken } = body as { query?: string; sessionToken?: string };
    if (!sessionToken) return fail("Unauthorized", 401);
    const { data: session } = await supabase.from("sessions").select("user_id").eq("token_hash", sessionToken).maybeSingle();
    if (!session) return fail("Invalid session", 401);
    const uid = session.user_id;
    if (!query || (query as string).trim().length < 2) return ok({ users: [] });
    const { data: users } = await supabase.from("users")
      .select("id, username, created_at, avatar_url")
      .ilike("username", `${(query as string).trim().toLowerCase()}%`)
      .neq("id", uid).limit(20);

    const userIds = (users ?? []).map((u: any) => u.id);
    // Fetch any existing friend requests between current user and found users
    const { data: rels } = userIds.length > 0
      ? await supabase.from("friend_requests")
          .select("id, status, sender_id, receiver_id")
          .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
      : { data: [] };
    const relevantRels = (rels ?? []).filter((r: any) =>
      userIds.includes(r.sender_id) || userIds.includes(r.receiver_id),
    );
    const usersWithStatus = (users ?? []).map((u: any) => {
      const rel = relevantRels.find((r: any) =>
        (r.sender_id === uid && r.receiver_id === u.id) ||
        (r.receiver_id === uid && r.sender_id === u.id),
      );
      let requestStatus = "none";
      if (rel) {
        if (rel.status === "accepted") requestStatus = "friends";
        else if (rel.status === "pending" && rel.sender_id === uid) requestStatus = "sent";
        else if (rel.status === "pending" && rel.receiver_id === uid) requestStatus = "received";
      }
      return { ...u, requestStatus };
    });

    // For friends, also look up their shared chat_id (may be null if deleted) and public key
    const friendIds = usersWithStatus.filter((u: any) => u.requestStatus === "friends").map((u: any) => u.id);
    const chatIdMap: Record<string, string> = {};
    const keyMap:    Record<string, string> = {};
    if (friendIds.length > 0) {
      const { data: myChats } = await supabase.from("chat_members").select("chat_id").eq("user_id", uid);
      const myChatIds = (myChats ?? []).map((r: any) => r.chat_id as string);
      if (myChatIds.length > 0) {
        const { data: theirChats } = await supabase.from("chat_members")
          .select("chat_id, user_id").in("chat_id", myChatIds).in("user_id", friendIds);
        (theirChats ?? []).forEach((r: any) => { chatIdMap[r.user_id] = r.chat_id; });
      }
      const { data: keys } = await supabase.from("user_public_keys")
        .select("user_id, public_key").in("user_id", friendIds);
      (keys ?? []).forEach((k: any) => { keyMap[k.user_id] = k.public_key; });
    }

    return ok({ users: usersWithStatus.map((u: any) => ({
      ...u,
      chatId:         chatIdMap[u.id] ?? null,
      peerPublicKey:  keyMap[u.id]    ?? null,
    })) });
  }

  // ?????? check-username ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
  if (action === "check-username") {
    const { username } = body as { username?: string };
    if (!username) return fail("Missing username");
    const { data } = await supabase.from("users").select("id").eq("username", (username as string).trim().toLowerCase()).maybeSingle();
    return ok({ available: !data });
  }

  // ?????? check-device ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
  // ── check-device ─────────────────────────────────────────────────────────────────
  if (action === "check-device") {
    const { deviceId } = body as { deviceId?: string };
    if (!deviceId) return ok({ found: false });
    const { data } = await supabase.from("users")
      .select("id, username, created_at")
      .eq("device_hash", (deviceId as string).trim()).maybeSingle();
    if (!data) return ok({ found: false });
    return ok({ found: true, user: { id: data.id, username: data.username, created_at: data.created_at } });
  }

  // ── send-request ─────────────────────────────────────────────────────────────
  if (action === "send-request") {
    const { sessionToken, toUserId } = body;
    if (!sessionToken || !toUserId) return fail("Missing fields");
    const { data: session } = await supabase.from("sessions").select("user_id").eq("token_hash", sessionToken as string).maybeSingle();
    if (!session) return fail("Invalid session", 401);
    if (session.user_id === toUserId) return fail("Cannot send request to yourself", 400);
    // Upsert so re-sending a declined request works
    const { error } = await supabase.from("friend_requests")
      .upsert({ sender_id: session.user_id, receiver_id: toUserId as string, status: "pending", updated_at: new Date().toISOString() },
        { onConflict: "sender_id,receiver_id" });
    if (error) return fail(error.message, 500);
    return ok({ success: true });
  }

  // ── accept-request ───────────────────────────────────────────────────────────
  if (action === "accept-request") {
    const { sessionToken, requestId } = body;
    if (!sessionToken || !requestId) return fail("Missing fields");
    const { data: session } = await supabase.from("sessions").select("user_id").eq("token_hash", sessionToken as string).maybeSingle();
    if (!session) return fail("Invalid session", 401);
    const uid = session.user_id;

    // Fetch the request first (need sender_id to create the chat)
    const { data: req } = await supabase.from("friend_requests")
      .select("id, sender_id")
      .eq("id", requestId as string).eq("receiver_id", uid).eq("status", "pending")
      .maybeSingle();
    if (!req) return fail("Request not found or already actioned", 404);

    // Mark as accepted
    const { error: updErr } = await supabase.from("friend_requests")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", req.id);
    if (updErr) return fail(updErr.message, 500);

    // Guard: don't create a duplicate chat
    const { data: myChats }    = await supabase.from("chat_members").select("chat_id").eq("user_id", uid);
    const { data: theirChats } = await supabase.from("chat_members").select("chat_id").eq("user_id", req.sender_id);
    const myIds    = (myChats    ?? []).map((r: any) => r.chat_id as string);
    const theirIds = (theirChats ?? []).map((r: any) => r.chat_id as string);
    const existing = myIds.find((id) => theirIds.includes(id));
    if (existing) return ok({ success: true, chatId: existing });

    // Create the chat room and add both members atomically
    const { data: chat, error: chatErr } = await supabase
      .from("chats").insert({}).select("id").single();
    if (chatErr) return fail(chatErr.message, 500);
    await supabase.from("chat_members").insert([
      { chat_id: chat.id, user_id: uid },
      { chat_id: chat.id, user_id: req.sender_id },
    ]);

    return ok({ success: true, chatId: chat.id });
  }

  // ── decline-request ──────────────────────────────────────────────────────────
  if (action === "decline-request") {
    const { sessionToken, requestId } = body;
    if (!sessionToken || !requestId) return fail("Missing fields");
    const { data: session } = await supabase.from("sessions").select("user_id").eq("token_hash", sessionToken as string).maybeSingle();
    if (!session) return fail("Invalid session", 401);
    const { error } = await supabase.from("friend_requests")
      .update({ status: "declined", updated_at: new Date().toISOString() })
      .eq("id", requestId as string).eq("receiver_id", session.user_id).eq("status", "pending");
    if (error) return fail(error.message, 500);
    return ok({ success: true });
  }

  // ── cancel-request ───────────────────────────────────────────────────────────
  if (action === "cancel-request") {
    const { sessionToken, requestId } = body;
    if (!sessionToken || !requestId) return fail("Missing fields");
    const { data: session } = await supabase.from("sessions").select("user_id").eq("token_hash", sessionToken as string).maybeSingle();
    if (!session) return fail("Invalid session", 401);
    const { error } = await supabase.from("friend_requests")
      .delete().eq("id", requestId as string).eq("sender_id", session.user_id);
    if (error) return fail(error.message, 500);
    return ok({ success: true });
  }

  // ── remove-friend ────────────────────────────────────────────────────────────
  if (action === "remove-friend") {
    const { sessionToken, peerId } = body;
    if (!sessionToken || !peerId) return fail("Missing fields");
    const { data: session } = await supabase.from("sessions").select("user_id").eq("token_hash", sessionToken as string).maybeSingle();
    if (!session) return fail("Invalid session", 401);
    const uid = session.user_id;
    // Delete the accepted friend_request row in whichever direction it exists
    const { error } = await supabase.from("friend_requests").delete()
      .or(`and(sender_id.eq.${uid},receiver_id.eq.${peerId as string}),and(sender_id.eq.${peerId as string},receiver_id.eq.${uid})`);
    if (error) return fail(error.message, 500);
    return ok({ success: true });
  }

  // ── get-requests ─────────────────────────────────────────────────────────────
  if (action === "get-requests") {
    const { sessionToken } = body;
    if (!sessionToken) return fail("Missing session", 401);
    const { data: session } = await supabase.from("sessions").select("user_id").eq("token_hash", sessionToken as string).maybeSingle();
    if (!session) return fail("Invalid session", 401);
    const uid = session.user_id;

    const { data: received } = await supabase.from("friend_requests")
      .select("id, status, created_at, sender:sender_id(id, username)")
      .eq("receiver_id", uid).eq("status", "pending").order("created_at", { ascending: false });

    const { data: sent } = await supabase.from("friend_requests")
      .select("id, status, created_at, receiver:receiver_id(id, username)")
      .eq("sender_id", uid).eq("status", "pending").order("created_at", { ascending: false });

    return ok({ received: received ?? [], sent: sent ?? [] });
  }

  // ── update-username ──────────────────────────────────────────────────────────
  if (action === "update-username") {
    const { sessionToken, newUsername } = body;
    if (!sessionToken || !newUsername) return fail("Missing fields");
    const { data: session } = await supabase.from("sessions").select("user_id").eq("token_hash", sessionToken as string).maybeSingle();
    if (!session) return fail("Invalid session", 401);
    const uname = (newUsername as string).trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(uname)) return fail("Username must be 3-20 chars, letters/numbers/underscore");
    const { data: taken } = await supabase.from("users").select("id").eq("username", uname).neq("id", session.user_id).maybeSingle();
    if (taken) return fail("Username already taken", 409);
    const { data: updated, error } = await supabase.from("users")
      .update({ username: uname }).eq("id", session.user_id)
      .select("id, username, created_at, avatar_url").single();
    if (error) return fail(error.message, 500);
    return ok({ success: true, user: updated });
  }

  // ── update-avatar ────────────────────────────────────────────────────────────
  if (action === "update-avatar") {
    const { sessionToken, avatarUrl } = body;
    if (!sessionToken || !avatarUrl) return fail("Missing fields");
    const { data: session } = await supabase.from("sessions").select("user_id").eq("token_hash", sessionToken as string).maybeSingle();
    if (!session) return fail("Invalid session", 401);
    const { data: updated, error } = await supabase.from("users")
      .update({ avatar_url: avatarUrl as string }).eq("id", session.user_id)
      .select("id, username, created_at, avatar_url").single();
    if (error) return fail(error.message, 500);
    return ok({ success: true, user: updated });
  }

  // ── get-sessions ─────────────────────────────────────────────────────────────
  if (action === "get-sessions") {
    const { sessionToken } = body;
    if (!sessionToken) return fail("Missing session", 401);
    const { data: session } = await supabase.from("sessions").select("user_id").eq("token_hash", sessionToken as string).maybeSingle();
    if (!session) return fail("Invalid session", 401);
    const { data: sessions } = await supabase.from("sessions")
      .select("id, created_at, expires_at")
      .eq("user_id", session.user_id)
      .order("created_at", { ascending: false });
    return ok({ sessions: sessions ?? [] });
  }

  // ── revoke-session ───────────────────────────────────────────────────────────
  if (action === "revoke-session") {
    const { sessionToken, revokeId } = body;
    if (!sessionToken || !revokeId) return fail("Missing fields");
    const { data: session } = await supabase.from("sessions").select("user_id").eq("token_hash", sessionToken as string).maybeSingle();
    if (!session) return fail("Invalid session", 401);
    const { error } = await supabase.from("sessions")
      .delete().eq("id", revokeId as string).eq("user_id", session.user_id);
    if (error) return fail(error.message, 500);
    return ok({ success: true });
  }

  // ── get-upload-url (signed upload URL for avatar) ────────────────────────────
  if (action === "get-upload-url") {
    const { sessionToken } = body;
    if (!sessionToken) return fail("Missing session", 401);
    const { data: session } = await supabase.from("sessions").select("user_id").eq("token_hash", sessionToken as string).maybeSingle();
    if (!session) return fail("Invalid session", 401);
    const filePath = `${session.user_id}.jpg`;
    const { data, error } = await supabase.storage.from("avatars").createSignedUploadUrl(filePath);
    if (error) return fail(error.message, 500);
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    return ok({ signedUrl: data.signedUrl, path: data.path, token: data.token, publicUrl: urlData.publicUrl });
  }

  // ── store-public-key ─────────────────────────────────────────────────────────
  if (action === "store-public-key") {
    const { sessionToken, publicKey } = body;
    if (!sessionToken || !publicKey) return fail("Missing fields");
    const { data: session } = await supabase.from("sessions").select("user_id").eq("token_hash", sessionToken as string).maybeSingle();
    if (!session) return fail("Invalid session", 401);
    const { error } = await supabase.from("user_public_keys").upsert({
      user_id:    session.user_id,
      public_key: publicKey as string,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) return fail(error.message, 500);
    return ok({ success: true });
  }

  // ── get-public-key ────────────────────────────────────────────────────────────
  if (action === "get-public-key") {
    const { sessionToken, userId } = body;
    if (!sessionToken || !userId) return fail("Missing fields");
    const { data: session } = await supabase.from("sessions").select("user_id").eq("token_hash", sessionToken as string).maybeSingle();
    if (!session) return fail("Invalid session", 401);
    const { data } = await supabase.from("user_public_keys")
      .select("public_key").eq("user_id", userId as string).maybeSingle();
    return ok({ publicKey: data?.public_key ?? null });
  }

  // ── get-chats ─────────────────────────────────────────────────────────────────
  if (action === "get-chats") {
    const { sessionToken } = body;
    if (!sessionToken) return fail("Missing session", 401);
    const { data: session } = await supabase.from("sessions").select("user_id").eq("token_hash", sessionToken as string).maybeSingle();
    if (!session) return fail("Invalid session", 401);
    const uid = session.user_id;

    const { data: myMemberships } = await supabase
      .from("chat_members").select("chat_id, joined_at, last_read_at").eq("user_id", uid);
    const chatIds = (myMemberships ?? []).map((m: any) => m.chat_id as string);
    if (!chatIds.length) return ok({ chats: [] });

    const { data: peerMembers } = await supabase
      .from("chat_members")
      .select("chat_id, user:user_id(id, username, avatar_url, created_at)")
      .in("chat_id", chatIds).neq("user_id", uid);

    const peerIds = [...new Set((peerMembers ?? []).map((p: any) => p.user?.id).filter(Boolean))];
    const { data: publicKeys } = peerIds.length > 0
      ? await supabase.from("user_public_keys").select("user_id, public_key").in("user_id", peerIds)
      : { data: [] };
    const keyMap: Record<string, string> = {};
    (publicKeys ?? []).forEach((k: any) => { keyMap[k.user_id] = k.public_key; });

    // All messages for these chats (to find last + unread counts)
    const { data: allMessages } = await supabase
      .from("messages")
      .select("id, chat_id, sender_id, encrypted_body, msg_type, created_at, status")
      .in("chat_id", chatIds)
      .order("created_at", { ascending: false });

    const lastMsgMap: Record<string, any> = {};
    const unreadCounts: Record<string, number> = {};
    const membershipMap: Record<string, any> = {};
    (myMemberships ?? []).forEach((m: any) => { membershipMap[m.chat_id] = m; });
    (allMessages ?? []).forEach((m: any) => {
      if (!lastMsgMap[m.chat_id]) lastMsgMap[m.chat_id] = m;
      if (m.sender_id !== uid) {
        const lr = membershipMap[m.chat_id]?.last_read_at;
        if (!lr || new Date(m.created_at) > new Date(lr))
          unreadCounts[m.chat_id] = (unreadCounts[m.chat_id] ?? 0) + 1;
      }
    });

    const chats = (peerMembers ?? []).map((p: any) => {
      const ms = membershipMap[p.chat_id];
      const lm = lastMsgMap[p.chat_id] ?? null;
      return {
        chat_id:         p.chat_id,
        joined_at:       ms?.joined_at,
        user:            p.user,
        peer_public_key: keyMap[p.user?.id] ?? null,
        last_message:    lm,
        unread_count:    unreadCounts[p.chat_id] ?? 0,
        last_message_at: lm?.created_at ?? ms?.joined_at,
      };
    }).sort((a: any, b: any) =>
      new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime()
    );

    return ok({ chats });
  }

  // ── send-message ──────────────────────────────────────────────────────────────
  if (action === "send-message") {
    const { sessionToken, chatId, encryptedBody, msgType = "text", fileName, fileSize, mimeType } = body;
    if (!sessionToken || !chatId || !encryptedBody) return fail("Missing fields");
    const { data: session } = await supabase.from("sessions").select("user_id").eq("token_hash", sessionToken as string).maybeSingle();
    if (!session) return fail("Invalid session", 401);
    const uid = session.user_id;

    const { data: membership } = await supabase.from("chat_members")
      .select("chat_id").eq("chat_id", chatId as string).eq("user_id", uid).maybeSingle();
    if (!membership) return fail("Not a member of this chat", 403);

    const { data: msg, error } = await supabase.from("messages").insert({
      chat_id: chatId, sender_id: uid, encrypted_body: encryptedBody,
      msg_type: msgType, file_name: fileName ?? null,
      file_size: fileSize ?? null, mime_type: mimeType ?? null, status: "sent",
    }).select().single();
    if (error) return fail(error.message, 500);

    // Keep chat.last_message_at current for sorting
    await supabase.from("chats").update({ last_message_at: msg.created_at }).eq("id", chatId as string);
    return ok({ message: msg });
  }

  // ── get-messages ──────────────────────────────────────────────────────────────
  if (action === "get-messages") {
    const { sessionToken, chatId, before } = body;
    if (!sessionToken || !chatId) return fail("Missing fields");
    const { data: session } = await supabase.from("sessions").select("user_id").eq("token_hash", sessionToken as string).maybeSingle();
    if (!session) return fail("Invalid session", 401);
    const uid = session.user_id;

    const { data: membership } = await supabase.from("chat_members")
      .select("chat_id").eq("chat_id", chatId as string).eq("user_id", uid).maybeSingle();
    if (!membership) return fail("Not a member of this chat", 403);

    let q = supabase.from("messages")
      .select("id, chat_id, sender_id, encrypted_body, msg_type, file_name, file_size, mime_type, status, created_at")
      .eq("chat_id", chatId as string).order("created_at", { ascending: false }).limit(50);
    if (before) q = q.lt("created_at", before as string);
    const { data: messages, error } = await q;
    if (error) return fail(error.message, 500);

    // Mark any of peer's messages as delivered
    const toDeliver = (messages ?? []).filter((m: any) => m.sender_id !== uid && m.status === "sent").map((m: any) => m.id);
    if (toDeliver.length > 0)
      await supabase.from("messages").update({ status: "delivered" }).in("id", toDeliver);

    return ok({ messages: messages ?? [] });
  }

  // ── mark-read ─────────────────────────────────────────────────────────────────
  if (action === "mark-read") {
    const { sessionToken, chatId } = body;
    if (!sessionToken || !chatId) return fail("Missing fields");
    const { data: session } = await supabase.from("sessions").select("user_id").eq("token_hash", sessionToken as string).maybeSingle();
    if (!session) return fail("Invalid session", 401);
    const uid = session.user_id;
    await supabase.from("chat_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("chat_id", chatId as string).eq("user_id", uid);
    await supabase.from("messages").update({ status: "read" })
      .eq("chat_id", chatId as string).neq("sender_id", uid).in("status", ["sent", "delivered"]);
    return ok({ success: true });
  }

  // ── open-chat ──────────────────────────────────────────────────────────────
  // Find-or-create a 1-on-1 chat between two friends.
  // Safe to call even if one side deleted their membership.
  if (action === "open-chat") {
    const { sessionToken, peerId } = body;
    if (!sessionToken || !peerId) return fail("Missing fields");
    const { data: session } = await supabase.from("sessions").select("user_id").eq("token_hash", sessionToken as string).maybeSingle();
    if (!session) return fail("Invalid session", 401);
    const uid = session.user_id;
    if (uid === peerId) return fail("Cannot open chat with yourself");

    // Verify they are actually friends
    const { data: rel } = await supabase.from("friend_requests")
      .select("id, status")
      .or(`and(sender_id.eq.${uid},receiver_id.eq.${peerId as string}),and(sender_id.eq.${peerId as string},receiver_id.eq.${uid})`)
      .eq("status", "accepted").maybeSingle();
    if (!rel) return fail("Not friends", 403);

    // Fetch peer's public key (may be null if they haven't uploaded yet)
    const { data: peerKeyRow } = await supabase.from("user_public_keys")
      .select("public_key").eq("user_id", peerId as string).maybeSingle();
    const peerPublicKey = peerKeyRow?.public_key ?? null;

    // Check if a shared chat already exists where BOTH are members
    const { data: myChats }    = await supabase.from("chat_members").select("chat_id").eq("user_id", uid);
    const { data: theirChats } = await supabase.from("chat_members").select("chat_id").eq("user_id", peerId as string);
    const myIds    = (myChats    ?? []).map((r: any) => r.chat_id as string);
    const theirIds = (theirChats ?? []).map((r: any) => r.chat_id as string);
    const existing = myIds.find(id => theirIds.includes(id));
    if (existing) return ok({ chatId: existing, peerPublicKey });

    // No shared chat — create one and add both members
    const { data: chat, error: chatErr } = await supabase.from("chats").insert({}).select("id").single();
    if (chatErr) return fail(chatErr.message, 500);
    await supabase.from("chat_members").insert([
      { chat_id: chat.id, user_id: uid },
      { chat_id: chat.id, user_id: peerId as string },
    ]);
    return ok({ chatId: chat.id, peerPublicKey });
  }

  // ── delete-message ────────────────────────────────────────────────────────────
  if (action === "delete-message") {
    const { sessionToken, messageId, forEveryone } = body;
    if (!sessionToken || !messageId) return fail("Missing fields");
    const { data: session } = await supabase.from("sessions").select("user_id").eq("token_hash", sessionToken as string).maybeSingle();
    if (!session) return fail("Invalid session", 401);
    const uid = session.user_id;

    if (forEveryone) {
      // Verify the requester is the sender
      const { data: msg } = await supabase.from("messages")
        .select("sender_id, chat_id").eq("id", messageId as string).maybeSingle();
      if (!msg) return fail("Message not found", 404);
      if (msg.sender_id !== uid) return fail("Cannot delete others' messages", 403);
      await supabase.from("messages").delete().eq("id", messageId as string);
    }
    // "delete for me" is client-side only — no server action needed
    return ok({ success: true });
  }

  // ── delete-chat ───────────────────────────────────────────────────────────────
  if (action === "delete-chat") {
    const { sessionToken, chatId } = body;
    if (!sessionToken || !chatId) return fail("Missing fields");
    const { data: session } = await supabase.from("sessions").select("user_id").eq("token_hash", sessionToken as string).maybeSingle();
    if (!session) return fail("Invalid session", 401);
    const uid = session.user_id;

    // Confirm membership before touching anything
    const { data: membership } = await supabase.from("chat_members")
      .select("chat_id").eq("chat_id", chatId as string).eq("user_id", uid).maybeSingle();
    if (!membership) return fail("Not a member of this chat", 403);

    // Remove this user from the chat
    await supabase.from("chat_members").delete()
      .eq("chat_id", chatId as string).eq("user_id", uid);

    // If no members remain, clean up messages + chat row
    const { count } = await supabase.from("chat_members")
      .select("*", { count: "exact", head: true }).eq("chat_id", chatId as string);
    if ((count ?? 0) === 0) {
      await supabase.from("messages").delete().eq("chat_id", chatId as string);
      await supabase.from("chats").delete().eq("id", chatId as string);
    }

    return ok({ success: true });
  }

  // ── create-group ───────────────────────────────────────────────────────────
  if (action === "create-group") {
    const { sessionToken, name, memberIds = [], keyEnvelopes = {}, inviteRequiresApproval = false } = body as any;
    if (!sessionToken || !name) return fail("Missing fields");

    const uid = await sessionUserId(supabase, sessionToken as string);
    if (!uid) return fail("Invalid session", 401);

    const trimmed = String(name).trim();
    if (trimmed.length < 2 || trimmed.length > 80) return fail("Invalid group name");

    const { data: group, error: groupErr } = await supabase
      .from("group_chats")
      .insert({
        name: trimmed,
        created_by: uid,
        invite_requires_approval: Boolean(inviteRequiresApproval),
      })
      .select("id, name, key_version, announcement_mode, invite_requires_approval")
      .single();
    if (groupErr) return fail(groupErr.message, 500);

    const uniqueMembers = Array.from(new Set([uid, ...(memberIds as string[])]));
    const rows = uniqueMembers.map((id) => ({
      group_id: group.id,
      user_id: id,
      role: id === uid ? "super_admin" : "member",
    }));

    const { error: membersErr } = await supabase.from("group_chat_members").insert(rows);
    if (membersErr) return fail(membersErr.message, 500);

    const keyRows = Object.entries(keyEnvelopes as Record<string, string>).map(([memberId, encryptedGroupKey]) => ({
      group_id: group.id,
      user_id: memberId,
      key_version: group.key_version,
      encrypted_group_key: encryptedGroupKey,
    }));
    if (keyRows.length > 0) {
      const { error: keyErr } = await supabase.from("group_member_keys").insert(keyRows);
      if (keyErr) return fail(keyErr.message, 500);
    }

    return ok({ success: true, group });
  }

  // ── list-groups ────────────────────────────────────────────────────────────
  if (action === "list-groups") {
    const { sessionToken } = body as any;
    const uid = await sessionUserId(supabase, sessionToken as string);
    if (!uid) return fail("Invalid session", 401);

    const { data: memberships, error } = await supabase
      .from("group_chat_members")
      .select("group_id, role, joined_at, group:group_chats(id, name, announcement_mode, invite_requires_approval, restrict_forwarding, key_version, created_by)")
      .eq("user_id", uid)
      .order("joined_at", { ascending: false });
    if (error) return fail(error.message, 500);

    const groupIds = (memberships ?? []).map((m: any) => m.group_id);
    const { data: lastMessages } = groupIds.length
      ? await supabase.from("group_messages").select("id, group_id, sender_id, msg_type, created_at").in("group_id", groupIds).order("created_at", { ascending: false })
      : { data: [] as any[] };

    const { data: myReadRows } = await supabase
      .from("group_chat_members")
      .select("group_id, last_read_at")
      .eq("user_id", uid)
      .in("group_id", groupIds);

    const readMap: Record<string, string | null> = {};
    (myReadRows ?? []).forEach((r: any) => { readMap[r.group_id] = r.last_read_at ?? null; });

    const unreadMap: Record<string, number> = {};
    for (const m of (lastMessages ?? [])) {
      if (m.sender_id === uid) continue;
      const lr = readMap[m.group_id];
      if (!lr || new Date(m.created_at) > new Date(lr)) unreadMap[m.group_id] = (unreadMap[m.group_id] ?? 0) + 1;
    }

    const lastByGroup: Record<string, any> = {};
    for (const m of (lastMessages ?? [])) {
      if (!lastByGroup[m.group_id]) lastByGroup[m.group_id] = m;
    }

    const groups = (memberships ?? []).map((m: any) => ({
      id: m.group.id,
      name: m.group.name,
      role: m.role,
      announcement_mode: m.group.announcement_mode,
      invite_requires_approval: m.group.invite_requires_approval,
      restrict_forwarding: m.group.restrict_forwarding,
      key_version: m.group.key_version,
      created_by: m.group.created_by,
      joined_at: m.joined_at,
      unread_count: unreadMap[m.group_id] ?? 0,
      last_message: lastByGroup[m.group_id] ?? null,
      last_message_at: (lastByGroup[m.group_id]?.created_at ?? m.joined_at),
    }));

    return ok({ success: true, groups });
  }

  // ── create-group-invite ───────────────────────────────────────────────────
  if (action === "create-group-invite") {
    const { sessionToken, groupId, expiresInHours = 72, maxUses = null } = body as any;
    const uid = await sessionUserId(supabase, sessionToken as string);
    if (!uid) return fail("Invalid session", 401);

    const member = await groupMembership(supabase, groupId, uid);
    if (!member || !canModerate(member.role)) return fail("Forbidden", 403);

    const raw = crypto.getRandomValues(new Uint8Array(24));
    const inviteToken = Array.from(raw).map((b) => b.toString(16).padStart(2, "0")).join("");
    const expiresAt = new Date(Date.now() + Number(expiresInHours) * 3600000).toISOString();

    const { data, error } = await supabase.from("group_invite_links").insert({
      group_id: groupId,
      invite_token: inviteToken,
      created_by: uid,
      expires_at: expiresAt,
      max_uses: maxUses,
    }).select("id, group_id, invite_token, expires_at, max_uses, uses").single();
    if (error) return fail(error.message, 500);
    return ok({ success: true, invite: data });
  }

  // ── join-group-via-invite ─────────────────────────────────────────────────
  if (action === "join-group-via-invite") {
    const { sessionToken, inviteToken } = body as any;
    const uid = await sessionUserId(supabase, sessionToken as string);
    if (!uid) return fail("Invalid session", 401);

    const { data: invite } = await supabase
      .from("group_invite_links")
      .select("id, group_id, expires_at, max_uses, uses, revoked")
      .eq("invite_token", inviteToken)
      .maybeSingle();
    if (!invite || invite.revoked) return fail("Invalid invite", 404);
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) return fail("Invite expired", 400);
    if (invite.max_uses !== null && invite.uses >= invite.max_uses) return fail("Invite max uses reached", 400);

    const { data: isBanned } = await supabase
      .from("group_bans")
      .select("id")
      .eq("group_id", invite.group_id)
      .eq("user_id", uid)
      .maybeSingle();
    if (isBanned) return fail("You are banned from this group", 403);

    const { data: grp } = await supabase
      .from("group_chats")
      .select("id, invite_requires_approval")
      .eq("id", invite.group_id)
      .maybeSingle();
    if (!grp) return fail("Group not found", 404);

    if (grp.invite_requires_approval) {
      await supabase.from("group_join_requests").upsert({
        group_id: grp.id,
        requester_id: uid,
        invite_link_id: invite.id,
        status: "pending",
      }, { onConflict: "group_id,requester_id,status" });
      return ok({ success: true, pending: true });
    }

    await supabase.from("group_chat_members").upsert({
      group_id: grp.id,
      user_id: uid,
      role: "member",
    }, { onConflict: "group_id,user_id" });

    await supabase.from("group_invite_links").update({ uses: invite.uses + 1 }).eq("id", invite.id);
    return ok({ success: true, pending: false, groupId: grp.id });
  }

  // ── get-group-join-requests ────────────────────────────────────────────────
  if (action === "get-group-join-requests") {
    const { sessionToken, groupId } = body as any;
    const uid = await sessionUserId(supabase, sessionToken as string);
    if (!uid) return fail("Invalid session", 401);

    const member = await groupMembership(supabase, groupId, uid);
    if (!member || !canModerate(member.role)) return fail("Forbidden", 403);

    const { data, error } = await supabase
      .from("group_join_requests")
      .select("id, requester_id, requested_at, status, user:requester_id(id, username, avatar_url)")
      .eq("group_id", groupId)
      .eq("status", "pending")
      .order("requested_at", { ascending: false });
    if (error) return fail(error.message, 500);
    return ok({ success: true, requests: data ?? [] });
  }

  // ── resolve-group-join-request ─────────────────────────────────────────────
  if (action === "resolve-group-join-request") {
    const { sessionToken, requestId, approve = false } = body as any;
    const uid = await sessionUserId(supabase, sessionToken as string);
    if (!uid) return fail("Invalid session", 401);

    const { data: reqRow } = await supabase
      .from("group_join_requests")
      .select("id, group_id, requester_id, status")
      .eq("id", requestId)
      .maybeSingle();
    if (!reqRow || reqRow.status !== "pending") return fail("Request not found", 404);

    const member = await groupMembership(supabase, reqRow.group_id, uid);
    if (!member || !canModerate(member.role)) return fail("Forbidden", 403);

    await supabase.from("group_join_requests").update({
      status: approve ? "approved" : "rejected",
      resolved_at: new Date().toISOString(),
      resolved_by: uid,
    }).eq("id", reqRow.id);

    if (approve) {
      await supabase.from("group_chat_members").upsert({
        group_id: reqRow.group_id,
        user_id: reqRow.requester_id,
        role: "member",
      }, { onConflict: "group_id,user_id" });
    }

    return ok({ success: true });
  }

  // ── list-group-members ─────────────────────────────────────────────────────
  if (action === "list-group-members") {
    const { sessionToken, groupId } = body as any;
    const uid = await sessionUserId(supabase, sessionToken as string);
    if (!uid) return fail("Invalid session", 401);

    const member = await groupMembership(supabase, groupId, uid);
    if (!member) return fail("Not a member", 403);

    const { data, error } = await supabase
      .from("group_chat_members")
      .select("group_id, user_id, role, muted_until, joined_at, user:user_id(id, username, avatar_url)")
      .eq("group_id", groupId)
      .order("joined_at", { ascending: true });
    if (error) return fail(error.message, 500);

    const userIds = (data ?? []).map((m: any) => m.user_id);
    const { data: keys } = userIds.length
      ? await supabase.from("user_public_keys").select("user_id, public_key").in("user_id", userIds)
      : { data: [] as any[] };
    const keyMap = new Map((keys ?? []).map((k: any) => [k.user_id, k.public_key]));

    const members = (data ?? []).map((m: any) => ({
      ...m,
      user: {
        ...(m.user ?? {}),
        public_key: keyMap.get(m.user_id) ?? null,
      },
    }));

    return ok({ success: true, members });
  }

  // ── add-group-member ──────────────────────────────────────────────────────
  if (action === "add-group-member") {
    const { sessionToken, groupId, targetUserId, encryptedGroupKey } = body as any;
    const uid = await sessionUserId(supabase, sessionToken as string);
    if (!uid) return fail("Invalid session", 401);

    const actor = await groupMembership(supabase, groupId, uid);
    if (!actor || !canModerate(actor.role)) return fail("Forbidden", 403);

    const { data: banned } = await supabase
      .from("group_bans")
      .select("id")
      .eq("group_id", groupId)
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (banned) return fail("User is banned", 403);

    const { error: joinErr } = await supabase
      .from("group_chat_members")
      .upsert({ group_id: groupId, user_id: targetUserId, role: "member" }, { onConflict: "group_id,user_id" });
    if (joinErr) return fail(joinErr.message, 500);

    if (encryptedGroupKey) {
      const { data: groupRow } = await supabase
        .from("group_chats")
        .select("key_version")
        .eq("id", groupId)
        .single();
      await supabase.from("group_member_keys").upsert({
        group_id: groupId,
        user_id: targetUserId,
        key_version: Number(groupRow?.key_version ?? 1),
        encrypted_group_key: encryptedGroupKey,
      }, { onConflict: "group_id,user_id,key_version" });
    }

    return ok({ success: true });
  }

  // ── update-group-member ────────────────────────────────────────────────────
  if (action === "update-group-member") {
    const { sessionToken, groupId, targetUserId, operation, role, muteUntil, reason } = body as any;
    const uid = await sessionUserId(supabase, sessionToken as string);
    if (!uid) return fail("Invalid session", 401);

    const actor = await groupMembership(supabase, groupId, uid);
    if (!actor || !canModerate(actor.role)) return fail("Forbidden", 403);

    const target = await groupMembership(supabase, groupId, targetUserId);
    if (!target && operation !== "ban") return fail("Target not in group", 404);
    if (target?.role === "super_admin") return fail("Cannot modify super admin", 403);

    if (operation === "set-role") {
      if (actor.role !== "super_admin") return fail("Only super admin can change roles", 403);
      if (!role || !["member", "admin"].includes(role)) return fail("Invalid role");
      await supabase.from("group_chat_members").update({ role }).eq("group_id", groupId).eq("user_id", targetUserId);
      return ok({ success: true });
    }

    if (operation === "mute") {
      await supabase.from("group_chat_members").update({ muted_until: muteUntil ?? null }).eq("group_id", groupId).eq("user_id", targetUserId);
      return ok({ success: true });
    }

    if (operation === "kick") {
      await supabase.from("group_chat_members").delete().eq("group_id", groupId).eq("user_id", targetUserId);
      return ok({ success: true });
    }

    if (operation === "ban") {
      await supabase.from("group_bans").upsert({
        group_id: groupId,
        user_id: targetUserId,
        banned_by: uid,
        reason: reason ?? null,
      }, { onConflict: "group_id,user_id" });
      await supabase.from("group_chat_members").delete().eq("group_id", groupId).eq("user_id", targetUserId);
      return ok({ success: true });
    }

    return fail("Unknown operation");
  }

  // ── set-group-settings ─────────────────────────────────────────────────────
  if (action === "set-group-settings") {
    const { sessionToken, groupId, announcementMode, inviteRequiresApproval, restrictForwarding } = body as any;
    const uid = await sessionUserId(supabase, sessionToken as string);
    if (!uid) return fail("Invalid session", 401);

    const actor = await groupMembership(supabase, groupId, uid);
    if (!actor || !canModerate(actor.role)) return fail("Forbidden", 403);

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof announcementMode === "boolean") patch.announcement_mode = announcementMode;
    if (typeof inviteRequiresApproval === "boolean") patch.invite_requires_approval = inviteRequiresApproval;
    if (typeof restrictForwarding === "boolean") patch.restrict_forwarding = restrictForwarding;

    const { data, error } = await supabase
      .from("group_chats")
      .update(patch)
      .eq("id", groupId)
      .select("id, announcement_mode, invite_requires_approval, restrict_forwarding, key_version")
      .single();
    if (error) return fail(error.message, 500);
    return ok({ success: true, group: data });
  }

  // ── rotate-group-key ───────────────────────────────────────────────────────
  if (action === "rotate-group-key") {
    const { sessionToken, groupId, keyEnvelopes = {}, reason = "manual" } = body as any;
    const uid = await sessionUserId(supabase, sessionToken as string);
    if (!uid) return fail("Invalid session", 401);

    const actor = await groupMembership(supabase, groupId, uid);
    if (!actor || !canModerate(actor.role)) return fail("Forbidden", 403);

    const { data: grp } = await supabase.from("group_chats").select("id, key_version").eq("id", groupId).maybeSingle();
    if (!grp) return fail("Group not found", 404);

    const oldVersion = grp.key_version;
    const newVersion = oldVersion + 1;

    await supabase.from("group_chats").update({ key_version: newVersion, updated_at: new Date().toISOString() }).eq("id", groupId);

    const keyRows = Object.entries(keyEnvelopes as Record<string, string>).map(([memberId, encryptedGroupKey]) => ({
      group_id: groupId,
      user_id: memberId,
      key_version: newVersion,
      encrypted_group_key: encryptedGroupKey,
    }));
    if (keyRows.length > 0) {
      const { error: keyErr } = await supabase.from("group_member_keys").insert(keyRows);
      if (keyErr) return fail(keyErr.message, 500);
    }

    await supabase.from("group_key_rotations").insert({
      group_id: groupId,
      rotated_by: uid,
      old_version: oldVersion,
      new_version: newVersion,
      reason,
    });

    return ok({ success: true, keyVersion: newVersion });
  }

  // ── get-group-state ────────────────────────────────────────────────────────
  if (action === "get-group-state") {
    const { sessionToken, groupId } = body as any;
    const uid = await sessionUserId(supabase, sessionToken as string);
    if (!uid) return fail("Invalid session", 401);

    const member = await groupMembership(supabase, groupId, uid);
    if (!member) return fail("Not a member", 403);

    const { data: grp } = await supabase
      .from("group_chats")
      .select("id, name, created_by, announcement_mode, invite_requires_approval, restrict_forwarding, key_version")
      .eq("id", groupId)
      .maybeSingle();
    if (!grp) return fail("Group not found", 404);

    const { data: keyRow } = await supabase
      .from("group_member_keys")
      .select("encrypted_group_key")
      .eq("group_id", groupId)
      .eq("user_id", uid)
      .eq("key_version", grp.key_version)
      .maybeSingle();

    return ok({ success: true, group: grp, me: member, encryptedGroupKey: keyRow?.encrypted_group_key ?? null });
  }

  // ── send-group-message ─────────────────────────────────────────────────────
  if (action === "send-group-message") {
    const { sessionToken, groupId, encryptedBody, keyVersion, msgType = "text", fileName, fileSize, mimeType, forwardedFrom = null } = body as any;
    const uid = await sessionUserId(supabase, sessionToken as string);
    if (!uid) return fail("Invalid session", 401);

    const member = await groupMembership(supabase, groupId, uid);
    if (!member) return fail("Not a member", 403);
    if (member.muted_until && new Date(member.muted_until) > new Date()) return fail("You are muted", 403);

    const { data: grp } = await supabase
      .from("group_chats")
      .select("announcement_mode, restrict_forwarding, key_version")
      .eq("id", groupId)
      .maybeSingle();
    if (!grp) return fail("Group not found", 404);

    if (grp.announcement_mode && !canModerate(member.role)) {
      return fail("Only admins can send in announcement mode", 403);
    }
    if (grp.restrict_forwarding && forwardedFrom) {
      return fail("Forwarding is restricted in this group", 403);
    }

    const { data: msg, error } = await supabase
      .from("group_messages")
      .insert({
        group_id: groupId,
        sender_id: uid,
        encrypted_body: encryptedBody,
        key_version: keyVersion ?? grp.key_version,
        msg_type: msgType,
        file_name: fileName ?? null,
        file_size: fileSize ?? null,
        mime_type: mimeType ?? null,
        forwarded_from: forwardedFrom,
      })
      .select("id, group_id, sender_id, encrypted_body, key_version, msg_type, file_name, file_size, mime_type, created_at")
      .single();
    if (error) return fail(error.message, 500);

    await supabase.from("group_chat_members").update({ last_delivered_at: new Date().toISOString() }).eq("group_id", groupId).neq("user_id", uid);

    return ok({ success: true, message: msg });
  }

  // ── get-group-messages ─────────────────────────────────────────────────────
  if (action === "get-group-messages") {
    const { sessionToken, groupId, before } = body as any;
    const uid = await sessionUserId(supabase, sessionToken as string);
    if (!uid) return fail("Invalid session", 401);
    const member = await groupMembership(supabase, groupId, uid);
    if (!member) return fail("Not a member", 403);

    let q = supabase
      .from("group_messages")
      .select("id, group_id, sender_id, encrypted_body, key_version, msg_type, file_name, file_size, mime_type, forwarded_from, created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(80);
    if (before) q = q.lt("created_at", before);

    const { data: messages, error } = await q;
    if (error) return fail(error.message, 500);

    const deliverRows = (messages ?? []).filter((m: any) => m.sender_id !== uid).map((m: any) => ({
      message_id: m.id,
      user_id: uid,
      status: "delivered",
    }));
    if (deliverRows.length) {
      await supabase.from("group_message_receipts").upsert(deliverRows, { onConflict: "message_id,user_id,status", ignoreDuplicates: true });
    }

    return ok({ success: true, messages: messages ?? [] });
  }

  // ── set-group-receipt ──────────────────────────────────────────────────────
  if (action === "set-group-receipt") {
    const { sessionToken, groupId, messageId, status } = body as any;
    const uid = await sessionUserId(supabase, sessionToken as string);
    if (!uid) return fail("Invalid session", 401);
    const member = await groupMembership(supabase, groupId, uid);
    if (!member) return fail("Not a member", 403);
    if (!["delivered", "seen"].includes(status)) return fail("Invalid receipt status");

    await supabase.from("group_message_receipts").upsert({
      message_id: messageId,
      user_id: uid,
      status,
    }, { onConflict: "message_id,user_id,status", ignoreDuplicates: true });

    if (status === "seen") {
      await supabase.from("group_chat_members").update({ last_read_at: new Date().toISOString() }).eq("group_id", groupId).eq("user_id", uid);
    }

    return ok({ success: true });
  }

  // ── set-group-typing ───────────────────────────────────────────────────────
  if (action === "set-group-typing") {
    const { sessionToken, groupId, isTyping } = body as any;
    const uid = await sessionUserId(supabase, sessionToken as string);
    if (!uid) return fail("Invalid session", 401);
    const member = await groupMembership(supabase, groupId, uid);
    if (!member) return fail("Not a member", 403);

    await supabase.from("group_typing_presence").upsert({
      group_id: groupId,
      user_id: uid,
      is_typing: Boolean(isTyping),
      updated_at: new Date().toISOString(),
    }, { onConflict: "group_id,user_id" });
    return ok({ success: true });
  }

  // ── report-group-user ──────────────────────────────────────────────────────
  if (action === "report-group-user") {
    const { sessionToken, groupId, reportedUserId, reason, messageId = null } = body as any;
    const uid = await sessionUserId(supabase, sessionToken as string);
    if (!uid) return fail("Invalid session", 401);
    const member = await groupMembership(supabase, groupId, uid);
    if (!member) return fail("Not a member", 403);
    if (!reason || String(reason).trim().length < 3) return fail("Reason required");

    const { error } = await supabase.from("group_reports").insert({
      group_id: groupId,
      reporter_id: uid,
      reported_user_id: reportedUserId,
      reason: String(reason).trim(),
      message_id: messageId,
    });
    if (error) return fail(error.message, 500);
    return ok({ success: true });
  }

  return fail(`Unknown action: ${action}`);
});
