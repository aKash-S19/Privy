create sequence "public"."group_members_id_seq";

drop policy "service_role_all_group_bans" on "public"."group_bans";

drop policy "anon_read_group_members" on "public"."group_chat_members";

drop policy "service_role_all_group_chat_members" on "public"."group_chat_members";

drop policy "service_role_all_group_chats" on "public"."group_chats";

drop policy "service_role_all_group_invite_links" on "public"."group_invite_links";

drop policy "service_role_all_group_join_requests" on "public"."group_join_requests";

drop policy "service_role_all_group_key_rotations" on "public"."group_key_rotations";

drop policy "service_role_all_group_member_keys" on "public"."group_member_keys";

drop policy "anon_read_group_receipts" on "public"."group_message_receipts";

drop policy "service_role_all_group_message_receipts" on "public"."group_message_receipts";

drop policy "anon_read_group_messages" on "public"."group_messages";

drop policy "service_role_all_group_messages" on "public"."group_messages";

drop policy "service_role_all_group_reports" on "public"."group_reports";

drop policy "anon_read_group_typing" on "public"."group_typing_presence";

drop policy "service_role_all_group_typing_presence" on "public"."group_typing_presence";

revoke delete on table "public"."group_bans" from "anon";

revoke insert on table "public"."group_bans" from "anon";

revoke references on table "public"."group_bans" from "anon";

revoke select on table "public"."group_bans" from "anon";

revoke trigger on table "public"."group_bans" from "anon";

revoke truncate on table "public"."group_bans" from "anon";

revoke update on table "public"."group_bans" from "anon";

revoke delete on table "public"."group_bans" from "authenticated";

revoke insert on table "public"."group_bans" from "authenticated";

revoke references on table "public"."group_bans" from "authenticated";

revoke select on table "public"."group_bans" from "authenticated";

revoke trigger on table "public"."group_bans" from "authenticated";

revoke truncate on table "public"."group_bans" from "authenticated";

revoke update on table "public"."group_bans" from "authenticated";

revoke delete on table "public"."group_bans" from "service_role";

revoke insert on table "public"."group_bans" from "service_role";

revoke references on table "public"."group_bans" from "service_role";

revoke select on table "public"."group_bans" from "service_role";

revoke trigger on table "public"."group_bans" from "service_role";

revoke truncate on table "public"."group_bans" from "service_role";

revoke update on table "public"."group_bans" from "service_role";

revoke delete on table "public"."group_chat_members" from "anon";

revoke insert on table "public"."group_chat_members" from "anon";

revoke references on table "public"."group_chat_members" from "anon";

revoke select on table "public"."group_chat_members" from "anon";

revoke trigger on table "public"."group_chat_members" from "anon";

revoke truncate on table "public"."group_chat_members" from "anon";

revoke update on table "public"."group_chat_members" from "anon";

revoke delete on table "public"."group_chat_members" from "authenticated";

revoke insert on table "public"."group_chat_members" from "authenticated";

revoke references on table "public"."group_chat_members" from "authenticated";

revoke select on table "public"."group_chat_members" from "authenticated";

revoke trigger on table "public"."group_chat_members" from "authenticated";

revoke truncate on table "public"."group_chat_members" from "authenticated";

revoke update on table "public"."group_chat_members" from "authenticated";

revoke delete on table "public"."group_chat_members" from "service_role";

revoke insert on table "public"."group_chat_members" from "service_role";

revoke references on table "public"."group_chat_members" from "service_role";

revoke select on table "public"."group_chat_members" from "service_role";

revoke trigger on table "public"."group_chat_members" from "service_role";

revoke truncate on table "public"."group_chat_members" from "service_role";

revoke update on table "public"."group_chat_members" from "service_role";

revoke delete on table "public"."group_chats" from "anon";

revoke insert on table "public"."group_chats" from "anon";

revoke references on table "public"."group_chats" from "anon";

revoke select on table "public"."group_chats" from "anon";

revoke trigger on table "public"."group_chats" from "anon";

revoke truncate on table "public"."group_chats" from "anon";

revoke update on table "public"."group_chats" from "anon";

revoke delete on table "public"."group_chats" from "authenticated";

revoke insert on table "public"."group_chats" from "authenticated";

revoke references on table "public"."group_chats" from "authenticated";

revoke select on table "public"."group_chats" from "authenticated";

revoke trigger on table "public"."group_chats" from "authenticated";

revoke truncate on table "public"."group_chats" from "authenticated";

revoke update on table "public"."group_chats" from "authenticated";

revoke delete on table "public"."group_chats" from "service_role";

revoke insert on table "public"."group_chats" from "service_role";

revoke references on table "public"."group_chats" from "service_role";

revoke select on table "public"."group_chats" from "service_role";

revoke trigger on table "public"."group_chats" from "service_role";

revoke truncate on table "public"."group_chats" from "service_role";

revoke update on table "public"."group_chats" from "service_role";

revoke delete on table "public"."group_invite_links" from "anon";

revoke insert on table "public"."group_invite_links" from "anon";

revoke references on table "public"."group_invite_links" from "anon";

revoke select on table "public"."group_invite_links" from "anon";

revoke trigger on table "public"."group_invite_links" from "anon";

revoke truncate on table "public"."group_invite_links" from "anon";

revoke update on table "public"."group_invite_links" from "anon";

revoke delete on table "public"."group_invite_links" from "authenticated";

revoke insert on table "public"."group_invite_links" from "authenticated";

revoke references on table "public"."group_invite_links" from "authenticated";

revoke select on table "public"."group_invite_links" from "authenticated";

revoke trigger on table "public"."group_invite_links" from "authenticated";

revoke truncate on table "public"."group_invite_links" from "authenticated";

revoke update on table "public"."group_invite_links" from "authenticated";

revoke delete on table "public"."group_invite_links" from "service_role";

revoke insert on table "public"."group_invite_links" from "service_role";

revoke references on table "public"."group_invite_links" from "service_role";

revoke select on table "public"."group_invite_links" from "service_role";

revoke trigger on table "public"."group_invite_links" from "service_role";

revoke truncate on table "public"."group_invite_links" from "service_role";

revoke update on table "public"."group_invite_links" from "service_role";

revoke delete on table "public"."group_join_requests" from "anon";

revoke insert on table "public"."group_join_requests" from "anon";

revoke references on table "public"."group_join_requests" from "anon";

revoke select on table "public"."group_join_requests" from "anon";

revoke trigger on table "public"."group_join_requests" from "anon";

revoke truncate on table "public"."group_join_requests" from "anon";

revoke update on table "public"."group_join_requests" from "anon";

revoke delete on table "public"."group_join_requests" from "authenticated";

revoke insert on table "public"."group_join_requests" from "authenticated";

revoke references on table "public"."group_join_requests" from "authenticated";

revoke select on table "public"."group_join_requests" from "authenticated";

revoke trigger on table "public"."group_join_requests" from "authenticated";

revoke truncate on table "public"."group_join_requests" from "authenticated";

revoke update on table "public"."group_join_requests" from "authenticated";

revoke delete on table "public"."group_join_requests" from "service_role";

revoke insert on table "public"."group_join_requests" from "service_role";

revoke references on table "public"."group_join_requests" from "service_role";

revoke select on table "public"."group_join_requests" from "service_role";

revoke trigger on table "public"."group_join_requests" from "service_role";

revoke truncate on table "public"."group_join_requests" from "service_role";

revoke update on table "public"."group_join_requests" from "service_role";

revoke delete on table "public"."group_key_rotations" from "anon";

revoke insert on table "public"."group_key_rotations" from "anon";

revoke references on table "public"."group_key_rotations" from "anon";

revoke select on table "public"."group_key_rotations" from "anon";

revoke trigger on table "public"."group_key_rotations" from "anon";

revoke truncate on table "public"."group_key_rotations" from "anon";

revoke update on table "public"."group_key_rotations" from "anon";

revoke delete on table "public"."group_key_rotations" from "authenticated";

revoke insert on table "public"."group_key_rotations" from "authenticated";

revoke references on table "public"."group_key_rotations" from "authenticated";

revoke select on table "public"."group_key_rotations" from "authenticated";

revoke trigger on table "public"."group_key_rotations" from "authenticated";

revoke truncate on table "public"."group_key_rotations" from "authenticated";

revoke update on table "public"."group_key_rotations" from "authenticated";

revoke delete on table "public"."group_key_rotations" from "service_role";

revoke insert on table "public"."group_key_rotations" from "service_role";

revoke references on table "public"."group_key_rotations" from "service_role";

revoke select on table "public"."group_key_rotations" from "service_role";

revoke trigger on table "public"."group_key_rotations" from "service_role";

revoke truncate on table "public"."group_key_rotations" from "service_role";

revoke update on table "public"."group_key_rotations" from "service_role";

revoke delete on table "public"."group_member_keys" from "anon";

revoke insert on table "public"."group_member_keys" from "anon";

revoke references on table "public"."group_member_keys" from "anon";

revoke select on table "public"."group_member_keys" from "anon";

revoke trigger on table "public"."group_member_keys" from "anon";

revoke truncate on table "public"."group_member_keys" from "anon";

revoke update on table "public"."group_member_keys" from "anon";

revoke delete on table "public"."group_member_keys" from "authenticated";

revoke insert on table "public"."group_member_keys" from "authenticated";

revoke references on table "public"."group_member_keys" from "authenticated";

revoke select on table "public"."group_member_keys" from "authenticated";

revoke trigger on table "public"."group_member_keys" from "authenticated";

revoke truncate on table "public"."group_member_keys" from "authenticated";

revoke update on table "public"."group_member_keys" from "authenticated";

revoke delete on table "public"."group_member_keys" from "service_role";

revoke insert on table "public"."group_member_keys" from "service_role";

revoke references on table "public"."group_member_keys" from "service_role";

revoke select on table "public"."group_member_keys" from "service_role";

revoke trigger on table "public"."group_member_keys" from "service_role";

revoke truncate on table "public"."group_member_keys" from "service_role";

revoke update on table "public"."group_member_keys" from "service_role";

revoke delete on table "public"."group_message_receipts" from "anon";

revoke insert on table "public"."group_message_receipts" from "anon";

revoke references on table "public"."group_message_receipts" from "anon";

revoke select on table "public"."group_message_receipts" from "anon";

revoke trigger on table "public"."group_message_receipts" from "anon";

revoke truncate on table "public"."group_message_receipts" from "anon";

revoke update on table "public"."group_message_receipts" from "anon";

revoke delete on table "public"."group_message_receipts" from "authenticated";

revoke insert on table "public"."group_message_receipts" from "authenticated";

revoke references on table "public"."group_message_receipts" from "authenticated";

revoke select on table "public"."group_message_receipts" from "authenticated";

revoke trigger on table "public"."group_message_receipts" from "authenticated";

revoke truncate on table "public"."group_message_receipts" from "authenticated";

revoke update on table "public"."group_message_receipts" from "authenticated";

revoke delete on table "public"."group_message_receipts" from "service_role";

revoke insert on table "public"."group_message_receipts" from "service_role";

revoke references on table "public"."group_message_receipts" from "service_role";

revoke select on table "public"."group_message_receipts" from "service_role";

revoke trigger on table "public"."group_message_receipts" from "service_role";

revoke truncate on table "public"."group_message_receipts" from "service_role";

revoke update on table "public"."group_message_receipts" from "service_role";

revoke delete on table "public"."group_messages" from "anon";

revoke insert on table "public"."group_messages" from "anon";

revoke references on table "public"."group_messages" from "anon";

revoke select on table "public"."group_messages" from "anon";

revoke trigger on table "public"."group_messages" from "anon";

revoke truncate on table "public"."group_messages" from "anon";

revoke update on table "public"."group_messages" from "anon";

revoke delete on table "public"."group_messages" from "authenticated";

revoke insert on table "public"."group_messages" from "authenticated";

revoke references on table "public"."group_messages" from "authenticated";

revoke select on table "public"."group_messages" from "authenticated";

revoke trigger on table "public"."group_messages" from "authenticated";

revoke truncate on table "public"."group_messages" from "authenticated";

revoke update on table "public"."group_messages" from "authenticated";

revoke delete on table "public"."group_messages" from "service_role";

revoke insert on table "public"."group_messages" from "service_role";

revoke references on table "public"."group_messages" from "service_role";

revoke select on table "public"."group_messages" from "service_role";

revoke trigger on table "public"."group_messages" from "service_role";

revoke truncate on table "public"."group_messages" from "service_role";

revoke update on table "public"."group_messages" from "service_role";

revoke delete on table "public"."group_reports" from "anon";

revoke insert on table "public"."group_reports" from "anon";

revoke references on table "public"."group_reports" from "anon";

revoke select on table "public"."group_reports" from "anon";

revoke trigger on table "public"."group_reports" from "anon";

revoke truncate on table "public"."group_reports" from "anon";

revoke update on table "public"."group_reports" from "anon";

revoke delete on table "public"."group_reports" from "authenticated";

revoke insert on table "public"."group_reports" from "authenticated";

revoke references on table "public"."group_reports" from "authenticated";

revoke select on table "public"."group_reports" from "authenticated";

revoke trigger on table "public"."group_reports" from "authenticated";

revoke truncate on table "public"."group_reports" from "authenticated";

revoke update on table "public"."group_reports" from "authenticated";

revoke delete on table "public"."group_reports" from "service_role";

revoke insert on table "public"."group_reports" from "service_role";

revoke references on table "public"."group_reports" from "service_role";

revoke select on table "public"."group_reports" from "service_role";

revoke trigger on table "public"."group_reports" from "service_role";

revoke truncate on table "public"."group_reports" from "service_role";

revoke update on table "public"."group_reports" from "service_role";

revoke delete on table "public"."group_typing_presence" from "anon";

revoke insert on table "public"."group_typing_presence" from "anon";

revoke references on table "public"."group_typing_presence" from "anon";

revoke select on table "public"."group_typing_presence" from "anon";

revoke trigger on table "public"."group_typing_presence" from "anon";

revoke truncate on table "public"."group_typing_presence" from "anon";

revoke update on table "public"."group_typing_presence" from "anon";

revoke delete on table "public"."group_typing_presence" from "authenticated";

revoke insert on table "public"."group_typing_presence" from "authenticated";

revoke references on table "public"."group_typing_presence" from "authenticated";

revoke select on table "public"."group_typing_presence" from "authenticated";

revoke trigger on table "public"."group_typing_presence" from "authenticated";

revoke truncate on table "public"."group_typing_presence" from "authenticated";

revoke update on table "public"."group_typing_presence" from "authenticated";

revoke delete on table "public"."group_typing_presence" from "service_role";

revoke insert on table "public"."group_typing_presence" from "service_role";

revoke references on table "public"."group_typing_presence" from "service_role";

revoke select on table "public"."group_typing_presence" from "service_role";

revoke trigger on table "public"."group_typing_presence" from "service_role";

revoke truncate on table "public"."group_typing_presence" from "service_role";

revoke update on table "public"."group_typing_presence" from "service_role";

alter table "public"."group_bans" drop constraint "group_bans_banned_by_fkey";

alter table "public"."group_bans" drop constraint "group_bans_group_id_fkey";

alter table "public"."group_bans" drop constraint "group_bans_group_id_user_id_key";

alter table "public"."group_bans" drop constraint "group_bans_user_id_fkey";

alter table "public"."group_chat_members" drop constraint "group_chat_members_group_id_fkey";

alter table "public"."group_chat_members" drop constraint "group_chat_members_role_check";

alter table "public"."group_chat_members" drop constraint "group_chat_members_user_id_fkey";

alter table "public"."group_chats" drop constraint "group_chats_created_by_fkey";

alter table "public"."group_invite_links" drop constraint "group_invite_links_created_by_fkey";

alter table "public"."group_invite_links" drop constraint "group_invite_links_group_id_fkey";

alter table "public"."group_invite_links" drop constraint "group_invite_links_invite_token_key";

alter table "public"."group_join_requests" drop constraint "group_join_requests_group_id_fkey";

alter table "public"."group_join_requests" drop constraint "group_join_requests_group_id_requester_id_status_key";

alter table "public"."group_join_requests" drop constraint "group_join_requests_invite_link_id_fkey";

alter table "public"."group_join_requests" drop constraint "group_join_requests_requester_id_fkey";

alter table "public"."group_join_requests" drop constraint "group_join_requests_resolved_by_fkey";

alter table "public"."group_join_requests" drop constraint "group_join_requests_status_check";

alter table "public"."group_key_rotations" drop constraint "group_key_rotations_group_id_fkey";

alter table "public"."group_key_rotations" drop constraint "group_key_rotations_rotated_by_fkey";

alter table "public"."group_member_keys" drop constraint "group_member_keys_group_id_fkey";

alter table "public"."group_member_keys" drop constraint "group_member_keys_user_id_fkey";

alter table "public"."group_message_receipts" drop constraint "group_message_receipts_message_id_fkey";

alter table "public"."group_message_receipts" drop constraint "group_message_receipts_status_check";

alter table "public"."group_message_receipts" drop constraint "group_message_receipts_user_id_fkey";

alter table "public"."group_messages" drop constraint "group_messages_forwarded_from_fkey";

alter table "public"."group_messages" drop constraint "group_messages_group_id_fkey";

alter table "public"."group_messages" drop constraint "group_messages_msg_type_check";

alter table "public"."group_messages" drop constraint "group_messages_sender_id_fkey";

alter table "public"."group_reports" drop constraint "group_reports_group_id_fkey";

alter table "public"."group_reports" drop constraint "group_reports_message_id_fkey";

alter table "public"."group_reports" drop constraint "group_reports_reported_user_id_fkey";

alter table "public"."group_reports" drop constraint "group_reports_reporter_id_fkey";

alter table "public"."group_typing_presence" drop constraint "group_typing_presence_group_id_fkey";

alter table "public"."group_typing_presence" drop constraint "group_typing_presence_user_id_fkey";

alter table "public"."group_bans" drop constraint "group_bans_pkey";

alter table "public"."group_chat_members" drop constraint "group_chat_members_pkey";

alter table "public"."group_chats" drop constraint "group_chats_pkey";

alter table "public"."group_invite_links" drop constraint "group_invite_links_pkey";

alter table "public"."group_join_requests" drop constraint "group_join_requests_pkey";

alter table "public"."group_key_rotations" drop constraint "group_key_rotations_pkey";

alter table "public"."group_member_keys" drop constraint "group_member_keys_pkey";

alter table "public"."group_message_receipts" drop constraint "group_message_receipts_pkey";

alter table "public"."group_messages" drop constraint "group_messages_pkey";

alter table "public"."group_reports" drop constraint "group_reports_pkey";

alter table "public"."group_typing_presence" drop constraint "group_typing_presence_pkey";

drop index if exists "public"."group_bans_group_id_user_id_key";

drop index if exists "public"."group_bans_pkey";

drop index if exists "public"."group_chat_members_pkey";

drop index if exists "public"."group_chat_members_user_idx";

drop index if exists "public"."group_chats_pkey";

drop index if exists "public"."group_invite_links_invite_token_key";

drop index if exists "public"."group_invite_links_pkey";

drop index if exists "public"."group_join_requests_group_id_requester_id_status_key";

drop index if exists "public"."group_join_requests_group_status_idx";

drop index if exists "public"."group_join_requests_pkey";

drop index if exists "public"."group_key_rotations_pkey";

drop index if exists "public"."group_member_keys_pkey";

drop index if exists "public"."group_message_receipts_pkey";

drop index if exists "public"."group_messages_group_time_idx";

drop index if exists "public"."group_messages_pkey";

drop index if exists "public"."group_reports_pkey";

drop index if exists "public"."group_typing_presence_group_idx";

drop index if exists "public"."group_typing_presence_pkey";

drop table "public"."group_bans";

drop table "public"."group_chat_members";

drop table "public"."group_chats";

drop table "public"."group_invite_links";

drop table "public"."group_join_requests";

drop table "public"."group_key_rotations";

drop table "public"."group_member_keys";

drop table "public"."group_message_receipts";

drop table "public"."group_messages";

drop table "public"."group_reports";

drop table "public"."group_typing_presence";


  create table "public"."banned_devices" (
    "id" uuid not null default gen_random_uuid(),
    "device_hash" text not null,
    "reason" text,
    "banned_at" timestamp without time zone default now()
      );


alter table "public"."banned_devices" enable row level security;


  create table "public"."chat_group_members" (
    "group_id" uuid not null,
    "user_id" uuid not null,
    "joined_at" timestamp with time zone not null default now()
      );


alter table "public"."chat_group_members" enable row level security;


  create table "public"."chat_groups" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "created_by" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."chat_groups" enable row level security;


  create table "public"."chat_messages" (
    "id" uuid not null default gen_random_uuid(),
    "group_id" uuid not null,
    "sender_id" uuid not null,
    "content" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."chat_messages" enable row level security;


  create table "public"."group_members" (
    "id" bigint not null default nextval('public.group_members_id_seq'::regclass),
    "group_id" uuid,
    "user_id" uuid,
    "role" text default 'member'::text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."group_members" enable row level security;


  create table "public"."groups" (
    "id" uuid not null default gen_random_uuid(),
    "name" text,
    "description" text,
    "created_by" uuid,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."groups" enable row level security;

alter table "public"."messages" add column "expires_at" timestamp with time zone;

alter table "public"."messages" add column "group_id" uuid;

alter table "public"."messages" add column "user_id" uuid;

alter table "public"."users" add column "is_banned" boolean default false;

alter table "public"."users" alter column "created_at" drop not null;

alter table "public"."users" alter column "created_at" set data type timestamp without time zone using "created_at"::timestamp without time zone;

alter sequence "public"."group_members_id_seq" owned by "public"."group_members"."id";

CREATE UNIQUE INDEX banned_devices_device_hash_key ON public.banned_devices USING btree (device_hash);

CREATE UNIQUE INDEX banned_devices_pkey ON public.banned_devices USING btree (id);

CREATE UNIQUE INDEX chat_group_members_pkey ON public.chat_group_members USING btree (group_id, user_id);

CREATE INDEX chat_group_members_user_idx ON public.chat_group_members USING btree (user_id);

CREATE UNIQUE INDEX chat_groups_pkey ON public.chat_groups USING btree (id);

CREATE INDEX chat_messages_group_created_idx ON public.chat_messages USING btree (group_id, created_at DESC);

CREATE UNIQUE INDEX chat_messages_pkey ON public.chat_messages USING btree (id);

CREATE UNIQUE INDEX group_members_group_id_user_id_key ON public.group_members USING btree (group_id, user_id);

CREATE UNIQUE INDEX group_members_pkey ON public.group_members USING btree (id);

CREATE UNIQUE INDEX groups_pkey ON public.groups USING btree (id);

CREATE INDEX messages_expires_at_idx ON public.messages USING btree (expires_at) WHERE (expires_at IS NOT NULL);

alter table "public"."banned_devices" add constraint "banned_devices_pkey" PRIMARY KEY using index "banned_devices_pkey";

alter table "public"."chat_group_members" add constraint "chat_group_members_pkey" PRIMARY KEY using index "chat_group_members_pkey";

alter table "public"."chat_groups" add constraint "chat_groups_pkey" PRIMARY KEY using index "chat_groups_pkey";

alter table "public"."chat_messages" add constraint "chat_messages_pkey" PRIMARY KEY using index "chat_messages_pkey";

alter table "public"."group_members" add constraint "group_members_pkey" PRIMARY KEY using index "group_members_pkey";

alter table "public"."groups" add constraint "groups_pkey" PRIMARY KEY using index "groups_pkey";

alter table "public"."banned_devices" add constraint "banned_devices_device_hash_key" UNIQUE using index "banned_devices_device_hash_key";

alter table "public"."chat_group_members" add constraint "chat_group_members_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public.chat_groups(id) ON DELETE CASCADE not valid;

alter table "public"."chat_group_members" validate constraint "chat_group_members_group_id_fkey";

alter table "public"."chat_group_members" add constraint "chat_group_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."chat_group_members" validate constraint "chat_group_members_user_id_fkey";

alter table "public"."chat_groups" add constraint "chat_groups_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."chat_groups" validate constraint "chat_groups_created_by_fkey";

alter table "public"."chat_messages" add constraint "chat_messages_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public.chat_groups(id) ON DELETE CASCADE not valid;

alter table "public"."chat_messages" validate constraint "chat_messages_group_id_fkey";

alter table "public"."chat_messages" add constraint "chat_messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."chat_messages" validate constraint "chat_messages_sender_id_fkey";

alter table "public"."group_members" add constraint "group_members_group_id_user_id_key" UNIQUE using index "group_members_group_id_user_id_key";

alter table "public"."messages" add constraint "messages_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE not valid;

alter table "public"."messages" validate constraint "messages_group_id_fkey";

alter table "public"."messages" add constraint "messages_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."messages" validate constraint "messages_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.delete_expired_messages()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    DELETE FROM messages WHERE expires_at IS NOT NULL AND expires_at <= NOW();
END;
$function$
;

grant delete on table "public"."banned_devices" to "anon";

grant insert on table "public"."banned_devices" to "anon";

grant references on table "public"."banned_devices" to "anon";

grant select on table "public"."banned_devices" to "anon";

grant trigger on table "public"."banned_devices" to "anon";

grant truncate on table "public"."banned_devices" to "anon";

grant update on table "public"."banned_devices" to "anon";

grant delete on table "public"."banned_devices" to "authenticated";

grant insert on table "public"."banned_devices" to "authenticated";

grant references on table "public"."banned_devices" to "authenticated";

grant select on table "public"."banned_devices" to "authenticated";

grant trigger on table "public"."banned_devices" to "authenticated";

grant truncate on table "public"."banned_devices" to "authenticated";

grant update on table "public"."banned_devices" to "authenticated";

grant delete on table "public"."banned_devices" to "service_role";

grant insert on table "public"."banned_devices" to "service_role";

grant references on table "public"."banned_devices" to "service_role";

grant select on table "public"."banned_devices" to "service_role";

grant trigger on table "public"."banned_devices" to "service_role";

grant truncate on table "public"."banned_devices" to "service_role";

grant update on table "public"."banned_devices" to "service_role";

grant delete on table "public"."chat_group_members" to "anon";

grant insert on table "public"."chat_group_members" to "anon";

grant references on table "public"."chat_group_members" to "anon";

grant select on table "public"."chat_group_members" to "anon";

grant trigger on table "public"."chat_group_members" to "anon";

grant truncate on table "public"."chat_group_members" to "anon";

grant update on table "public"."chat_group_members" to "anon";

grant delete on table "public"."chat_group_members" to "authenticated";

grant insert on table "public"."chat_group_members" to "authenticated";

grant references on table "public"."chat_group_members" to "authenticated";

grant select on table "public"."chat_group_members" to "authenticated";

grant trigger on table "public"."chat_group_members" to "authenticated";

grant truncate on table "public"."chat_group_members" to "authenticated";

grant update on table "public"."chat_group_members" to "authenticated";

grant delete on table "public"."chat_group_members" to "service_role";

grant insert on table "public"."chat_group_members" to "service_role";

grant references on table "public"."chat_group_members" to "service_role";

grant select on table "public"."chat_group_members" to "service_role";

grant trigger on table "public"."chat_group_members" to "service_role";

grant truncate on table "public"."chat_group_members" to "service_role";

grant update on table "public"."chat_group_members" to "service_role";

grant delete on table "public"."chat_groups" to "anon";

grant insert on table "public"."chat_groups" to "anon";

grant references on table "public"."chat_groups" to "anon";

grant select on table "public"."chat_groups" to "anon";

grant trigger on table "public"."chat_groups" to "anon";

grant truncate on table "public"."chat_groups" to "anon";

grant update on table "public"."chat_groups" to "anon";

grant delete on table "public"."chat_groups" to "authenticated";

grant insert on table "public"."chat_groups" to "authenticated";

grant references on table "public"."chat_groups" to "authenticated";

grant select on table "public"."chat_groups" to "authenticated";

grant trigger on table "public"."chat_groups" to "authenticated";

grant truncate on table "public"."chat_groups" to "authenticated";

grant update on table "public"."chat_groups" to "authenticated";

grant delete on table "public"."chat_groups" to "service_role";

grant insert on table "public"."chat_groups" to "service_role";

grant references on table "public"."chat_groups" to "service_role";

grant select on table "public"."chat_groups" to "service_role";

grant trigger on table "public"."chat_groups" to "service_role";

grant truncate on table "public"."chat_groups" to "service_role";

grant update on table "public"."chat_groups" to "service_role";

grant delete on table "public"."chat_messages" to "anon";

grant insert on table "public"."chat_messages" to "anon";

grant references on table "public"."chat_messages" to "anon";

grant select on table "public"."chat_messages" to "anon";

grant trigger on table "public"."chat_messages" to "anon";

grant truncate on table "public"."chat_messages" to "anon";

grant update on table "public"."chat_messages" to "anon";

grant delete on table "public"."chat_messages" to "authenticated";

grant insert on table "public"."chat_messages" to "authenticated";

grant references on table "public"."chat_messages" to "authenticated";

grant select on table "public"."chat_messages" to "authenticated";

grant trigger on table "public"."chat_messages" to "authenticated";

grant truncate on table "public"."chat_messages" to "authenticated";

grant update on table "public"."chat_messages" to "authenticated";

grant delete on table "public"."chat_messages" to "service_role";

grant insert on table "public"."chat_messages" to "service_role";

grant references on table "public"."chat_messages" to "service_role";

grant select on table "public"."chat_messages" to "service_role";

grant trigger on table "public"."chat_messages" to "service_role";

grant truncate on table "public"."chat_messages" to "service_role";

grant update on table "public"."chat_messages" to "service_role";

grant delete on table "public"."group_members" to "anon";

grant insert on table "public"."group_members" to "anon";

grant references on table "public"."group_members" to "anon";

grant select on table "public"."group_members" to "anon";

grant trigger on table "public"."group_members" to "anon";

grant truncate on table "public"."group_members" to "anon";

grant update on table "public"."group_members" to "anon";

grant delete on table "public"."group_members" to "authenticated";

grant insert on table "public"."group_members" to "authenticated";

grant references on table "public"."group_members" to "authenticated";

grant select on table "public"."group_members" to "authenticated";

grant trigger on table "public"."group_members" to "authenticated";

grant truncate on table "public"."group_members" to "authenticated";

grant update on table "public"."group_members" to "authenticated";

grant delete on table "public"."group_members" to "service_role";

grant insert on table "public"."group_members" to "service_role";

grant references on table "public"."group_members" to "service_role";

grant select on table "public"."group_members" to "service_role";

grant trigger on table "public"."group_members" to "service_role";

grant truncate on table "public"."group_members" to "service_role";

grant update on table "public"."group_members" to "service_role";

grant delete on table "public"."groups" to "anon";

grant insert on table "public"."groups" to "anon";

grant references on table "public"."groups" to "anon";

grant select on table "public"."groups" to "anon";

grant trigger on table "public"."groups" to "anon";

grant truncate on table "public"."groups" to "anon";

grant update on table "public"."groups" to "anon";

grant delete on table "public"."groups" to "authenticated";

grant insert on table "public"."groups" to "authenticated";

grant references on table "public"."groups" to "authenticated";

grant select on table "public"."groups" to "authenticated";

grant trigger on table "public"."groups" to "authenticated";

grant truncate on table "public"."groups" to "authenticated";

grant update on table "public"."groups" to "authenticated";

grant delete on table "public"."groups" to "service_role";

grant insert on table "public"."groups" to "service_role";

grant references on table "public"."groups" to "service_role";

grant select on table "public"."groups" to "service_role";

grant trigger on table "public"."groups" to "service_role";

grant truncate on table "public"."groups" to "service_role";

grant update on table "public"."groups" to "service_role";


  create policy "service_role_all_chat_group_members"
  on "public"."chat_group_members"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "service_role_all_chat_groups"
  on "public"."chat_groups"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "service_role_all_chat_messages"
  on "public"."chat_messages"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "Allow group admin to manage members"
  on "public"."group_members"
  as permissive
  for all
  to public
using ((group_id IN ( SELECT group_members_1.group_id
   FROM public.group_members group_members_1
  WHERE ((group_members_1.user_id = auth.uid()) AND (group_members_1.role = 'admin'::text)))));



  create policy "Allow user to leave a group"
  on "public"."group_members"
  as permissive
  for delete
  to public
using ((user_id = auth.uid()));



  create policy "Allow user to see their memberships"
  on "public"."group_members"
  as permissive
  for select
  to public
using ((user_id = auth.uid()));



  create policy "Allow authenticated users to create groups"
  on "public"."groups"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Allow group admin to delete group"
  on "public"."groups"
  as permissive
  for delete
  to public
using ((id IN ( SELECT group_members.group_id
   FROM public.group_members
  WHERE ((group_members.user_id = auth.uid()) AND (group_members.role = 'admin'::text)))));



  create policy "Allow group admin to update group"
  on "public"."groups"
  as permissive
  for update
  to public
using ((id IN ( SELECT group_members.group_id
   FROM public.group_members
  WHERE ((group_members.user_id = auth.uid()) AND (group_members.role = 'admin'::text)))));



  create policy "Allow group members to see the group"
  on "public"."groups"
  as permissive
  for select
  to public
using ((id IN ( SELECT group_members.group_id
   FROM public.group_members
  WHERE (group_members.user_id = auth.uid()))));



  create policy "Allow group admin to delete any message"
  on "public"."messages"
  as permissive
  for delete
  to public
using ((group_id IN ( SELECT group_members.group_id
   FROM public.group_members
  WHERE ((group_members.user_id = auth.uid()) AND (group_members.role = 'admin'::text)))));



  create policy "Allow group members to see messages"
  on "public"."messages"
  as permissive
  for select
  to public
using ((group_id IN ( SELECT group_members.group_id
   FROM public.group_members
  WHERE (group_members.user_id = auth.uid()))));



  create policy "Allow group members to send messages"
  on "public"."messages"
  as permissive
  for insert
  to public
with check (((group_id IN ( SELECT group_members.group_id
   FROM public.group_members
  WHERE (group_members.user_id = auth.uid()))) AND (user_id = auth.uid())));



  create policy "Allow message sender to delete their own messages"
  on "public"."messages"
  as permissive
  for delete
  to public
using ((user_id = auth.uid()));



