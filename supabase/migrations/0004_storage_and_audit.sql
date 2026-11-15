-- =====================================================================
-- 0004_storage_and_audit.sql
-- F-09  No storage bucket / storage policies existed in the repo
--       (documents.file_url pointed at nothing). A bucket created from the
--       dashboard defaults to whatever the creator clicks -> public leak risk.
-- F-10  No immutable audit trail for a financial system.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Private bucket `export-docs`, path = {org_id}/{shipment_id}/{file}
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('export-docs', 'export-docs', false, 10485760,
        array['application/pdf','image/png','image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Safe parsers (a malformed path must yield NULL -> deny, never an exception)
create or replace function public.storage_path_org(p text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case when split_part(p, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(p, '/', 1)::uuid end;
$$;

create or replace function public.storage_path_shipment(p text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case when split_part(p, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(p, '/', 2)::uuid end;
$$;

revoke execute on function public.storage_path_org(text), public.storage_path_shipment(text) from public, anon;
grant  execute on function public.storage_path_org(text), public.storage_path_shipment(text) to authenticated;

drop policy if exists export_docs_select on storage.objects;
drop policy if exists export_docs_insert on storage.objects;
drop policy if exists export_docs_update on storage.objects;
drop policy if exists export_docs_delete on storage.objects;

create policy export_docs_select on storage.objects for select to authenticated
  using (bucket_id = 'export-docs'
         and public.is_org_member(public.storage_path_org(name)));

-- the shipment folder must really belong to the org folder
create policy export_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'export-docs'
              and public.has_org_role(public.storage_path_org(name), array['owner','accountant'])
              and exists (select 1 from public.shipments s
                          where s.id = public.storage_path_shipment(name)
                            and s.org_id = public.storage_path_org(name)));

create policy export_docs_update on storage.objects for update to authenticated
  using      (bucket_id = 'export-docs'
              and public.has_org_role(public.storage_path_org(name), array['owner','accountant']))
  with check (bucket_id = 'export-docs'
              and public.has_org_role(public.storage_path_org(name), array['owner','accountant']));

create policy export_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'export-docs'
         and public.has_org_role(public.storage_path_org(name), array['owner']));

-- ---------------------------------------------------------------------
-- Append-only audit log
-- ---------------------------------------------------------------------
create table public.audit_log (
  id         bigint generated always as identity primary key,
  org_id     uuid,
  actor      uuid,                 -- auth.uid(); null = service role / system
  table_name text   not null,
  row_id     text,
  op         text   not null check (op in ('INSERT','UPDATE','DELETE')),
  old_data   jsonb,
  new_data   jsonb,
  at         timestamptz not null default now()
);
create index audit_log_org_at_idx on public.audit_log (org_id, at desc);

alter table public.audit_log enable row level security;
create policy audit_select on public.audit_log for select to authenticated
  using (public.has_org_role(org_id, array['owner','accountant']));

revoke all on public.audit_log from anon, authenticated;
grant  select on public.audit_log to authenticated;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) - 'extracted_data' end;
  v_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) - 'extracted_data' end;
  v_row jsonb := coalesce(v_new, v_old);
begin
  insert into public.audit_log (org_id, actor, table_name, row_id, op, old_data, new_data)
  values ((v_row ->> 'org_id')::uuid,
          auth.uid(),
          tg_table_name,
          coalesce(v_row ->> 'id', v_row ->> 'user_id'),
          tg_op, v_old, v_new);
  return null;
end;
$$;

create or replace function public.audit_forbid_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only' using errcode = '42501';
end;
$$;

create trigger audit_log_no_update_delete
  before update or delete on public.audit_log
  for each row execute function public.audit_forbid_mutation();
create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.audit_forbid_mutation();

create trigger audit_shipments  after insert or update or delete on public.shipments  for each row execute function public.audit_row_change();
create trigger audit_claims     after insert or update or delete on public.iva_claims for each row execute function public.audit_row_change();
create trigger audit_documents  after insert or update or delete on public.documents  for each row execute function public.audit_row_change();
create trigger audit_members    after insert or update or delete on public.org_members for each row execute function public.audit_row_change();
