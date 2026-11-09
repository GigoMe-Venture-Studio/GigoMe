-- A small stand-in for what Supabase provides, so the migrations and
-- supabase/checks/security_check.sql can run on a plain PostgreSQL 16 (for
-- tests only; never applied to the real project): the anon, authenticated
-- and service_role roles, the auth schema (users, sessions, identities,
-- auth.uid() and auth.jwt() as Supabase defines them), and "supa", a role
-- that plays Supabase's postgres (owns public, bypasses RLS).
-- Minimal stand-in for the Supabase parts the migration relies on (local testing only).
create extension if not exists pgcrypto;
do $$ begin
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;
exception when duplicate_object then null; end $$;
grant anon, authenticated, service_role to postgres;
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  email text,
  aud varchar(255), role varchar(255),
  is_sso_user boolean not null default false,
  is_anonymous boolean not null default false,
  created_at timestamptz default now(),
  last_sign_in_at timestamptz
);
-- Same definitions Supabase uses
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim', true), ''),
                  nullif(current_setting('request.jwt.claims', true), ''))::jsonb $$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
-- More like Supabase: auth tables that cascade from users, and a non-superuser
-- "supa" role that plays postgres (owns public, bypasses RLS, has DML on auth.users).
create table if not exists auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users (id) on delete cascade);
create table if not exists auth.identities (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users (id) on delete cascade);
do $$ begin create role supa login bypassrls createrole; exception when duplicate_object then null; end $$;
grant anon, authenticated, service_role to supa;
grant usage, create on schema public to supa;
grant usage on schema auth to supa;
grant select, insert, update, delete, trigger, references on auth.users, auth.sessions, auth.identities to supa;
grant execute on all functions in schema auth to supa;
alter schema public owner to supa;
