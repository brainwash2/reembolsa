-- =====================================================================
-- 0003_security_hardening.sql
-- Fixes the $0 dashboard (no org / no claim rows) and closes the RLS gaps
-- found in the audit (see AUDIT F-01 … F-09).
-- Apply AFTER 0001 + 0002.
-- =====================================================================

-- ---------------------------------------------------------------------
-- F-01  Signup never created an organization (the trigger that
--       app/signup/page.tsx relies on did not exist) -> no org_members row
--       -> every RLS-filtered query returned 0 rows -> "$0" everywhere.
--       There is also no INSERT policy on organizations/org_members for a
--       first owner, so it MUST be done by a SECURITY DEFINER trigger.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_org  uuid;
begin
  -- raw_user_meta_data is USER-CONTROLLED: use it for a display name only,
  -- never for roles / org ids. Trim + cap length.
  v_name := left(btrim(coalesce(new.raw_user_meta_data ->> 'company_name', '')), 120);
  if length(v_name) < 2 then
    v_name := 'My Company';
  end if;

  insert into public.organizations (name) values (v_name) returning id into v_org;
  insert into public.org_members (org_id, user_id, role) values (v_org, new.id, 'owner');
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Back-fill: users who already signed up and have no organization.
do $$
declare
  r     record;
  v_org uuid;
  v_nm  text;
begin
  for r in
    select u.id, u.raw_user_meta_data
    from auth.users u
    where not exists (select 1 from public.org_members m where m.user_id = u.id)
  loop
    v_nm := left(btrim(coalesce(r.raw_user_meta_data ->> 'company_name', '')), 120);
    if length(v_nm) < 2 then v_nm := 'My Company'; end if;
    insert into public.organizations (name) values (v_nm) returning id into v_org;
    insert into public.org_members (org_id, user_id, role) values (v_org, r.id, 'owner');
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- F-02  Privilege hygiene. SECURITY DEFINER helpers were callable by
--       anon/PUBLIC through /rest/v1/rpc; anon had table grants.
-- ---------------------------------------------------------------------
revoke execute on function public.is_org_member(uuid)         from public, anon;
revoke execute on function public.has_org_role(uuid, text[])  from public, anon;
grant  execute on function public.is_org_member(uuid)         to authenticated;
grant  execute on function public.has_org_role(uuid, text[])  to authenticated;

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on functions from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- ---------------------------------------------------------------------
-- F-03  org_id / user_id were mutable (an accountant in two orgs could try
--       to move rows between tenants). Make them immutable.
-- ---------------------------------------------------------------------
create or replace function public.forbid_tenant_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.org_id is distinct from old.org_id then
    raise exception 'org_id is immutable' using errcode = '42501';
  end if;
  -- NB: plpgsql resolves record fields eagerly, so branch with nested IFs
  -- (a single `AND` would still try to read new.user_id on tables without it).
  if tg_table_name = 'shipments' then
    if new.user_id is distinct from old.user_id then
      raise exception 'user_id is immutable' using errcode = '42501';
    end if;
  else
    if new.shipment_id is distinct from old.shipment_id then
      raise exception 'shipment_id is immutable' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger shipments_immutable  before update on public.shipments  for each row execute function public.forbid_tenant_change();
create trigger documents_immutable  before update on public.documents  for each row execute function public.forbid_tenant_change();
create trigger claims_immutable     before update on public.iva_claims for each row execute function public.forbid_tenant_change();
create trigger issues_immutable     before update on public.issues     for each row execute function public.forbid_tenant_change();

-- ---------------------------------------------------------------------
-- F-04  An org could be left with no owner (owner can demote/delete self).
--       Cascades (user/org deletion) are allowed so GDPR-style erasure works.
-- ---------------------------------------------------------------------
create or replace function public.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then            -- cascade from auth.users / organizations
    return coalesce(new, old);
  end if;

  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.org_id <> old.org_id)
     and not exists (select 1 from public.org_members m
                     where m.org_id = old.org_id and m.role = 'owner' and m.user_id <> old.user_id)
  then
    raise exception 'an organization must keep at least one owner' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger org_members_last_owner
  before update or delete on public.org_members
  for each row execute function public.protect_last_owner();

-- ---------------------------------------------------------------------
-- F-05  Dashboard/claims data model fixes
--   * status enum in DB ('claimed') did not match the UI ('claim_filed','refunded')
--   * nothing ever created an iva_claims row for a shipment -> locked cash = $0
--   * claim amount has a real source: input VAT credit ("crédito fiscal IVA
--     exportador") tied to the export, NOT 19% of the invoice.
-- ---------------------------------------------------------------------
alter table public.shipments drop constraint if exists shipments_status_check;
update public.shipments set status = 'claim_filed' where status = 'claimed';
alter table public.shipments
  add constraint shipments_status_check
  check (status in ('draft','documents_pending','validated','claim_filed','refunded'));

-- input VAT credit associated with this export, in the org's local currency
-- (CLP for Chile; 0005 generalises the claim side to COP / PEN).
alter table public.shipments
  add column if not exists input_vat_local bigint check (input_vat_local >= 0);

alter table public.iva_claims add constraint iva_claims_id_org_key unique (id, org_id);

create or replace function public.sync_claim_from_shipment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.iva_claims (org_id, shipment_id, amount_clp, missing_docs)
    values (new.org_id, new.id, coalesce(new.input_vat_local, 0), array['Commercial invoice','DUS'])
    on conflict (shipment_id) do nothing;
  else
    update public.iva_claims
       set amount_clp = coalesce(new.input_vat_local, 0)
     where shipment_id = new.id
       and status in ('draft','ready')
       and amount_clp is distinct from coalesce(new.input_vat_local, 0);
  end if;
  return null;
end;
$$;

create trigger shipments_sync_claim_ins
  after insert on public.shipments
  for each row execute function public.sync_claim_from_shipment();
create trigger shipments_sync_claim_upd
  after update of input_vat_local on public.shipments
  for each row execute function public.sync_claim_from_shipment();

-- Back-fill claims for shipments that never got one.
insert into public.iva_claims (org_id, shipment_id, amount_clp, missing_docs)
select s.org_id, s.id, coalesce(s.input_vat_local, 0), array['Commercial invoice','DUS']
from public.shipments s
where not exists (select 1 from public.iva_claims c where c.shipment_id = s.id);

-- Keep missing_docs honest: derived from validated documents, never typed by a client.
create or replace function public.sync_missing_docs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ship uuid := coalesce(new.shipment_id, old.shipment_id);
begin
  update public.iva_claims c
     set missing_docs = array_remove(array[
           case when not exists (select 1 from public.documents d
                  where d.shipment_id = c.shipment_id and d.type = 'invoice' and d.validated)
                then 'Commercial invoice' end,
           case when not exists (select 1 from public.documents d
                  where d.shipment_id = c.shipment_id and d.type = 'dus' and d.validated)
                then 'DUS' end
         ], null)
   where c.shipment_id = v_ship and c.status in ('draft','ready');

  -- a 'ready' claim that lost a validated document goes back to draft
  update public.iva_claims
     set status = 'draft'
   where shipment_id = v_ship and status = 'ready' and cardinality(missing_docs) > 0;
  return null;
end;
$$;

create trigger documents_sync_missing
  after insert or update or delete on public.documents
  for each row execute function public.sync_missing_docs();

-- ---------------------------------------------------------------------
-- F-06  CORE RULE ENFORCED IN THE DATABASE: "the rules engine decides".
--       Any accountant could PATCH iva_claims.status = 'filed' straight through
--       PostgREST while error-severity issues were unresolved.
-- ---------------------------------------------------------------------
create or replace function public.enforce_claim_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- legal transitions only
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'claims must be created as draft' using errcode = '23514';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if not (   (old.status = 'draft'    and new.status = 'ready')
            or (old.status = 'ready'    and new.status in ('draft','filed'))
            or (old.status = 'filed'    and new.status = 'approved')
            or (old.status = 'approved' and new.status = 'paid')) then
      raise exception 'illegal claim transition % -> %', old.status, new.status using errcode = '23514';
    end if;

    if new.status in ('ready','filed') then
      if exists (select 1 from public.issues i
                 where i.shipment_id = new.shipment_id and i.org_id = new.org_id
                   and i.severity = 'error' and not i.resolved) then
        raise exception 'claim blocked: unresolved error issues' using errcode = '23514';
      end if;
      if cardinality(new.missing_docs) > 0 then
        raise exception 'claim blocked: missing documents (%)', array_to_string(new.missing_docs, ', ')
          using errcode = '23514';
      end if;
    end if;

    if new.status = 'filed' then new.filed_at := coalesce(new.filed_at, now()); end if;
    if new.status = 'paid'  then new.paid_at  := coalesce(new.paid_at,  now()); end if;
  end if;
  return new;
end;
$$;

create trigger iva_claims_gate
  before insert or update on public.iva_claims
  for each row execute function public.enforce_claim_gate();

-- A new error issue demotes a 'ready' claim.
create or replace function public.demote_ready_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.severity = 'error' and not new.resolved then
    update public.iva_claims set status = 'draft'
     where shipment_id = new.shipment_id and org_id = new.org_id and status = 'ready';
  end if;
  return null;
end;
$$;

create trigger issues_demote_claim
  after insert or update of resolved, severity on public.issues
  for each row execute function public.demote_ready_claim();

-- ---------------------------------------------------------------------
-- F-07  Clients could flip engine-owned fields:
--         documents.validated / extracted_data  (AI output + verdict)
--         issues.resolved on severity=error     (bypasses the gate)
--         iva_claims.missing_docs               (derived)
--       -> column-level grants + tighter policies. The rules engine writes
--       them from a server-only module (service role) after a membership check.
-- ---------------------------------------------------------------------
revoke insert, update on public.documents from authenticated;
grant  insert (org_id, shipment_id, type, file_url) on public.documents to authenticated;
grant  update (file_url)                            on public.documents to authenticated;

create or replace function public.reset_validation_on_file_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.file_url is distinct from old.file_url then
    new.validated := false;
    new.extracted_data := null;
  end if;
  return new;
end;
$$;
create trigger documents_reset_validation
  before update on public.documents
  for each row execute function public.reset_validation_on_file_change();

-- documents.file_url must live under {org_id}/{shipment_id}/ (matches storage RLS in 0004)
alter table public.documents
  add constraint documents_file_url_path_chk
  check (file_url like org_id::text || '/' || shipment_id::text || '/%') not valid;

-- claims: created by trigger only; clients may edit status/amount (status is gated)
drop policy if exists claims_insert on public.iva_claims;
revoke insert, update on public.iva_claims from authenticated;
grant  update (status, amount_clp) on public.iva_claims to authenticated;

-- issues: written by the engine; humans may only resolve non-error issues
drop policy if exists issues_insert on public.issues;
drop policy if exists issues_update on public.issues;
drop policy if exists issues_delete on public.issues;
revoke insert, update, delete on public.issues from authenticated;
grant  update (resolved) on public.issues to authenticated;
create policy issues_resolve_non_errors on public.issues
  for update to authenticated
  using      (severity <> 'error' and public.has_org_role(org_id, array['owner','accountant']))
  with check (severity <> 'error' and public.has_org_role(org_id, array['owner','accountant']));

-- ---------------------------------------------------------------------
-- F-08  Index every FK / policy column (RLS helpers filter on these).
-- ---------------------------------------------------------------------
create index if not exists org_members_user_idx   on public.org_members (user_id);
create index if not exists shipments_org_idx      on public.shipments   (org_id, created_at desc);
create index if not exists documents_ship_idx     on public.documents   (shipment_id, org_id);
create index if not exists iva_claims_org_idx     on public.iva_claims  (org_id, status);
create index if not exists issues_ship_idx        on public.issues      (shipment_id, org_id) where not resolved;
