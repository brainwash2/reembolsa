-- =====================================================================
-- 0006_scaling_features.sql   ("Financial OS" foundations)
--   A. MCP-native agent workflow   (audit + read views + write guard)
--   B. Factoring data package      (1-click, consent-gated, non-lending)
--   C. Open Finance (SFA) readiness (consent ledger + bank data model)
-- Apply AFTER 0005.
-- Design rule for B and C: Reembolsa moves DATA with consent. It never
-- scores, ranks, advances or lends. Partner statuses are partner-reported.
-- =====================================================================

-- =====================================================================
-- SHARED: consent ledger (used by B and C; Ley 21.719 / Ley 1581 / Ley 29733
-- all require specific, informed, revocable consent for this kind of sharing)
-- =====================================================================
create table public.data_consents (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references public.organizations(id) on delete cascade,
  granted_by           uuid not null default auth.uid() references auth.users(id),
  counterparty_kind    text not null check (counterparty_kind in ('factoring_partner','bank_open_finance','accountant_firm')),
  counterparty_id      text not null,                       -- factoring_partners.id::text | institution code
  purpose              text not null check (length(purpose) between 10 and 500),
  scopes               text[] not null check (cardinality(scopes) > 0),
  consent_text_version text not null,                       -- exact wording shown, versioned in app
  legal_basis          text not null default 'consent',
  granted_at           timestamptz not null default now(),
  expires_at           timestamptz not null,
  revoked_at           timestamptz,
  revoked_by           uuid references auth.users(id),
  evidence             jsonb not null default '{}'::jsonb,  -- ip_hash, ua_hash, locale (no raw IP)
  unique (id, org_id),
  check (expires_at > granted_at),
  check ((revoked_at is null) = (revoked_by is null))
);
create index data_consents_org_idx on public.data_consents (org_id, counterparty_kind);

create table public.consent_events (
  id         bigint generated always as identity primary key,
  consent_id uuid not null references public.data_consents(id) on delete cascade,
  org_id     uuid not null,
  event      text not null check (event in ('granted','revoked','expired','used')),
  actor      uuid,
  meta       jsonb not null default '{}'::jsonb,
  at         timestamptz not null default now()
);
create index consent_events_consent_idx on public.consent_events (consent_id, at);

alter table public.data_consents enable row level security;
alter table public.consent_events enable row level security;

create policy consents_select on public.data_consents for select to authenticated
  using (public.has_org_role(org_id, array['owner','accountant']));
create policy consents_insert on public.data_consents for insert to authenticated
  with check (public.has_org_role(org_id, array['owner']) and granted_by = (select auth.uid()));
create policy consents_revoke on public.data_consents for update to authenticated
  using (public.has_org_role(org_id, array['owner']))
  with check (public.has_org_role(org_id, array['owner']));
create policy consent_events_select on public.consent_events for select to authenticated
  using (public.has_org_role(org_id, array['owner','accountant']));

revoke all on public.data_consents, public.consent_events from anon, authenticated;
grant select on public.data_consents, public.consent_events to authenticated;
grant insert (org_id, counterparty_kind, counterparty_id, purpose, scopes,
              consent_text_version, expires_at, evidence)       on public.data_consents to authenticated;
grant update (revoked_at, revoked_by)                           on public.data_consents to authenticated;

-- ledger rows are written by trigger only
create or replace function public.log_consent_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.consent_events (consent_id, org_id, event, actor)
    values (new.id, new.org_id, 'granted', auth.uid());
  elsif old.revoked_at is null and new.revoked_at is not null then
    insert into public.consent_events (consent_id, org_id, event, actor)
    values (new.id, new.org_id, 'revoked', auth.uid());
  end if;
  -- only revocation fields may change after grant
  if tg_op = 'UPDATE' and (new.scopes is distinct from old.scopes
      or new.expires_at is distinct from old.expires_at
      or new.counterparty_id is distinct from old.counterparty_id
      or new.org_id is distinct from old.org_id) then
    raise exception 'consents are immutable once granted; revoke and re-grant' using errcode = '42501';
  end if;
  return null;
end;
$$;
create trigger data_consents_ledger
  after insert or update on public.data_consents
  for each row execute function public.log_consent_event();

create or replace function public.consent_is_active(p_consent uuid, p_scope text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.data_consents c
                  where c.id = p_consent and c.revoked_at is null and c.expires_at > now()
                    and p_scope = any (c.scopes)
                    and public.is_org_member(c.org_id));
$$;
revoke execute on function public.consent_is_active(uuid, text) from public, anon;
grant  execute on function public.consent_is_active(uuid, text) to authenticated;

-- =====================================================================
-- B. FACTORING DATA PACKAGE
-- =====================================================================
create table public.factoring_partners (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name               text not null,
  country            char(2) not null references public.tax_jurisdictions(country),
  active             boolean not null default false,
  webhook_secret_ref uuid,              -- Supabase Vault secret id (HMAC for inbound webhooks)
  created_at         timestamptz not null default now()
);
alter table public.factoring_partners enable row level security;
create policy partners_read on public.factoring_partners for select to authenticated using (active);
revoke all on public.factoring_partners from anon, authenticated;
grant select (id, slug, name, country, active) on public.factoring_partners to authenticated;

create table public.data_packages (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null,
  shipment_id           uuid not null,
  version               int  not null default 1 check (version > 0),
  status                text not null default 'ready' check (status in ('ready','shared','revoked')),
  manifest              jsonb not null default '{}'::jsonb,   -- docs + sha256 + rule results
  storage_path          text not null,
  sha256                text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  rules_engine_version  text not null,
  rules_passed          boolean not null,
  generated_by          uuid not null default auth.uid() references auth.users(id),
  created_at            timestamptz not null default now(),
  unique (shipment_id, version),
  unique (id, org_id),
  check (rules_passed),
  foreign key (shipment_id, org_id) references public.shipments(id, org_id) on delete cascade
);
create index data_packages_org_idx on public.data_packages (org_id, created_at desc);

create table public.package_shares (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null,
  package_id           uuid not null,
  partner_id           uuid not null references public.factoring_partners(id),
  consent_id           uuid not null,
  status               text not null default 'pending'
                       check (status in ('pending','sent','received','under_review','offer_received',
                                         'declined','funded','expired','failed')),
  partner_reference    text,
  idempotency_key      text not null check (length(idempotency_key) between 8 and 80),
  shared_by            uuid not null default auth.uid() references auth.users(id),
  shared_at            timestamptz not null default now(),
  status_updated_at    timestamptz not null default now(),
  status_detail        jsonb not null default '{}'::jsonb,    -- partner-reported, opaque to us
  unique (package_id, partner_id),
  unique (org_id, idempotency_key),
  unique (id, org_id),
  foreign key (package_id, org_id) references public.data_packages(id, org_id) on delete cascade,
  foreign key (consent_id, org_id) references public.data_consents(id, org_id)
);
create index package_shares_org_idx     on public.package_shares (org_id, status);
create index package_shares_partner_idx on public.package_shares (partner_id);
create index package_shares_consent_idx on public.package_shares (consent_id);

-- raw inbound partner events: service role only (no policy, no grant)
create table public.partner_events (
  id              bigint generated always as identity primary key,
  partner_id      uuid not null references public.factoring_partners(id),
  share_id        uuid references public.package_shares(id) on delete set null,
  event_type      text not null,
  payload         jsonb not null,
  signature_valid boolean not null,
  received_at     timestamptz not null default now(),
  processed_at    timestamptz
);
create index partner_events_share_idx on public.partner_events (share_id);
alter table public.partner_events enable row level security;
revoke all on public.partner_events from anon, authenticated;

alter table public.data_packages  enable row level security;
alter table public.package_shares enable row level security;
create policy packages_select on public.data_packages  for select to authenticated using (public.is_org_member(org_id));
create policy shares_select   on public.package_shares for select to authenticated
  using (public.has_org_role(org_id, array['owner','accountant']));
revoke all on public.data_packages, public.package_shares from anon, authenticated;
grant select on public.data_packages, public.package_shares to authenticated;

-- Package registration: the DATABASE re-checks readiness itself; the caller
-- (web action OR MCP tool) cannot assert "rules passed".
create or replace function public.register_data_package(
  p_shipment uuid, p_manifest jsonb, p_sha256 text, p_storage_path text, p_engine_version text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_ver int;
  v_id  uuid;
begin
  select org_id into v_org from public.shipments where id = p_shipment;
  if v_org is null or not public.has_org_role(v_org, array['owner','accountant']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if cardinality(public.missing_docs_for(p_shipment)) > 0 then
    raise exception 'package blocked: missing validated documents' using errcode = '23514';
  end if;
  if exists (select 1 from public.issues i
              where i.shipment_id = p_shipment and i.org_id = v_org and i.severity = 'error' and not i.resolved) then
    raise exception 'package blocked: unresolved error issues' using errcode = '23514';
  end if;
  if p_storage_path not like v_org::text || '/' || p_shipment::text || '/%' then
    raise exception 'storage path must live under the shipment folder' using errcode = '23514';
  end if;

  select coalesce(max(version), 0) + 1 into v_ver from public.data_packages where shipment_id = p_shipment;
  insert into public.data_packages (org_id, shipment_id, version, manifest, storage_path, sha256,
                                    rules_engine_version, rules_passed, generated_by)
  values (v_org, p_shipment, v_ver, coalesce(p_manifest, '{}'), p_storage_path, p_sha256,
          p_engine_version, true, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Share = owner decision + live consent for THIS partner + READY package.
create or replace function public.share_data_package(
  p_package uuid, p_partner uuid, p_consent uuid, p_idempotency text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_id  uuid;
begin
  select org_id into v_org from public.data_packages where id = p_package and status in ('ready','shared');
  if v_org is null or not public.has_org_role(v_org, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.factoring_partners where id = p_partner and active) then
    raise exception 'partner not available' using errcode = '22023';
  end if;
  if not exists (select 1 from public.data_consents c
                  where c.id = p_consent and c.org_id = v_org
                    and c.counterparty_kind = 'factoring_partner' and c.counterparty_id = p_partner::text
                    and c.revoked_at is null and c.expires_at > now()
                    and 'share_package' = any (c.scopes)) then
    raise exception 'no active consent for this partner' using errcode = '42501';
  end if;

  insert into public.package_shares (org_id, package_id, partner_id, consent_id, idempotency_key)
  values (v_org, p_package, p_partner, p_consent, p_idempotency)
  on conflict (org_id, idempotency_key) do update set idempotency_key = excluded.idempotency_key
  returning id into v_id;

  update public.data_packages set status = 'shared' where id = p_package and status = 'ready';
  return v_id;
end;
$$;

-- Revoking consent stops anything not yet delivered (data already sent cannot be recalled)
create or replace function public.expire_pending_shares_on_revoke()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.revoked_at is null and new.revoked_at is not null then
    update public.package_shares set status = 'expired', status_updated_at = now()
     where consent_id = new.id and status = 'pending';
  end if;
  return null;
end;
$$;
create trigger consents_expire_shares
  after update of revoked_at on public.data_consents
  for each row execute function public.expire_pending_shares_on_revoke();

revoke execute on function public.register_data_package(uuid, jsonb, text, text, text) from public, anon;
revoke execute on function public.share_data_package(uuid, uuid, uuid, text)          from public, anon;
grant  execute on function public.register_data_package(uuid, jsonb, text, text, text) to authenticated;
grant  execute on function public.share_data_package(uuid, uuid, uuid, text)           to authenticated;

-- =====================================================================
-- C. OPEN FINANCE (SFA) READINESS - data model only; no live connector until
--    Chile's SFA go-live (July 2027) and CMF participant registration.
-- =====================================================================
create table public.bank_connections (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null,
  consent_id       uuid not null,
  provider         text not null check (provider in ('sfa_cl','open_finance_co','aggregator')),
  institution_code text not null,
  institution_name text,
  status           text not null default 'pending_consent'
                   check (status in ('pending_consent','active','refresh_required','revoked','error')),
  vault_secret_id  uuid,                 -- tokens live in Supabase Vault, never in this table
  scopes           text[] not null default '{}',
  last_synced_at   timestamptz,
  last_error       text,
  created_at       timestamptz not null default now(),
  unique (id, org_id),
  foreign key (consent_id, org_id) references public.data_consents(id, org_id)
);
create index bank_connections_org_idx on public.bank_connections (org_id, status);
create index bank_connections_consent_idx on public.bank_connections (consent_id);

create table public.bank_accounts (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null,
  connection_id       uuid not null,
  external_account_id text not null,
  account_type        text not null check (account_type in ('checking','savings','credit_line','other')),
  currency            char(3) not null check (currency ~ '^[A-Z]{3}$'),
  mask_last4          text check (mask_last4 ~ '^[0-9A-Za-z]{0,4}$'),   -- never a full account number
  display_name        text,
  created_at          timestamptz not null default now(),
  unique (id, org_id),
  unique (connection_id, external_account_id),
  foreign key (connection_id, org_id) references public.bank_connections(id, org_id) on delete cascade
);
create index bank_accounts_org_idx on public.bank_accounts (org_id);

create table public.sfa_transactions (
  id                      uuid primary key default gen_random_uuid(),
  org_id                  uuid not null,
  account_id              uuid not null,
  external_tx_id          text not null,
  booked_at               timestamptz not null,
  amount                  numeric(18,2) not null,                 -- signed; credit > 0
  currency                char(3) not null check (currency ~ '^[A-Z]{3}$'),
  description             text,
  counterparty_name       text,
  counterparty_tax_id_hash bytea,                                 -- sha256(salted); no raw tax ids
  match_status            text not null default 'unmatched'
                          check (match_status in ('unmatched','suggested','confirmed','rejected')),
  matched_claim_id        uuid,
  match_confidence        numeric(4,3) check (match_confidence between 0 and 1),
  retention_until         date,                                   -- set per data-retention policy (counsel)
  created_at              timestamptz not null default now(),
  unique (account_id, external_tx_id),
  foreign key (account_id, org_id)       references public.bank_accounts(id, org_id) on delete cascade,
  foreign key (matched_claim_id, org_id) references public.iva_claims(id, org_id) on delete set null (matched_claim_id)
);
create index sfa_tx_org_booked_idx on public.sfa_transactions (org_id, booked_at desc);
create index sfa_tx_account_idx    on public.sfa_transactions (account_id);
create index sfa_tx_claim_idx      on public.sfa_transactions (matched_claim_id) where matched_claim_id is not null;

alter table public.bank_connections enable row level security;
alter table public.bank_accounts    enable row level security;
alter table public.sfa_transactions enable row level security;

-- Tier-1 financial data: OWNER only. Sync workers write with the service role.
create policy bank_conn_select on public.bank_connections for select to authenticated using (public.has_org_role(org_id, array['owner']));
create policy bank_acct_select on public.bank_accounts    for select to authenticated using (public.has_org_role(org_id, array['owner']));
create policy sfa_tx_select    on public.sfa_transactions for select to authenticated using (public.has_org_role(org_id, array['owner']));
create policy sfa_tx_confirm   on public.sfa_transactions for update to authenticated
  using (public.has_org_role(org_id, array['owner'])) with check (public.has_org_role(org_id, array['owner']));

revoke all on public.bank_connections, public.bank_accounts, public.sfa_transactions from anon, authenticated;
grant select (id, org_id, consent_id, provider, institution_code, institution_name, status, scopes, last_synced_at, created_at)
  on public.bank_connections to authenticated;           -- vault_secret_id / last_error stay hidden
grant select on public.bank_accounts, public.sfa_transactions to authenticated;
grant update (match_status, matched_claim_id) on public.sfa_transactions to authenticated;

-- =====================================================================
-- A. MCP-NATIVE AGENT WORKFLOW
--    Auth = Supabase OAuth 2.1 (user token -> same RLS as the web app).
--    Defence in depth: OAuth-client sessions are READ-ONLY on every table;
--    they can only mutate through allow-listed SECURITY DEFINER RPCs
--    (register_data_package, ...), which re-check role + readiness.
--    NOTE: verify the exact claim name ('client_id') on a real token first.
-- =====================================================================
create or replace function public.is_oauth_client_session()
returns boolean
language sql
stable
set search_path = ''
as $$ select (auth.jwt() ->> 'client_id') is not null; $$;
grant execute on function public.is_oauth_client_session() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['organizations','org_members','shipments','documents','iva_claims','issues',
                           'data_consents','sfa_transactions'] loop
    execute format('create policy %I on public.%I as restrictive for insert to authenticated
                      with check (not public.is_oauth_client_session())', t || '_no_oauth_ins', t);
    execute format('create policy %I on public.%I as restrictive for update to authenticated
                      using (not public.is_oauth_client_session())', t || '_no_oauth_upd', t);
    execute format('create policy %I on public.%I as restrictive for delete to authenticated
                      using (not public.is_oauth_client_session())', t || '_no_oauth_del', t);
  end loop;
end $$;

-- Read model for the MCP tools (RLS applies because security_invoker = true)
create view public.v_pending_claims with (security_invoker = true) as
select c.id            as claim_id,
       c.org_id,
       s.reference,
       s.buyer,
       s.destination,
       c.status,
       c.amount_local,
       c.local_currency,
       c.missing_docs,
       c.tax_authority,
       c.local_form_code,
       (select count(*) from public.issues i
         where i.shipment_id = c.shipment_id and i.org_id = c.org_id
           and i.severity = 'error' and not i.resolved) as open_errors,
       c.created_at
  from public.iva_claims c
  join public.shipments s on s.id = c.shipment_id and s.org_id = c.org_id
 where c.status <> 'paid';

create or replace function public.iva_locked_summary()
returns table (local_currency char(3), status text, claims bigint, amount_local bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.local_currency, c.status, count(*), coalesce(sum(c.amount_local), 0)::bigint
    from public.iva_claims c
   where c.status <> 'paid'
   group by c.local_currency, c.status
   order by c.local_currency, c.status;
$$;

create table public.mcp_tool_calls (
  id          bigint generated always as identity primary key,
  org_id      uuid,
  user_id     uuid,
  client_id   text,
  tool        text not null,
  args_sha256 text,                       -- hash of arguments, not the arguments (may hold PII)
  outcome     text not null check (outcome in ('ok','denied','error','dry_run')),
  duration_ms int,
  at          timestamptz not null default now()
);
create index mcp_tool_calls_org_at_idx on public.mcp_tool_calls (org_id, at desc);
alter table public.mcp_tool_calls enable row level security;
create policy mcp_calls_select on public.mcp_tool_calls for select to authenticated
  using (public.has_org_role(org_id, array['owner']));
revoke all on public.mcp_tool_calls from anon, authenticated;
grant select on public.mcp_tool_calls to authenticated;   -- inserts: service role from the MCP server

grant select on public.v_pending_claims to authenticated;
revoke all on public.v_pending_claims from anon;
revoke execute on function public.iva_locked_summary() from public, anon;
grant  execute on function public.iva_locked_summary() to authenticated;
