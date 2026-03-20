-- Group chat foundation with moderation, invite links, key envelopes, receipts, and typing

create table if not exists public.group_chats (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.users(id) on delete cascade,
  announcement_mode boolean not null default false,
  invite_requires_approval boolean not null default false,
  restrict_forwarding boolean not null default false,
  key_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_chat_members (
  group_id uuid not null references public.group_chats(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin', 'super_admin')),
  muted_until timestamptz,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  last_delivered_at timestamptz,
  primary key (group_id, user_id)
);

create table if not exists public.group_bans (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.group_chats(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  banned_by uuid not null references public.users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique(group_id, user_id)
);

create table if not exists public.group_invite_links (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.group_chats(id) on delete cascade,
  invite_token text not null unique,
  created_by uuid not null references public.users(id) on delete cascade,
  expires_at timestamptz,
  max_uses int,
  uses int not null default 0,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.group_chats(id) on delete cascade,
  requester_id uuid not null references public.users(id) on delete cascade,
  invite_link_id uuid references public.group_invite_links(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null,
  unique(group_id, requester_id, status)
);

create table if not exists public.group_member_keys (
  group_id uuid not null references public.group_chats(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  key_version int not null,
  encrypted_group_key text not null,
  created_at timestamptz not null default now(),
  primary key(group_id, user_id, key_version)
);

create table if not exists public.group_key_rotations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.group_chats(id) on delete cascade,
  rotated_by uuid not null references public.users(id) on delete cascade,
  old_version int not null,
  new_version int not null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.group_chats(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  encrypted_body text not null,
  key_version int not null,
  msg_type text not null default 'text' check (msg_type in ('text', 'image', 'video', 'file', 'voice')),
  file_name text,
  file_size bigint,
  mime_type text,
  forwarded_from uuid references public.group_messages(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.group_message_receipts (
  message_id uuid not null references public.group_messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null check (status in ('delivered', 'seen')),
  created_at timestamptz not null default now(),
  primary key(message_id, user_id, status)
);

create table if not exists public.group_typing_presence (
  group_id uuid not null references public.group_chats(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  is_typing boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(group_id, user_id)
);

create table if not exists public.group_reports (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.group_chats(id) on delete cascade,
  reporter_id uuid not null references public.users(id) on delete cascade,
  reported_user_id uuid not null references public.users(id) on delete cascade,
  reason text not null,
  message_id uuid references public.group_messages(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists group_chat_members_user_idx on public.group_chat_members(user_id);
create index if not exists group_messages_group_time_idx on public.group_messages(group_id, created_at desc);
create index if not exists group_join_requests_group_status_idx on public.group_join_requests(group_id, status, requested_at desc);
create index if not exists group_typing_presence_group_idx on public.group_typing_presence(group_id, updated_at desc);

alter table public.group_chats enable row level security;
alter table public.group_chat_members enable row level security;
alter table public.group_bans enable row level security;
alter table public.group_invite_links enable row level security;
alter table public.group_join_requests enable row level security;
alter table public.group_member_keys enable row level security;
alter table public.group_key_rotations enable row level security;
alter table public.group_messages enable row level security;
alter table public.group_message_receipts enable row level security;
alter table public.group_typing_presence enable row level security;
alter table public.group_reports enable row level security;

do $$
begin
  execute 'create policy "service_role_all_group_chats" on public.group_chats as permissive for all to service_role using (true) with check (true)';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'create policy "service_role_all_group_chat_members" on public.group_chat_members as permissive for all to service_role using (true) with check (true)';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'create policy "service_role_all_group_bans" on public.group_bans as permissive for all to service_role using (true) with check (true)';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'create policy "service_role_all_group_invite_links" on public.group_invite_links as permissive for all to service_role using (true) with check (true)';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'create policy "service_role_all_group_join_requests" on public.group_join_requests as permissive for all to service_role using (true) with check (true)';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'create policy "service_role_all_group_member_keys" on public.group_member_keys as permissive for all to service_role using (true) with check (true)';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'create policy "service_role_all_group_key_rotations" on public.group_key_rotations as permissive for all to service_role using (true) with check (true)';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'create policy "service_role_all_group_messages" on public.group_messages as permissive for all to service_role using (true) with check (true)';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'create policy "service_role_all_group_message_receipts" on public.group_message_receipts as permissive for all to service_role using (true) with check (true)';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'create policy "service_role_all_group_typing_presence" on public.group_typing_presence as permissive for all to service_role using (true) with check (true)';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'create policy "service_role_all_group_reports" on public.group_reports as permissive for all to service_role using (true) with check (true)';
exception when duplicate_object then null;
end $$;

-- Allow anon select for realtime event fanout in this app architecture
do $$
begin
  execute 'create policy "anon_read_group_messages" on public.group_messages for select to anon using (true)';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'create policy "anon_read_group_members" on public.group_chat_members for select to anon using (true)';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'create policy "anon_read_group_typing" on public.group_typing_presence for select to anon using (true)';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'create policy "anon_read_group_receipts" on public.group_message_receipts for select to anon using (true)';
exception when duplicate_object then null;
end $$;

-- Realtime publication

do $$
begin
  if not exists (
    select 1 from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.pubname = 'supabase_realtime' and n.nspname = 'public' and c.relname = 'group_messages'
  ) then
    alter publication supabase_realtime add table public.group_messages;
  end if;

  if not exists (
    select 1 from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.pubname = 'supabase_realtime' and n.nspname = 'public' and c.relname = 'group_chat_members'
  ) then
    alter publication supabase_realtime add table public.group_chat_members;
  end if;

  if not exists (
    select 1 from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.pubname = 'supabase_realtime' and n.nspname = 'public' and c.relname = 'group_typing_presence'
  ) then
    alter publication supabase_realtime add table public.group_typing_presence;
  end if;

  if not exists (
    select 1 from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.pubname = 'supabase_realtime' and n.nspname = 'public' and c.relname = 'group_message_receipts'
  ) then
    alter publication supabase_realtime add table public.group_message_receipts;
  end if;
end
$$;

alter table public.group_messages replica identity full;
alter table public.group_chat_members replica identity full;
alter table public.group_typing_presence replica identity full;
alter table public.group_message_receipts replica identity full;
