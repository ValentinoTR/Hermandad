-- Only HSMI resources. Does not alter public, auth, ao_private or other applications.
create schema hsmi;
revoke all on schema hsmi from public, anon, authenticated;
do $role$ begin
 if not exists(select 1 from pg_roles where rolname='hsmi_app') then
  create role hsmi_app nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
 end if;
end $role$;
create table hsmi.members(id text primary key,name text not null,group_name text not null,data text not null check(jsonb_typeof(data::jsonb)='object'),revision integer not null default 0,last_mutation text not null default '');
create table hsmi.concepts(id text primary key,year integer not null,name text not null,amount integer);
create table hsmi.audit(id text primary key,at text not null,actor text not null,action text not null,member_id text,detail text not null check(jsonb_typeof(detail::jsonb)='object'));
create table hsmi.app_users(email text primary key,user_id text,name text not null,role text not null check(role in ('admin','treasurer','viewer')));
create table hsmi.settings(key text primary key,value text not null);
create table hsmi.credentials(email text primary key references hsmi.app_users(email),password_hash text not null,created_at text not null,disabled integer not null default 0);
create table hsmi.sessions(token_hash text primary key,email text not null references hsmi.app_users(email),expires_at bigint not null);
create table hsmi.invitations(token_hash text primary key,email text not null references hsmi.app_users(email),expires_at bigint not null,consumed_by text);
create table hsmi.auth_limits(key text primary key,attempts integer not null,expires_at bigint not null);
create index hsmi_members_name_idx on hsmi.members(lower(name));
create index hsmi_audit_at_idx on hsmi.audit(at desc,id desc);
create index hsmi_sessions_email_idx on hsmi.sessions(email);
create index hsmi_sessions_expiry_idx on hsmi.sessions(expires_at);
create index hsmi_invitations_email_idx on hsmi.invitations(email);
grant usage on schema hsmi to hsmi_app;
do $policies$ declare t text; begin
 foreach t in array array['members','concepts','audit','app_users','settings','credentials','sessions','invitations','auth_limits'] loop
  execute format('alter table hsmi.%I enable row level security',t);
  execute format('alter table hsmi.%I force row level security',t);
  execute format('revoke all on table hsmi.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update,delete on table hsmi.%I to hsmi_app',t);
  execute format('create policy hsmi_server on hsmi.%I for all to hsmi_app using(true) with check(true)',t);
 end loop;
end $policies$;
-- hsmi_app is a backend-only database principal, never a browser user.
-- The application authenticates and authorizes each request before executing SQL.
