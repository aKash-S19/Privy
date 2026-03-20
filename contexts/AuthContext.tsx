import * as SecureStore from 'expo-secure-store';
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';

import { getOrCreateDeviceId } from '@/lib/deviceId';
import { getOrCreatePublicKey } from '@/lib/e2ee';
import { callAuthFunction } from '@/lib/supabase';

// ─── Keys ────────────────────────────────────────────────────────────────────
const SESSION_KEY = 'privy_session_token';
const USER_KEY    = 'privy_user_info';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface UserInfo {
  id:              string;
  username:        string;
  created_at:      string;
  avatar_url?:     string | null;
  // populated only in search results
  requestStatus?:  string;
  chatId?:         string | null;
  peerPublicKey?:  string | null;
}

export interface Message {
  id:             string;
  chat_id:        string;
  sender_id:      string;
  encrypted_body: string;
  msg_type:       'text' | 'image' | 'video' | 'file' | 'voice';
  file_name?:     string | null;
  file_size?:     number | null;
  mime_type?:     string | null;
  status:         'sent' | 'delivered' | 'read';
  created_at:     string;
}

export interface ChatRow {
  chat_id:         string;
  joined_at:       string;
  user:            UserInfo;
  peer_public_key: string | null;
  last_message:    Pick<Message, 'id' | 'encrypted_body' | 'msg_type' | 'sender_id' | 'created_at' | 'status'> | null;
  unread_count:    number;
  last_message_at: string;
}

export interface GroupRow {
  id: string;
  name: string;
  role: 'member' | 'admin' | 'super_admin';
  announcement_mode: boolean;
  invite_requires_approval: boolean;
  restrict_forwarding: boolean;
  key_version: number;
  created_by: string;
  joined_at: string;
  unread_count: number;
  last_message: {
    id: string;
    sender_id: string;
    msg_type: 'text' | 'image' | 'video' | 'file' | 'voice';
    created_at: string;
  } | null;
  last_message_at: string;
}

export interface GroupMemberRow {
  group_id: string;
  user_id: string;
  role: 'member' | 'admin' | 'super_admin';
  muted_until?: string | null;
  joined_at: string;
  user: { id: string; username: string; avatar_url?: string | null; public_key?: string | null };
}

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  encrypted_body: string;
  key_version: number;
  msg_type: 'text' | 'image' | 'video' | 'file' | 'voice';
  file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  forwarded_from?: string | null;
  created_at: string;
}

interface AuthContextType {
  /** 'boot' = splash/loading, 'unauthenticated', 'authenticated' */
  status:         'boot' | 'unauthenticated' | 'authenticated';
  user:           UserInfo | null;
  /** Username already linked to this device (skip new-user flow) */
  deviceUsername: string | null;
  sessionToken:   string | null;

  register:      (username: string, emoji: string[]) => Promise<void>;
  login:         (emoji: string[]) => Promise<void>;
  loginWithUsername: (username: string, emoji: string[]) => Promise<void>;
  recoverInit:   (username: string) => Promise<{ question: string }>;
  recoverVerify: (username: string, answer: string, newEmoji: string[]) => Promise<void>;
  signOut:       () => Promise<void>;
  deleteAccount: (emoji: string[]) => Promise<void>;
  findUser:      (query: string) => Promise<UserInfo[]>;
  checkUsername: (username: string) => Promise<{ available: boolean; reason?: string }>;
  updateUser:    (u: UserInfo) => void;
  sendFriendRequest: (toUserId: string) => Promise<void>;
  getChats:          () => Promise<ChatRow[]>;
  sendMessage:       (chatId: string, encryptedBody: string, msgType?: string, fileMeta?: { fileName?: string; fileSize?: number; mimeType?: string }) => Promise<Message>;
  getMessages:       (chatId: string, before?: string) => Promise<Message[]>;
  markRead:          (chatId: string) => Promise<void>;
  deleteMessage:     (messageId: string, forEveryone: boolean) => Promise<void>;
  deleteChat:        (chatId: string) => Promise<void>;
  openChat:          (peerId: string) => Promise<{ chatId: string; peerPublicKey: string | null }>;
  removeFriend:      (peerId: string) => Promise<void>;
  listGroups:        () => Promise<GroupRow[]>;
  createGroup:       (name: string, memberIds: string[], keyEnvelopes?: Record<string, string>, inviteRequiresApproval?: boolean) => Promise<GroupRow>;
  getGroupState:     (groupId: string) => Promise<{ group: GroupRow; me: { role: GroupMemberRow['role'] }; encryptedGroupKey: string | null }>;
  listGroupMembers:  (groupId: string) => Promise<GroupMemberRow[]>;
  addGroupMember:    (groupId: string, targetUserId: string, encryptedGroupKey?: string) => Promise<void>;
  updateGroupMember: (groupId: string, targetUserId: string, operation: 'set-role' | 'mute' | 'kick' | 'ban', extras?: { role?: 'member' | 'admin'; muteUntil?: string | null; reason?: string }) => Promise<void>;
  setGroupSettings:  (groupId: string, patch: { announcementMode?: boolean; inviteRequiresApproval?: boolean; restrictForwarding?: boolean }) => Promise<void>;
  createGroupInvite: (groupId: string, expiresInHours?: number, maxUses?: number | null) => Promise<{ invite_token: string; expires_at: string | null }>;
  joinGroupViaInvite:(inviteToken: string) => Promise<{ pending: boolean; groupId?: string }>;
  getGroupJoinRequests: (groupId: string) => Promise<Array<{ id: string; requester_id: string; requested_at: string; user: { id: string; username: string; avatar_url?: string | null } }>>;
  resolveGroupJoinRequest: (requestId: string, approve: boolean) => Promise<void>;
  rotateGroupKey:    (groupId: string, keyEnvelopes: Record<string, string>, reason?: string) => Promise<number>;
  sendGroupMessage:  (groupId: string, encryptedBody: string, keyVersion: number, msgType?: GroupMessage['msg_type'], fileMeta?: { fileName?: string; fileSize?: number; mimeType?: string }, forwardedFrom?: string | null) => Promise<GroupMessage>;
  getGroupMessages:  (groupId: string, before?: string) => Promise<GroupMessage[]>;
  setGroupTyping:    (groupId: string, isTyping: boolean) => Promise<void>;
  setGroupReceipt:   (groupId: string, messageId: string, status: 'delivered' | 'seen') => Promise<void>;
  reportGroupUser:   (groupId: string, reportedUserId: string, reason: string, messageId?: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// ─── Provider ────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status,         setStatus]         = useState<'boot' | 'unauthenticated' | 'authenticated'>('boot');
  const [user,           setUser]           = useState<UserInfo | null>(null);
  const [deviceUsername, setDeviceUsername] = useState<string | null>(null);
  const [sessionToken,   setSessionToken]   = useState<string | null>(null);

  // ── Boot: check stored session → fallback to device check ────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Fast path: restore session from secure storage
        const storedToken = await SecureStore.getItemAsync(SESSION_KEY);
        const storedUser  = await SecureStore.getItemAsync(USER_KEY);
        if (storedToken && storedUser) {
          const u = JSON.parse(storedUser) as UserInfo;
          if (mounted) {
            setSessionToken(storedToken);
            setUser(u);
            setStatus('authenticated');
          }
          // Re-upload ECDH public key on every boot — retry up to 5 times so
          // transient network/crypto errors don't silently leave the key missing.
          (async () => {
            for (let i = 0; i < 5; i++) {
              try {
                const publicKey = await getOrCreatePublicKey();
                await callAuthFunction({ action: 'store-public-key', sessionToken: storedToken, publicKey });
                break; // success
              } catch {
                await new Promise(r => setTimeout(r, 2000 * (i + 1)));
              }
            }
          })();
          return; // skip device check — already logged in
        }

        // Check if this device already has a registered account
        try {
          const deviceId = await getOrCreateDeviceId();
          const res = await callAuthFunction({ action: 'check-device', deviceId });
          if (res.found && mounted) {
            setDeviceUsername(res.user.username);
          }
        } catch {}

      } catch {
        // Network or storage error — proceed to normal auth flow
      }
      if (mounted) setStatus('unauthenticated');
    })();
    return () => { mounted = false; };
  }, []);

  // ── Persist helpers ───────────────────────────────────────────────────────
  const saveSession = useCallback(async (token: string, userInfo: UserInfo) => {
    await SecureStore.setItemAsync(SESSION_KEY, token);
    await SecureStore.setItemAsync(USER_KEY,    JSON.stringify(userInfo));
    setSessionToken(token);
    setUser(userInfo);
    setStatus('authenticated');
    // Upload ECDH public key — retry up to 5 times
    (async () => {
      for (let i = 0; i < 5; i++) {
        try {
          const publicKey = await getOrCreatePublicKey();
          await callAuthFunction({ action: 'store-public-key', sessionToken: token, publicKey });
          break;
        } catch {
          await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        }
      }
    })();
  }, []);
  const register = useCallback(async (username: string, emoji: string[]) => {
    const deviceId  = await getOrCreateDeviceId();
    const publicKey = await getOrCreatePublicKey();   // generate key BEFORE the server call
    const res = await callAuthFunction({
      action: 'register', username, emojiKey: emoji, deviceId, publicKey,
    });
    await saveSession(res.sessionToken, res.user);
  }, [saveSession]);

  const login = useCallback(async (emoji: string[]) => {
    const deviceId  = await getOrCreateDeviceId();
    const publicKey = await getOrCreatePublicKey();
    const res = await callAuthFunction({
      action: 'login', emojiKey: emoji, deviceId, publicKey,
    });
    await saveSession(res.sessionToken, res.user);
  }, [saveSession]);

  const loginWithUsername = useCallback(async (username: string, emoji: string[]) => {
    const deviceId  = await getOrCreateDeviceId();
    const publicKey = await getOrCreatePublicKey();
    const res = await callAuthFunction({
      action: 'login-username', username, emojiKey: emoji, deviceId, publicKey,
    });
    await saveSession(res.sessionToken, res.user);
  }, [saveSession]);

  const recoverInit = useCallback(async (username: string) => {
    return callAuthFunction({ action: 'recover-init', username });
  }, []);

  const recoverVerify = useCallback(async (
    username: string, answer: string, newEmoji: string[],
  ) => {
    const publicKey = await getOrCreatePublicKey();
    const res = await callAuthFunction({
      action: 'recover-verify', username, answer, newEmojiKey: newEmoji, publicKey,
    });
    await saveSession(res.sessionToken, res.user);
  }, [saveSession]);

  const signOut = useCallback(async () => {
    if (sessionToken) {
      try { await callAuthFunction({ action: 'signout', sessionToken }); } catch {}
    }
    await SecureStore.deleteItemAsync(SESSION_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    setUser(null);
    setSessionToken(null);
    setDeviceUsername(null);
    setStatus('unauthenticated');
  }, [sessionToken]);

  const deleteAccount = useCallback(async (emoji: string[]) => {
    if (!sessionToken) throw new Error('Not authenticated');
    await callAuthFunction({ action: 'delete-account', sessionToken, emojiKey: emoji });
    await SecureStore.deleteItemAsync(SESSION_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    setUser(null);
    setSessionToken(null);
    setDeviceUsername(null);
    setStatus('unauthenticated');
  }, [sessionToken]);

  const findUser = useCallback(async (query: string): Promise<UserInfo[]> => {
    if (!sessionToken) return [];
    const res = await callAuthFunction({ action: 'find-user', query, sessionToken });
    return res.users ?? [];
  }, [sessionToken]);

  const checkUsername = useCallback(async (username: string) => {
    return callAuthFunction({ action: 'check-username', username });
  }, []);

  const updateUser = useCallback((u: UserInfo) => {
    setUser(u);
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(u)).catch(() => {});
  }, []);

  const sendFriendRequest = useCallback(async (toUserId: string) => {
    if (!sessionToken) throw new Error('Not authenticated');
    await callAuthFunction({ action: 'send-request', sessionToken, toUserId });
  }, [sessionToken]);

  const getChats = useCallback(async (): Promise<ChatRow[]> => {
    if (!sessionToken) return [];
    const res = await callAuthFunction({ action: 'get-chats', sessionToken });
    return res.chats ?? [];
  }, [sessionToken]);

  const sendMessage = useCallback(async (
    chatId: string,
    encryptedBody: string,
    msgType = 'text',
    fileMeta?: { fileName?: string; fileSize?: number; mimeType?: string },
  ): Promise<Message> => {
    if (!sessionToken) throw new Error('Not authenticated');
    const res = await callAuthFunction({
      action: 'send-message', sessionToken, chatId,
      encryptedBody, msgType, ...fileMeta,
    });
    return res.message as Message;
  }, [sessionToken]);

  const getMessages = useCallback(async (chatId: string, before?: string): Promise<Message[]> => {
    if (!sessionToken) return [];
    const res = await callAuthFunction({ action: 'get-messages', sessionToken, chatId, before });
    return (res.messages ?? []) as Message[];
  }, [sessionToken]);

  const markRead = useCallback(async (chatId: string): Promise<void> => {
    if (!sessionToken) return;
    await callAuthFunction({ action: 'mark-read', sessionToken, chatId });
  }, [sessionToken]);

  const deleteMessage = useCallback(async (messageId: string, forEveryone: boolean): Promise<void> => {
    if (!sessionToken) throw new Error('Not authenticated');
    await callAuthFunction({ action: 'delete-message', sessionToken, messageId, forEveryone });
  }, [sessionToken]);

  const deleteChat = useCallback(async (chatId: string): Promise<void> => {
    if (!sessionToken) throw new Error('Not authenticated');
    await callAuthFunction({ action: 'delete-chat', sessionToken, chatId });
  }, [sessionToken]);

  const openChat = useCallback(async (peerId: string): Promise<{ chatId: string; peerPublicKey: string | null }> => {
    if (!sessionToken) throw new Error('Not authenticated');
    const res = await callAuthFunction({ action: 'open-chat', sessionToken, peerId });
    return { chatId: res.chatId as string, peerPublicKey: (res.peerPublicKey as string | null) ?? null };
  }, [sessionToken]);

  const removeFriend = useCallback(async (peerId: string): Promise<void> => {
    if (!sessionToken) throw new Error('Not authenticated');
    await callAuthFunction({ action: 'remove-friend', sessionToken, peerId });
  }, [sessionToken]);

  const listGroups = useCallback(async (): Promise<GroupRow[]> => {
    if (!sessionToken) return [];
    const res = await callAuthFunction({ action: 'list-groups', sessionToken });
    return (res.groups ?? []) as GroupRow[];
  }, [sessionToken]);

  const createGroup = useCallback(async (
    name: string,
    memberIds: string[],
    keyEnvelopes: Record<string, string> = {},
    inviteRequiresApproval = false,
  ): Promise<GroupRow> => {
    if (!sessionToken) throw new Error('Not authenticated');
    const res = await callAuthFunction({
      action: 'create-group',
      sessionToken,
      name,
      memberIds,
      keyEnvelopes,
      inviteRequiresApproval,
    });
    return res.group as GroupRow;
  }, [sessionToken]);

  const getGroupState = useCallback(async (groupId: string) => {
    if (!sessionToken) throw new Error('Not authenticated');
    const res = await callAuthFunction({ action: 'get-group-state', sessionToken, groupId });
    return {
      group: res.group as GroupRow,
      me: res.me as { role: GroupMemberRow['role'] },
      encryptedGroupKey: (res.encryptedGroupKey as string | null) ?? null,
    };
  }, [sessionToken]);

  const listGroupMembers = useCallback(async (groupId: string): Promise<GroupMemberRow[]> => {
    if (!sessionToken) throw new Error('Not authenticated');
    const res = await callAuthFunction({ action: 'list-group-members', sessionToken, groupId });
    return (res.members ?? []) as GroupMemberRow[];
  }, [sessionToken]);

  const addGroupMember = useCallback(async (groupId: string, targetUserId: string, encryptedGroupKey?: string) => {
    if (!sessionToken) throw new Error('Not authenticated');
    await callAuthFunction({ action: 'add-group-member', sessionToken, groupId, targetUserId, encryptedGroupKey });
  }, [sessionToken]);

  const updateGroupMember = useCallback(async (
    groupId: string,
    targetUserId: string,
    operation: 'set-role' | 'mute' | 'kick' | 'ban',
    extras: { role?: 'member' | 'admin'; muteUntil?: string | null; reason?: string } = {},
  ) => {
    if (!sessionToken) throw new Error('Not authenticated');
    await callAuthFunction({
      action: 'update-group-member',
      sessionToken,
      groupId,
      targetUserId,
      operation,
      role: extras.role,
      muteUntil: extras.muteUntil,
      reason: extras.reason,
    });
  }, [sessionToken]);

  const setGroupSettings = useCallback(async (
    groupId: string,
    patch: { announcementMode?: boolean; inviteRequiresApproval?: boolean; restrictForwarding?: boolean },
  ) => {
    if (!sessionToken) throw new Error('Not authenticated');
    await callAuthFunction({ action: 'set-group-settings', sessionToken, groupId, ...patch });
  }, [sessionToken]);

  const createGroupInvite = useCallback(async (
    groupId: string,
    expiresInHours = 72,
    maxUses: number | null = null,
  ) => {
    if (!sessionToken) throw new Error('Not authenticated');
    const res = await callAuthFunction({ action: 'create-group-invite', sessionToken, groupId, expiresInHours, maxUses });
    return res.invite as { invite_token: string; expires_at: string | null };
  }, [sessionToken]);

  const joinGroupViaInvite = useCallback(async (inviteToken: string) => {
    if (!sessionToken) throw new Error('Not authenticated');
    const res = await callAuthFunction({ action: 'join-group-via-invite', sessionToken, inviteToken });
    return { pending: Boolean(res.pending), groupId: res.groupId as string | undefined };
  }, [sessionToken]);

  const getGroupJoinRequests = useCallback(async (groupId: string) => {
    if (!sessionToken) throw new Error('Not authenticated');
    const res = await callAuthFunction({ action: 'get-group-join-requests', sessionToken, groupId });
    return (res.requests ?? []) as Array<{ id: string; requester_id: string; requested_at: string; user: { id: string; username: string; avatar_url?: string | null } }>;
  }, [sessionToken]);

  const resolveGroupJoinRequest = useCallback(async (requestId: string, approve: boolean) => {
    if (!sessionToken) throw new Error('Not authenticated');
    await callAuthFunction({ action: 'resolve-group-join-request', sessionToken, requestId, approve });
  }, [sessionToken]);

  const rotateGroupKey = useCallback(async (groupId: string, keyEnvelopes: Record<string, string>, reason = 'manual') => {
    if (!sessionToken) throw new Error('Not authenticated');
    const res = await callAuthFunction({ action: 'rotate-group-key', sessionToken, groupId, keyEnvelopes, reason });
    return Number(res.keyVersion ?? 1);
  }, [sessionToken]);

  const sendGroupMessage = useCallback(async (
    groupId: string,
    encryptedBody: string,
    keyVersion: number,
    msgType: GroupMessage['msg_type'] = 'text',
    fileMeta?: { fileName?: string; fileSize?: number; mimeType?: string },
    forwardedFrom: string | null = null,
  ): Promise<GroupMessage> => {
    if (!sessionToken) throw new Error('Not authenticated');
    const res = await callAuthFunction({
      action: 'send-group-message',
      sessionToken,
      groupId,
      encryptedBody,
      keyVersion,
      msgType,
      fileName: fileMeta?.fileName,
      fileSize: fileMeta?.fileSize,
      mimeType: fileMeta?.mimeType,
      forwardedFrom,
    });
    return res.message as GroupMessage;
  }, [sessionToken]);

  const getGroupMessages = useCallback(async (groupId: string, before?: string): Promise<GroupMessage[]> => {
    if (!sessionToken) return [];
    const res = await callAuthFunction({ action: 'get-group-messages', sessionToken, groupId, before });
    return (res.messages ?? []) as GroupMessage[];
  }, [sessionToken]);

  const setGroupTyping = useCallback(async (groupId: string, isTyping: boolean) => {
    if (!sessionToken) return;
    await callAuthFunction({ action: 'set-group-typing', sessionToken, groupId, isTyping });
  }, [sessionToken]);

  const setGroupReceipt = useCallback(async (groupId: string, messageId: string, status: 'delivered' | 'seen') => {
    if (!sessionToken) return;
    await callAuthFunction({ action: 'set-group-receipt', sessionToken, groupId, messageId, status });
  }, [sessionToken]);

  const reportGroupUser = useCallback(async (groupId: string, reportedUserId: string, reason: string, messageId: string | null = null) => {
    if (!sessionToken) throw new Error('Not authenticated');
    await callAuthFunction({ action: 'report-group-user', sessionToken, groupId, reportedUserId, reason, messageId });
  }, [sessionToken]);

  return (
    <AuthContext.Provider value={{
      status, user, deviceUsername, sessionToken,
      register, login, loginWithUsername, recoverInit, recoverVerify,
      signOut, deleteAccount, findUser, checkUsername, updateUser,
      sendFriendRequest, getChats,
      sendMessage, getMessages, markRead, deleteMessage, deleteChat, openChat, removeFriend,
      listGroups, createGroup, getGroupState, listGroupMembers, addGroupMember, updateGroupMember,
      setGroupSettings, createGroupInvite, joinGroupViaInvite, getGroupJoinRequests,
      resolveGroupJoinRequest, rotateGroupKey, sendGroupMessage, getGroupMessages,
      setGroupTyping, setGroupReceipt, reportGroupUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth() {
  return useContext(AuthContext);
}

