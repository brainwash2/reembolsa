-- Demo data for the FIRST owner found. Safe to run repeatedly (skips if the shipment exists).
-- No UUID placeholder to edit any more: sign up in the app first (the signup trigger
-- creates the organization), then run this file in the SQL editor.
do $$
declare
  v_org  uuid;
  v_user uuid;
  v_ship uuid;
begin
  select m.org_id, m.user_id into v_org, v_user
    from public.org_members m
   where m.role = 'owner'
   order by m.created_at
   limit 1;

  if v_org is null then
    raise notice 'seed skipped: no user yet. Sign up first, then re-run.';
    return;
  end if;

  if exists (select 1 from public.shipments where org_id = v_org and reference = 'EXP-2026-001') then
    raise notice 'seed skipped: EXP-2026-001 already exists';
    return;
  end if;

  insert into public.shipments
    (org_id, user_id, reference, buyer, destination, incoterm, invoice_amount, currency, input_vat_local, status)
  values
    (v_org, v_user, 'EXP-2026-001', 'Hamburg Fresh Imports GmbH', 'Germany', 'CIF', 48200, 'EUR', 7940000, 'validated')
  returning id into v_ship;                       -- trigger creates the draft claim (7,940,000)

  -- documents validated "by the rules engine" (this file runs as the DB owner)
  insert into public.documents (org_id, shipment_id, type, file_url, validated) values
    (v_org, v_ship, 'invoice', v_org || '/' || v_ship || '/invoice.pdf', true),
    (v_org, v_ship, 'dus',     v_org || '/' || v_ship || '/dus.pdf',     true);

  -- walk the claim through the real gate: draft -> ready -> filed
  update public.iva_claims set status = 'ready' where shipment_id = v_ship;
  update public.iva_claims set status = 'filed' where shipment_id = v_ship;

  insert into public.shipments
    (org_id, user_id, reference, buyer, destination, incoterm, invoice_amount, currency, input_vat_local, status)
  values
    (v_org, v_user, 'EXP-2026-002', 'Shanghai Cherry Partners Ltd', 'China', 'FOB', 76500, 'USD', 11260000, 'documents_pending'),
    (v_org, v_user, 'EXP-2026-003', 'Miami Berry Distributors LLC',  'United States', 'FOB', 54300, 'USD', 8070000, 'draft');
end $$;
