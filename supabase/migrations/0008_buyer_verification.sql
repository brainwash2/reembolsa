-- =====================================================================
-- 0008_buyer_verification.sql
-- Evidence of buyer checks against free official registries (VIES, Norwegian register).
-- INFORMATIONAL: it never changes a claim's status; the rules engine stays the only gate.
-- Apply AFTER 0007. Idempotent.
-- =====================================================================
create table if not exists public.buyer_verifications (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  shipment_id uuid not null,
  checked_by  uuid not null default auth.uid() references auth.users(id),
  provider    text not null check (provider in ('vies','brreg','none')),
  status      text not null check (status in ('valid','invalid','unavailable','not_checkable')),
  country     char(2) not null check (country ~ '^[A-Z]{2}$'),
  query       text not null check (length(query) between 1 and 40),
  name        text check (length(name) <= 300),
  address     text check (length(address) <= 500),
  note        text not null check (length(note) <= 300),
  checked_at  timestamptz not null default now(),
  foreign key (shipment_id, org_id) references public.shipments(id, org_id) on delete cascade
);
create index if not exists buyer_verifications_ship_idx on public.buyer_verifications (shipment_id, checked_at desc);

alter table public.buyer_verifications enable row level security;
drop policy if exists buyer_verifications_select on public.buyer_verifications;
drop policy if exists buyer_verifications_insert on public.buyer_verifications;
create policy buyer_verifications_select on public.buyer_verifications for select to authenticated
  using (public.is_org_member(org_id));
create policy buyer_verifications_insert on public.buyer_verifications for insert to authenticated
  with check (public.has_org_role(org_id, array['owner','accountant']) and checked_by = (select auth.uid()));

revoke all on public.buyer_verifications from anon, authenticated;
grant select on public.buyer_verifications to authenticated;
grant insert (org_id, shipment_id, provider, status, country, query, name, address, note)
  on public.buyer_verifications to authenticated;
-- no UPDATE / DELETE: checks are an append-only log.
