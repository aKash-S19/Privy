import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GroupMemberRow, GroupMessage, useAuth } from '@/contexts/AuthContext';
import { useAppTheme } from '@/hooks/use-app-theme';
import { base64ToUint8Array, decryptMessage, encryptMessage } from '@/lib/e2ee';
import { encryptGroupKeyEnvelope, ensureLocalGroupKey, loadGroupKey, randomGroupKeyB64, saveGroupKey } from '@/lib/group-e2ee';
import { supabaseClient } from '@/lib/supabase';

function timeLabel(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function groupInitial(name: string) {
  const c = name.trim()[0];
  return (c ? c : 'G').toUpperCase();
}

export default function GroupRoomScreen() {
  const th = useAppTheme();
  const params = useLocalSearchParams<{ id: string; name?: string }>();
  const groupId = String(params.id || '');

  const {
    user,
    findUser,
    getGroupState,
    listGroupMembers,
    addGroupMember,
    createGroupInvite,
    getGroupJoinRequests,
    resolveGroupJoinRequest,
    updateGroupMember,
    rotateGroupKey,
    sendGroupMessage,
    getGroupMessages,
    setGroupTyping,
    setGroupReceipt,
    reportGroupUser,
  } = useAuth();

  const [groupName, setGroupName] = useState(params.name || 'Group');
  const [meRole, setMeRole] = useState<'member' | 'admin' | 'super_admin'>('member');
  const [keyVersion, setKeyVersion] = useState(1);

  const [members, setMembers] = useState<GroupMemberRow[]>([]);
  const memberMap = useMemo(() => new Map(members.map((m) => [m.user_id, m.user.username])), [members]);

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [decrypted, setDecrypted] = useState<Record<string, string>>({});

  const [text, setText] = useState('');
  const [busy, setBusy] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [requests, setRequests] = useState<Array<{ id: string; requester_id: string; requested_at: string; user: { id: string; username: string } }>>([]);
  const [showAdminTools, setShowAdminTools] = useState(false);

  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string; peerPublicKey?: string | null }>>([]);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAll = useCallback(async () => {
    if (!groupId) return;
    setBusy(true);
    try {
      const [state, m, msgs] = await Promise.all([
        getGroupState(groupId),
        listGroupMembers(groupId),
        getGroupMessages(groupId),
      ]);

      setGroupName(state.group.name);
      setMeRole(state.me.role);
      setKeyVersion(state.group.key_version);
      setMembers(m);
      setMessages(msgs);

      await ensureLocalGroupKey(groupId, state.group.key_version, state.encryptedGroupKey);
    } finally {
      setBusy(false);
    }
  }, [groupId, getGroupState, listGroupMembers, getGroupMessages]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    let gone = false;
    (async () => {
      const out: Record<string, string> = {};
      for (const msg of messages) {
        try {
          const keyB64 = await loadGroupKey(msg.group_id, msg.key_version);
          if (!keyB64) {
            out[msg.id] = 'Unable to decrypt';
            continue;
          }
          out[msg.id] = await decryptMessage(base64ToUint8Array(keyB64), msg.encrypted_body);
        } catch {
          out[msg.id] = 'Unable to decrypt';
        }
      }
      if (!gone) setDecrypted(out);
    })();
    return () => {
      gone = true;
    };
  }, [messages]);

  useEffect(() => {
    if (!groupId || !user?.id) return;
    const channel = supabaseClient
      .channel(`group:${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` }, async () => {
        const msgs = await getGroupMessages(groupId);
        setMessages(msgs);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_typing_presence', filter: `group_id=eq.${groupId}` }, async () => {
        const { data } = await supabaseClient
          .from('group_typing_presence')
          .select('user_id, expires_at')
          .eq('group_id', groupId);
        const active = (data ?? [])
          .filter((r: any) => new Date(r.expires_at).getTime() > Date.now() && r.user_id !== user.id)
          .map((r: any) => memberMap.get(r.user_id) || 'Someone');
        setTypingUsers(active);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [groupId, user?.id, getGroupMessages, memberMap]);

  const onType = useCallback((v: string) => {
    setText(v);
    setGroupTyping(groupId, v.trim().length > 0).catch(() => {});
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setGroupTyping(groupId, false).catch(() => {});
    }, 2000);
  }, [groupId, setGroupTyping]);

  const onSend = useCallback(async () => {
    const plain = text.trim();
    if (!plain) return;

    const keyB64 = await loadGroupKey(groupId, keyVersion);
    if (!keyB64) {
      Alert.alert('Missing group key', 'Try reopening this group to re-sync keys.');
      return;
    }

    try {
      const encryptedBody = await encryptMessage(base64ToUint8Array(keyB64), plain);
      const msg = await sendGroupMessage(groupId, encryptedBody, keyVersion, 'text');
      setMessages((prev) => [msg, ...prev]);
      setText('');
      setGroupTyping(groupId, false).catch(() => {});
      await setGroupReceipt(groupId, msg.id, 'delivered');
    } catch (e: any) {
      Alert.alert('Send failed', e?.message ?? 'Could not send message');
    }
  }, [text, groupId, keyVersion, sendGroupMessage, setGroupTyping, setGroupReceipt]);

  const onRotateKey = useCallback(async () => {
    try {
      const fresh = randomGroupKeyB64();
      const envelopes: Record<string, string> = {};
      for (const m of members) {
        const pk = m.user.public_key;
        if (!pk) continue;
        envelopes[m.user_id] = await encryptGroupKeyEnvelope(pk, fresh);
      }
      const ver = await rotateGroupKey(groupId, envelopes, 'manual-rotation');
      await saveGroupKey(groupId, ver, fresh);
      setKeyVersion(ver);
      Alert.alert('Rotated', `Group key rotated to v${ver}`);
    } catch (e: any) {
      Alert.alert('Rotation failed', e?.message ?? 'Unable to rotate');
    }
  }, [members, rotateGroupKey, groupId]);

  const onCreateInvite = useCallback(async () => {
    try {
      const inv = await createGroupInvite(groupId, 72, 50);
      setInviteToken(inv.invite_token);
    } catch (e: any) {
      Alert.alert('Invite failed', e?.message ?? 'Unable to create invite');
    }
  }, [createGroupInvite, groupId]);

  const onLoadRequests = useCallback(async () => {
    try {
      const r = await getGroupJoinRequests(groupId);
      setRequests(r as any);
    } catch (e: any) {
      Alert.alert('Load failed', e?.message ?? 'Unable to load requests');
    }
  }, [getGroupJoinRequests, groupId]);

  const onSearchUsers = useCallback(async () => {
    if (!userSearch.trim()) return;
    const found = await findUser(userSearch.trim());
    setSearchResults(found.filter((u) => !members.some((m) => m.user_id === u.id)));
  }, [findUser, userSearch, members]);

  const onAddMember = useCallback(async (targetId: string, peerPublicKey?: string | null) => {
    try {
      const keyB64 = await loadGroupKey(groupId, keyVersion);
      if (!keyB64 || !peerPublicKey) throw new Error('Missing encryption key for target user');
      const envelope = await encryptGroupKeyEnvelope(peerPublicKey, keyB64);
      await addGroupMember(groupId, targetId, envelope);
      const refreshed = await listGroupMembers(groupId);
      setMembers(refreshed);
      setSearchResults((prev) => prev.filter((x) => x.id !== targetId));
    } catch (e: any) {
      Alert.alert('Add failed', e?.message ?? 'Unable to add member');
    }
  }, [groupId, keyVersion, addGroupMember, listGroupMembers]);

  if (busy) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: th.bg, justifyContent: 'center' }]}> 
        <ActivityIndicator color={th.accent} size="large" />
      </SafeAreaView>
    );
  }

  const canModerate = meRole === 'admin' || meRole === 'super_admin';

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: th.bg }]}> 
      <View style={[s.header, { borderBottomColor: th.divider, backgroundColor: th.cardBg }]}> 
        <View style={s.headerLeft}>
          <View style={[s.groupBadge, { backgroundColor: th.accent + '22' }]}> 
            <Text style={{ color: th.accent, fontWeight: '800' }}>{groupInitial(groupName)}</Text>
          </View>
          <View>
          <Text style={[s.title, { color: th.textDark }]} numberOfLines={1}>{groupName}</Text>
          <Text style={{ color: th.textSoft }}>{members.length} members · {meRole}</Text>
          </View>
        </View>
        <View style={s.rowInline}>
        {canModerate && (
          <Pressable
            style={[s.smallBtn, { backgroundColor: th.inputBg }]}
            onPress={() => setShowAdminTools((v) => !v)}
          >
            <MaterialCommunityIcons name={showAdminTools ? 'tune-vertical' : 'tune'} size={18} color={th.textDark} />
          </Pressable>
        )}
        {canModerate && (
          <Pressable style={[s.smallBtn, { backgroundColor: th.inputBg }]} onPress={onRotateKey}>
            <MaterialCommunityIcons name="key-variant" size={18} color={th.textDark} />
          </Pressable>
        )}
        </View>
      </View>

      <View pointerEvents="none" style={s.bgLayer}>
        <View style={[s.bgOrb, { backgroundColor: th.accent + '12', top: 40, left: -30 }]} />
        <View style={[s.bgOrb, { backgroundColor: th.accent + '0D', top: 280, right: -20 }]} />
      </View>

      {typingUsers.length > 0 && (
        <View style={s.typingWrap}>
          <Text style={[s.typing, { color: th.textSoft }]}>{typingUsers.join(', ')} typing…</Text>
        </View>
      )}

      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 86 }}
        inverted
        renderItem={({ item }) => {
          const mine = item.sender_id === user?.id;
          const name = memberMap.get(item.sender_id) || 'Member';
          return (
            <Pressable
              onLongPress={() => reportGroupUser(groupId, item.sender_id, 'Reported from message', item.id).catch(() => {})}
              style={[
                s.bubble,
                {
                  backgroundColor: mine ? th.accent : th.cardBg,
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  borderColor: mine ? th.accent : th.divider,
                },
              ]}
            >
              {!mine && <Text style={[s.sender, { color: th.textSoft }]}>{name}</Text>}
              <Text style={{ color: mine ? '#fff' : th.textDark }}>{decrypted[item.id] ?? 'Decrypting…'}</Text>
              <Text style={[s.ts, { color: mine ? '#E8FBF3' : th.textSoft }]}>{timeLabel(item.created_at)}</Text>
            </Pressable>
          );
        }}
      />

      {canModerate && showAdminTools && (
        <View style={[s.admin, { borderTopColor: th.divider, backgroundColor: th.cardBg }]}> 
          <View style={s.rowInline}>
            <Pressable style={[s.smallBtn, { backgroundColor: th.inputBg }]} onPress={onCreateInvite}>
              <Text style={{ color: th.textDark, fontWeight: '700' }}>Invite Link</Text>
            </Pressable>
            <Pressable style={[s.smallBtn, { backgroundColor: th.inputBg }]} onPress={onLoadRequests}>
              <Text style={{ color: th.textDark, fontWeight: '700' }}>Join Requests</Text>
            </Pressable>
          </View>

          {inviteToken ? <Text style={{ color: th.textSoft }}>Token: {inviteToken}</Text> : null}

          {requests.map((r) => (
            <View key={r.id} style={s.reqRow}>
              <Text style={{ color: th.textDark, flex: 1 }}>{r.user.username}</Text>
              <Pressable onPress={() => resolveGroupJoinRequest(r.id, true).then(onLoadRequests)}><Text style={{ color: th.accent, fontWeight: '700' }}>Approve</Text></Pressable>
              <Pressable onPress={() => resolveGroupJoinRequest(r.id, false).then(onLoadRequests)}><Text style={{ color: '#E45A5A', fontWeight: '700' }}>Reject</Text></Pressable>
            </View>
          ))}

          <View style={s.searchRow}>
            <TextInput
              value={userSearch}
              onChangeText={setUserSearch}
              placeholder="Find user to add"
              placeholderTextColor={th.textSoft}
              style={[s.input, { backgroundColor: th.inputBg, borderColor: th.divider, color: th.textDark }]}
            />
            <Pressable style={[s.smallBtn, { backgroundColor: th.accent }]} onPress={onSearchUsers}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Search</Text>
            </Pressable>
          </View>

          {searchResults.slice(0, 4).map((u) => (
            <View key={u.id} style={s.reqRow}>
              <Text style={{ color: th.textDark, flex: 1 }}>{u.username}</Text>
              <Pressable onPress={() => onAddMember(u.id, u.peerPublicKey)}><Text style={{ color: th.accent, fontWeight: '700' }}>Add</Text></Pressable>
            </View>
          ))}

          <Text style={{ color: th.textSoft, marginTop: 6 }}>Members</Text>
          {members.map((m) => (
            <View key={m.user_id} style={s.reqRow}>
              <Text style={{ color: th.textDark, flex: 1 }}>{m.user.username} ({m.role})</Text>
              {canModerate && m.user_id !== user?.id && (
                <>
                  <Pressable onPress={() => updateGroupMember(groupId, m.user_id, 'mute', { muteUntil: new Date(Date.now() + 30 * 60 * 1000).toISOString() })}><Text style={{ color: th.textSoft }}>Mute</Text></Pressable>
                  <Pressable onPress={() => updateGroupMember(groupId, m.user_id, 'kick')}><Text style={{ color: '#E45A5A' }}>Kick</Text></Pressable>
                </>
              )}
            </View>
          ))}
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 84 : 0}>
        <View style={[s.composer, { borderTopColor: th.divider, backgroundColor: th.cardBg }]}> 
          <TextInput
            value={text}
            onChangeText={onType}
            placeholder="Message"
            placeholderTextColor={th.textSoft}
            style={[s.composerInput, { backgroundColor: th.inputBg, borderColor: th.divider, color: th.textDark }]}
            multiline
            maxLength={3000}
          />
          <Pressable style={[s.send, { backgroundColor: th.accent }]} onPress={onSend}>
            <MaterialCommunityIcons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  bgLayer: { ...StyleSheet.absoluteFillObject },
  bgOrb: { position: 'absolute', width: 160, height: 160, borderRadius: 80 },
  header: { padding: 12, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  groupBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', maxWidth: 260 },
  typingWrap: { paddingHorizontal: 12, paddingTop: 6 },
  typing: { fontSize: 12 },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 6, marginBottom: 8, borderWidth: 1 },
  sender: { fontSize: 11, marginBottom: 2 },
  ts: { fontSize: 10, alignSelf: 'flex-end', marginTop: 5 },
  composer: { borderTopWidth: 1, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  composerInput: { flex: 1, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, maxHeight: 110 },
  send: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  admin: { borderTopWidth: 1, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, gap: 8, maxHeight: 260 },
  rowInline: { flexDirection: 'row', gap: 8 },
  smallBtn: { minHeight: 34, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
});
