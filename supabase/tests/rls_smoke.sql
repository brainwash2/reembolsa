-- =====================================================================
-- rls_smoke.sql  - plain-SQL regression test for migrations 0001 -> 0006.
-- Run on a scratch database (NOT production):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_smoke.sql
-- Everything runs inside one transaction and is rolled back at the end.
-- Prints "PASS ..." per check; any failure aborts with "FAIL ...".
-- =====================================================================
begin;

create schema t;
grant usage on schema t to authenticated, anon;

create function t.as_user(u uuid, extra jsonb default '{}'::jsonb) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
         (jsonb_build_object('sub', u, 'role', 'authenticated') || extra)::text, true);
  execute 'set local role authenticated';
end $$;

create function t.must_fail(q text, pat text, label text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    if sqlerrm ~* pat then raise notice 'PASS  %', label; return; end if;
    raise exception 'FAIL  %: unexpected error "%"', label, sqlerrm;
  end;
  raise exception 'FAIL  %: expected error /%/ but statement succeeded', label, pat;
end $$;

create function t.must_equal(q text, expected text, label text) returns void language plpgsql as $$
declare v text;
begin
  execute q into v;
  if v is not distinct from expected then raise notice 'PASS  %', label; return; end if;
  raise exception 'FAIL  %: expected %, got %', label, expected, v;
end $$;

-- ---------- F-01 signup bootstrap --------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-000000000001', 'a@x.test', jsonb_build_object('company_name', 'Org A SpA')),
 ('bbbbbbbb-0000-0000-0000-000000000002', 'b@x.test', jsonb_build_object('company_name', repeat('Z', 300), 'country', 'CO')),
 ('cccccccc-0000-0000-0000-000000000003', 'c@x.test', '{}'::jsonb);

select set_config('t.orga', (select org_id::text from public.org_members where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), false);
select set_config('t.orgb', (select org_id::text from public.org_members where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), false);

select t.must_equal($$select count(*)::text from public.org_members$$, '3', 'F-01 every signup got an org + owner row');
select t.must_equal($$select length(name)::text from public.organizations where id = current_setting('t.orgb')::uuid$$, '120', 'F-01 company_name capped at 120');
select t.must_equal($$select country from public.organizations where id = current_setting('t.orgb')::uuid$$, 'CL', 'LatAm inactive country falls back to CL');

-- viewer in org A
insert into public.org_members (org_id, user_id, role)
values (current_setting('t.orga')::uuid, 'cccccccc-0000-0000-0000-000000000003', 'viewer');

-- ---------- tenant isolation + claim auto-creation ---------------------
select t.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.shipments (org_id, reference, buyer, destination, invoice_amount, currency, input_vat_local)
values (current_setting('t.orga')::uuid, 'EXP-A-1', 'Hamburg GmbH', 'Germany', 48200, 'EUR', 7940000);
select set_config('t.ship', (select id::text from public.shipments where reference = 'EXP-A-1'), false);

select t.must_equal($$select amount_clp::text from public.iva_claims$$, '7940000', 'F-05 claim auto-created with amount (dashboard no longer $0)');
select t.must_equal($$select missing_docs::text from public.iva_claims$$, '{DUS,"Commercial invoice"}', 'F-05 missing_docs derived');
select t.must_fail($$insert into public.shipments (org_id, reference, buyer, destination, invoice_amount, currency)
                      values (current_setting('t.orgb')::uuid, 'X', 'X', 'X', 1, 'USD')$$,
                   'row-level security', 'RLS: cannot insert into another org');
select t.must_fail($$update public.shipments set org_id = current_setting('t.orgb')::uuid$$,
                   'immutable|row-level security', 'F-03 org_id immutable');

select t.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select t.must_equal($$select count(*)::text from public.shipments$$, '0', 'RLS: org B sees none of org A shipments');
select t.must_equal($$select count(*)::text from public.iva_claims$$, '0', 'RLS: org B sees none of org A claims');

select t.as_user('cccccccc-0000-0000-0000-000000000003');
select t.must_fail($$insert into public.shipments (org_id, reference, buyer, destination, invoice_amount, currency)
                      values (current_setting('t.orga')::uuid, 'V', 'V', 'V', 1, 'USD')$$,
                   'row-level security', 'RLS: viewer cannot write');

reset role;
select t.must_fail($$set local role anon; select count(*) from public.shipments$$, 'permission denied', 'F-02 anon has no table access');
reset role;

-- ---------- F-06 / F-07 claim gate + engine-owned columns --------------
select t.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select t.must_fail($$update public.iva_claims set status = 'paid'$$, 'illegal claim transition', 'F-06 cannot jump draft -> paid');
select t.must_fail($$update public.iva_claims set status = 'ready'$$, 'missing documents', 'F-06 cannot mark ready while docs missing');

insert into public.documents (org_id, shipment_id, type, file_url) values
  (current_setting('t.orga')::uuid, current_setting('t.ship')::uuid, 'invoice',
   current_setting('t.orga') || '/' || current_setting('t.ship') || '/invoice.pdf'),
  (current_setting('t.orga')::uuid, current_setting('t.ship')::uuid, 'dus',
   current_setting('t.orga') || '/' || current_setting('t.ship') || '/dus.pdf');
select t.must_fail($$update public.documents set validated = true$$, 'permission denied', 'F-07 client cannot set documents.validated');
select t.must_fail($$insert into public.documents (org_id, shipment_id, type, file_url)
                      values (current_setting('t.orga')::uuid, current_setting('t.ship')::uuid, 'dus', 'evil/path.pdf')$$,
                   'unique|check constraint', 'F-09 file_url must sit under {org}/{shipment}/');

-- rules engine (service role) validates both documents
reset role;
update public.documents set validated = true;
select t.must_equal($$select missing_docs::text from public.iva_claims$$, '{}', 'missing_docs cleared by validated docs');

select t.as_user('aaaaaaaa-0000-0000-0000-000000000001');
update public.iva_claims set status = 'ready';
select t.must_equal($$select status from public.iva_claims$$, 'ready', 'F-06 claim can be ready when engine is green');

-- engine raises an error issue -> claim demoted; human cannot resolve it
reset role;
insert into public.issues (org_id, shipment_id, severity, code, message)
values (current_setting('t.orga')::uuid, current_setting('t.ship')::uuid, 'error', 'TOTAL_MISMATCH', 'Invoice total != DUS value');
select t.must_equal($$select status from public.iva_claims$$, 'draft', 'new error issue demotes ready claim');

select t.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select t.must_equal($$with u as (update public.issues set resolved = true returning 1) select count(*)::text from u$$, '0', 'F-07 humans cannot resolve error issues');
select t.must_fail($$update public.iva_claims set status = 'ready'$$, 'unresolved error', 'F-06 gate blocks while error unresolved');

reset role;
update public.issues set resolved = true;                       -- engine re-run
select t.as_user('aaaaaaaa-0000-0000-0000-000000000001');
update public.iva_claims set status = 'ready';
update public.iva_claims set status = 'filed';
select t.must_equal($$select (filed_at is not null)::text from public.iva_claims$$, 'true', 'filed_at stamped by trigger');

-- ---------- F-04 last owner --------------------------------------------
select t.must_fail($$delete from public.org_members where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
                   'at least one owner', 'F-04 last owner cannot be removed');

-- ---------- F-09 storage ------------------------------------------------
select t.must_equal($$with i as (insert into storage.objects (bucket_id, name)
          values ('export-docs', current_setting('t.orga') || '/' || current_setting('t.ship') || '/p.pdf') returning 1)
          select count(*)::text from i$$, '1', 'F-09 member can upload under own org/shipment');
select t.must_fail($$insert into storage.objects (bucket_id, name)
          values ('export-docs', current_setting('t.orgb') || '/' || current_setting('t.ship') || '/p.pdf')$$,
          'row-level security', 'F-09 cannot upload into another org folder');
select t.must_fail($$insert into storage.objects (bucket_id, name) values ('export-docs', 'not-a-uuid/x/p.pdf')$$,
          'row-level security', 'F-09 malformed path denied (no exception leak)');
select t.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select t.must_equal($$select count(*)::text from storage.objects$$, '0', 'F-09 org B cannot read org A files');

-- ---------- F-10 audit log ----------------------------------------------
select t.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select t.must_equal($$select (count(*) > 0)::text from public.audit_log$$, 'true', 'F-10 owner can read own audit trail');
select t.must_fail($$delete from public.audit_log$$, 'permission denied', 'F-10 authenticated cannot delete audit rows');
reset role;
select t.must_fail($$update public.audit_log set op = 'INSERT'$$, 'append-only', 'F-10 even service role cannot rewrite audit rows');

-- ---------- A. MCP / OAuth sessions are read-only ------------------------
select t.as_user('aaaaaaaa-0000-0000-0000-000000000001', '{"client_id":"claude-mcp"}');
select t.must_equal($$select count(*)::text from public.v_pending_claims$$, '1', 'A: OAuth session can read via security_invoker view');
select t.must_equal($$with u as (update public.shipments set buyer = 'hacked' returning 1) select count(*)::text from u$$, '0', 'A: OAuth session cannot mutate tables directly');

-- ---------- B. factoring package, consent-gated ---------------------------
reset role;
insert into public.factoring_partners (id, slug, name, country, active)
values ('dddddddd-0000-0000-0000-000000000004', 'test-partner', 'Test Partner', 'CL', true);

select t.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select set_config('t.pkg', public.register_data_package(current_setting('t.ship')::uuid, '{"docs":2}', repeat('a',64),
                      current_setting('t.orga') || '/' || current_setting('t.ship') || '/pkg.zip', 'rules-v1')::text, false);
select t.must_equal($$select status from public.data_packages$$, 'ready', 'B: package registered after DB re-check');
select t.must_fail($$select public.register_data_package(current_setting('t.ship')::uuid, '{}', repeat('a',64), 'evil/pkg.zip', 'v1')$$,
                   'shipment folder', 'B: package path must live under shipment folder');
select t.must_fail($$insert into public.data_packages (org_id, shipment_id, storage_path, sha256, rules_engine_version, rules_passed)
                      values (current_setting('t.orga')::uuid, current_setting('t.ship')::uuid, 'x', repeat('b',64), 'v', true)$$,
                   'permission denied', 'B: clients cannot insert packages directly');

select t.must_fail($$select public.share_data_package(current_setting('t.pkg')::uuid,
                      'dddddddd-0000-0000-0000-000000000004', gen_random_uuid(), 'idem-key-0001')$$,
                   'no active consent', 'B: share blocked without consent');

insert into public.data_consents (org_id, counterparty_kind, counterparty_id, purpose, scopes, consent_text_version, expires_at)
values (current_setting('t.orga')::uuid, 'factoring_partner', 'dddddddd-0000-0000-0000-000000000004',
        'Share validated export package with partner for financing quote', array['share_package'], 'v1', now() + interval '90 days');
select set_config('t.consent', (select id::text from public.data_consents), false);

select set_config('t.share', public.share_data_package(current_setting('t.pkg')::uuid,
        'dddddddd-0000-0000-0000-000000000004', current_setting('t.consent')::uuid, 'idem-key-0001')::text, false);
select t.must_equal($$select status from public.package_shares$$, 'pending', 'B: share created with live consent');
select t.must_equal($$select public.share_data_package(current_setting('t.pkg')::uuid,
        'dddddddd-0000-0000-0000-000000000004', current_setting('t.consent')::uuid, 'idem-key-0001')::text = current_setting('t.share')$$,
        'true', 'B: share is idempotent');

update public.data_consents set revoked_at = now(), revoked_by = 'aaaaaaaa-0000-0000-0000-000000000001';
select t.must_equal($$select status from public.package_shares$$, 'expired', 'B: revoking consent expires undelivered shares');
select t.must_fail($$update public.data_consents set scopes = array['everything']$$, 'permission denied|immutable', 'B: consent scopes cannot be edited after grant');
select t.must_equal($$select count(*)::text from public.consent_events$$, '2', 'B: consent ledger has granted + revoked');

-- ---------- C. bank data is owner-only ------------------------------------
reset role;
insert into public.data_consents (org_id, granted_by, counterparty_kind, counterparty_id, purpose, scopes, consent_text_version, expires_at)
values (current_setting('t.orga')::uuid, 'aaaaaaaa-0000-0000-0000-000000000001', 'bank_open_finance', 'BANK-X',
        'Read account balances and transactions to reconcile IVA refund deposits', array['accounts.read','transactions.read'], 'v1', now() + interval '90 days');
insert into public.bank_connections (org_id, consent_id, provider, institution_code, vault_secret_id)
select org_id, id, 'sfa_cl', 'BANK-X', gen_random_uuid() from public.data_consents where counterparty_kind = 'bank_open_finance';

select t.as_user('cccccccc-0000-0000-0000-000000000003');   -- viewer
select t.must_equal($$select count(*)::text from public.bank_connections$$, '0', 'C: viewer cannot see bank connections');
select t.as_user('aaaaaaaa-0000-0000-0000-000000000001');   -- owner
select t.must_equal($$select count(*)::text from public.bank_connections$$, '1', 'C: owner can see bank connections');
select t.must_fail($$select vault_secret_id from public.bank_connections$$, 'permission denied', 'C: vault_secret_id never exposed');

-- ---------- LatAm (0005) ----------------------------------------------------
reset role;
select t.must_fail($$update public.organizations set country = 'CO' where id = current_setting('t.orga')::uuid$$,
                   'not enabled', 'LatAm: inactive country cannot be selected');
update public.tax_jurisdictions set active = true where country = 'CO';      -- after verification
select t.must_fail($$update public.organizations set country = 'CO', tax_id = '12-3' where id = current_setting('t.orga')::uuid$$,
                   'invalid NIT', 'LatAm: NIT format validated');
update public.organizations set country = 'CO', tax_id = '900123456-7' where id = current_setting('t.orgb')::uuid;
select t.must_equal($$select local_currency from public.organizations where id = current_setting('t.orgb')::uuid$$, 'COP', 'LatAm: org currency follows country');

select t.as_user('bbbbbbbb-0000-0000-0000-000000000002');
insert into public.shipments (org_id, reference, buyer, destination, invoice_amount, currency, input_vat_local)
values (current_setting('t.orgb')::uuid, 'EXP-CO-1', 'Miami Importers', 'USA', 10000, 'USD', 4200000);
select t.must_equal($$select local_currency || '/' || tax_authority || '/' || local_form_code from public.iva_claims$$, 'COP/DIAN/F010', 'LatAm: claim stamped with COP / DIAN / F010');
select t.must_equal($$select missing_docs::text from public.iva_claims$$, '{DEX,"Commercial invoice"}', 'LatAm: required docs are invoice + DEX');
select t.must_equal($$select coalesce(amount_clp::text, 'null') from public.iva_claims$$, 'null', 'LatAm: amount_clp compat column is null for non-CLP claims');
select t.must_equal($$select amount_local::text from public.iva_claims$$, '4200000', 'LatAm: amount_local carries the COP amount');

reset role;
rollback;
select 'ALL CHECKS PASSED (transaction rolled back)' as result;
