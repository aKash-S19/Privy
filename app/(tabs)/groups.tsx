import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GroupRow, useAuth } from '@/contexts/AuthContext';
import { useAppTheme } from '@/hooks/use-app-theme';
import { encryptGroupKeyEnvelope, randomGroupKeyB64, saveGroupKey } from '@/lib/group-e2ee';

function ago(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'G';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? 'G';
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export default function GroupsScreen() {
  const th = useAppTheme();
  const {
    getChats,
    listGroups,
    createGroup,
    joinGroupViaInvite,
  } = useAuth();

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState(false);

  const [inviteToken, setInviteToken] = useState('');
  const [joining, setJoining] = useState(false);
  const [showCreate, setShowCreate] = useState(true);
  const [showJoin, setShowJoin] = useState(false);

  const [contacts, setContacts] = useState<Array<{ id: string; username: string; public_key: string | null }>>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [g, chats] = await Promise.all([listGroups(), getChats()]);
      setGroups(g);
      const peers = chats
        .map((c) => ({ id: c.user.id, username: c.user.username, public_key: c.peer_public_key }))
        .filter((v, i, arr) => arr.findIndex((x) => x.id === v.id) === i);
      setContacts(peers);
    } finally {
      setLoading(false);
    }
  }, [listGroups, getChats]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const selectedContacts = useMemo(
    () => contacts.filter((c) => selected[c.id]),
    [contacts, selected],
  );

  const onCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name) {
      Alert.alert('Group name required', 'Please enter a group name.');
      return;
    }

    setCreating(true);
    try {
      const groupKeyB64 = randomGroupKeyB64();
      const envelopes: Record<string, string> = {};
      for (const c of selectedContacts) {
        if (!c.public_key) continue;
        envelopes[c.id] = await encryptGroupKeyEnvelope(c.public_key, groupKeyB64);
      }

      const group = await createGroup(name, selectedContacts.map((c) => c.id), envelopes, false);
      await saveGroupKey(group.id, group.key_version, groupKeyB64);

      setNewName('');
      setSelected({});
      await refresh();
      router.push({ pathname: '/group/[id]', params: { id: group.id, name: group.name } });
    } catch (e: any) {
      Alert.alert('Create failed', e?.message ?? 'Unable to create group');
    } finally {
      setCreating(false);
    }
  }, [newName, selectedContacts, createGroup, refresh]);

  const onJoinInvite = useCallback(async () => {
    const token = inviteToken.trim();
    if (!token) return;
    setJoining(true);
    try {
      const res = await joinGroupViaInvite(token);
      setInviteToken('');
      await refresh();
      if (res.pending) {
        Alert.alert('Request sent', 'Your join request is pending admin approval.');
      } else if (res.groupId) {
        router.push({ pathname: '/group/[id]', params: { id: res.groupId } });
      }
    } catch (e: any) {
      Alert.alert('Join failed', e?.message ?? 'Invalid invite token');
    } finally {
      setJoining(false);
    }
  }, [inviteToken, joinGroupViaInvite, refresh]);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: th.bg }]}> 
      <ScrollView contentContainerStyle={s.content}>
        <View style={[s.hero, { backgroundColor: th.cardBg, borderColor: th.divider }]}> 
          <View style={[s.heroIcon, { backgroundColor: th.accent + '18' }]}> 
            <MaterialCommunityIcons name="account-group" size={24} color={th.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: th.textDark }]}>Groups</Text>
            <Text style={[s.heroSub, { color: th.textSoft }]}>Private rooms, modern chat flow, end-to-end encrypted.</Text>
          </View>
        </View>

        <View style={s.quickActions}>
          <Pressable
            style={[s.quickBtn, { backgroundColor: showCreate ? th.accent : th.cardBg, borderColor: showCreate ? th.accent : th.divider }]}
            onPress={() => {
              setShowCreate(true);
              setShowJoin(false);
            }}
          >
            <MaterialCommunityIcons name="plus-circle-outline" size={16} color={showCreate ? '#fff' : th.textDark} />
            <Text style={{ color: showCreate ? '#fff' : th.textDark, fontWeight: '700' }}>New Group</Text>
          </Pressable>
          <Pressable
            style={[s.quickBtn, { backgroundColor: showJoin ? th.accent : th.cardBg, borderColor: showJoin ? th.accent : th.divider }]}
            onPress={() => {
              setShowJoin(true);
              setShowCreate(false);
            }}
          >
            <MaterialCommunityIcons name="link-variant" size={16} color={showJoin ? '#fff' : th.textDark} />
            <Text style={{ color: showJoin ? '#fff' : th.textDark, fontWeight: '700' }}>Join by Link</Text>
          </Pressable>
        </View>

        <View style={[s.card, { backgroundColor: th.cardBg, borderColor: th.divider }]}> 
          <Pressable style={s.sectionHead} onPress={() => setShowCreate((v) => !v)}>
            <Text style={[s.cardTitle, { color: th.textDark }]}>Create Group</Text>
            <MaterialCommunityIcons name={showCreate ? 'chevron-up' : 'chevron-down'} size={20} color={th.textSoft} />
          </Pressable>
          {showCreate && (
            <>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Group name"
            placeholderTextColor={th.textSoft}
            style={[s.input, { backgroundColor: th.inputBg, color: th.textDark, borderColor: th.divider }]}
          />
          <Text style={[s.sub, { color: th.textSoft }]}>Select contacts to invite now</Text>
          <View style={s.chipsWrap}>
            {contacts.map((c) => {
              const active = Boolean(selected[c.id]);
              return (
                <Pressable
                  key={c.id}
                  style={[
                    s.chip,
                    {
                      backgroundColor: active ? th.accent : th.inputBg,
                      borderColor: active ? th.accent : th.divider,
                    },
                  ]}
                  onPress={() => setSelected((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
                >
                  <Text style={{ color: active ? '#fff' : th.textDark, fontWeight: '600' }}>{c.username}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable style={[s.primary, { backgroundColor: th.accent }]} onPress={onCreate} disabled={creating}>
            {creating ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Create</Text>}
          </Pressable>
            </>
          )}
        </View>

        <View style={[s.card, { backgroundColor: th.cardBg, borderColor: th.divider }]}> 
          <Pressable style={s.sectionHead} onPress={() => setShowJoin((v) => !v)}>
            <Text style={[s.cardTitle, { color: th.textDark }]}>Join via Invite</Text>
            <MaterialCommunityIcons name={showJoin ? 'chevron-up' : 'chevron-down'} size={20} color={th.textSoft} />
          </Pressable>
          {showJoin && (
            <>
          <TextInput
            value={inviteToken}
            onChangeText={setInviteToken}
            placeholder="Paste invite token"
            placeholderTextColor={th.textSoft}
            style={[s.input, { backgroundColor: th.inputBg, color: th.textDark, borderColor: th.divider }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable style={[s.primary, { backgroundColor: th.accent }]} onPress={onJoinInvite} disabled={joining}>
            {joining ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Join</Text>}
          </Pressable>
            </>
          )}
        </View>

        <Text style={[s.cardTitle, { color: th.textDark, marginBottom: 10 }]}>Recent Groups</Text>
        {loading ? (
          <ActivityIndicator color={th.accent} />
        ) : groups.length === 0 ? (
          <View style={[s.empty, { backgroundColor: th.cardBg, borderColor: th.divider }]}> 
            <MaterialCommunityIcons name="account-group-outline" size={28} color={th.textSoft} />
            <Text style={{ color: th.textDark, fontWeight: '700', marginTop: 8 }}>No groups yet</Text>
            <Text style={{ color: th.textSoft, marginTop: 2 }}>Create a room and start the first encrypted conversation.</Text>
          </View>
        ) : (
          groups.map((g) => (
            <Pressable
              key={g.id}
              style={[s.row, { backgroundColor: th.cardBg, borderColor: th.divider }]}
              onPress={() => router.push({ pathname: '/group/[id]', params: { id: g.id, name: g.name } })}
            >
              <View style={[s.groupIcon, { backgroundColor: th.accent + '22' }]}> 
                <Text style={{ color: th.accent, fontWeight: '800' }}>{initials(g.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.rowTitle, { color: th.textDark }]} numberOfLines={1}>{g.name}</Text>
                <Text style={{ color: th.textSoft }} numberOfLines={1}>
                  {g.last_message ? `${g.last_message.msg_type === 'text' ? 'Message' : g.last_message.msg_type} · ${ago(g.last_message_at)}` : 'No messages yet'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={{ color: th.textSoft, fontSize: 12 }}>{ago(g.last_message_at)}</Text>
                <MaterialCommunityIcons name="chevron-right" size={16} color={th.textSoft} />
              </View>
              {g.unread_count > 0 && (
                <View style={[s.badge, { backgroundColor: th.accent }]}>
                  <Text style={s.badgeText}>{g.unread_count > 99 ? '99+' : g.unread_count}</Text>
                </View>
              )}
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 14, paddingBottom: 36 },
  hero: { borderWidth: 1, borderRadius: 18, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  heroSub: { lineHeight: 18 },
  quickActions: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  quickBtn: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 2 },
  card: { borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  sub: { fontSize: 13, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  primary: { borderRadius: 10, alignItems: 'center', justifyContent: 'center', minHeight: 42 },
  primaryText: { color: '#fff', fontWeight: '700' },
  empty: { borderWidth: 1, borderRadius: 14, paddingVertical: 18, paddingHorizontal: 14, alignItems: 'center' },
  row: { borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  badge: { minWidth: 24, paddingHorizontal: 8, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
