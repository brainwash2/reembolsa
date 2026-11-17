-- =====================================================================
-- 0007_sii_sync_ingestion.sql
-- Supports "Sync with SII (Demo)": automatic ingestion instead of manual typing.
--   * shipments.source / external_ref  -> provenance + idempotent re-sync
--   * documents.source                 -> SII e-documents have no uploaded file
--   * ingest_runs                      -> sync history (who, when, FX snapshot)
-- Apply AFTER 0006. Idempotent.
-- =====================================================================

alter table public.shipments
  add column if not exists source       text not null default 'manual',
  add column if not exists external_ref text;

alter table public.shipments drop constraint if exists shipments_source_check;
alter table public.shipments
  add constraint shipments_source_check
  check (source in ('manual','sii_demo') and (source = 'manual' or external_ref is not null));

-- A re-sync (or a double click) can never create the same SII record twice.
create unique index if not exists shipments_org_external_ref_uq
  on public.shipments (org_id, external_ref) where external_ref is not null;

-- Documents that come from the SII feed are logical references (no file in the bucket).
-- Clients cannot set this column (column-level INSERT grant from 0003 does not include it).
alter table public.documents
  add column if not exists source text not null default 'upload';
alter table public.documents drop constraint if exists documents_source_check;
alter table public.documents add constraint documents_source_check check (source in ('upload','sii_demo'));

create table if not exists public.ingest_runs (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id),
  source     text not null check (source in ('sii_demo')),
  fetched    int  not null check (fetched >= 0),
  inserted   int  not null check (inserted >= 0),
  skipped    int  not null default 0 check (skipped >= 0),
  fx         jsonb not null default '[]'::jsonb,      -- rates used: [{pair, rate, asOf, source}]
  created_at timestamptz not null default now()
);
create index if not exists ingest_runs_org_idx on public.ingest_runs (org_id, created_at desc);

alter table public.ingest_runs enable row level security;
drop policy if exists ingest_runs_select on public.ingest_runs;
drop policy if exists ingest_runs_insert on public.ingest_runs;
create policy ingest_runs_select on public.ingest_runs for select to authenticated
  using (public.is_org_member(org_id));
create policy ingest_runs_insert on public.ingest_runs for insert to authenticated
  with check (public.has_org_role(org_id, array['owner','accountant']) and user_id = (select auth.uid()));

revoke all on public.ingest_runs from anon, authenticated;
grant select on public.ingest_runs to authenticated;
grant insert (org_id, source, fetched, inserted, skipped, fx) on public.ingest_runs to authenticated;
