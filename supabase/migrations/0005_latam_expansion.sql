-- =====================================================================
-- 0005_latam_expansion.sql   (REWRITTEN - no generated columns)
--
-- Adds country + tax_id_type to organizations and a jurisdiction table.
-- Chile (SII) stays the default; Colombia (DIAN) and Peru (SUNAT) are
-- modelled but INACTIVE until verified against official sources.
--
-- Why the rewrite: the first version renamed iva_claims.amount_clp and
-- re-created it as GENERATED ALWAYS. A generated column cannot be written,
-- so every client / trigger / grant that did UPDATE ... SET amount_clp
-- failed, and the column-level GRANT from 0003 no longer matched.
-- Now amount_clp stays an ordinary column (0003 grants, triggers and the
-- UI keep working untouched) and amount_local is a second ordinary column,
-- kept consistent by ONE trigger.
--
-- Idempotent + upgrade-safe: runs on a fresh chain (0001-0004) and on a
-- database that already applied the first 0005.
-- Apply AFTER 0003/0004.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Jurisdiction reference data (read-only for clients)
-- ---------------------------------------------------------------------
create table if not exists public.tax_jurisdictions (
  country                       char(2) primary key check (country ~ '^[A-Z]{2}$'),
  name                          text    not null,
  tax_authority                 text    not null,          -- SII | DIAN | SUNAT
  vat_name                      text    not null,          -- IVA | IVA | IGV
  standard_vat_rate             numeric(5,2) not null,
  local_currency                char(3) not null,
  vat_return_form_code          text    not null,
  refund_form_code              text    not null,
  refund_form_name              text    not null,
  org_tax_id_type               text    not null,          -- RUT | NIT | RUC
  org_tax_id_pattern            text    not null,          -- FORMAT only; check digit = rules engine
  required_doc_types            text[]  not null,
  refund_filing_deadline_months int,                       -- NULL = not yet sourced
  data_protection_law           text    not null,
  breach_notification_hours     int,                       -- NULL = not yet sourced
  active                        boolean not null default false,
  needs_verification            boolean not null default true,
  source_note                   text,
  created_at                    timestamptz not null default now()
);

alter table public.tax_jurisdictions enable row level security;
drop policy if exists jurisdictions_read on public.tax_jurisdictions;
create policy jurisdictions_read on public.tax_jurisdictions for select to authenticated using (true);
revoke all on public.tax_jurisdictions from anon, authenticated;
grant  select on public.tax_jurisdictions to authenticated;

insert into public.tax_jurisdictions
  (country, name, tax_authority, vat_name, standard_vat_rate, local_currency,
   vat_return_form_code, refund_form_code, refund_form_name,
   org_tax_id_type, org_tax_id_pattern, required_doc_types,
   refund_filing_deadline_months, data_protection_law, breach_notification_hours,
   active, needs_verification, source_note)
values
  ('CL','Chile','SII','IVA',19.00,'CLP',
   'F29','F3600','Formulario 3600 (IVA exportador)',
   'RUT','^[0-9]{7,8}-[0-9Kk]$', array['invoice','dus'],
   null,'Ley 21.719 (entry into force pending - verify)', null,
   true,false,'Per project docs.'),
  ('CO','Colombia','DIAN','IVA',19.00,'COP',
   'F300','F010','Solicitud de devolución y/o compensación (Formulario 010)',
   'NIT','^[0-9]{6,10}-?[0-9]$', array['invoice','dex'],
   24,'Ley 1581 de 2012', null,
   false,true,'Confirm form codes and the 24-month window on dian.gov.co before activating.'),
  ('PE','Peru','SUNAT','IGV',18.00,'PEN',
   'PDT621','F1649','Formulario Virtual 1649 (solicitud de devolución - saldo a favor del exportador)',
   'RUC','^[0-9]{11}$', array['invoice','dam'],
   null,'Ley 29733 + DS 016-2024-JUS', 48,
   false,true,'Confirm form code, FOB cap and the 48h breach rule on sunat.gob.pe before activating.')
on conflict (country) do nothing;          -- never overwrites an `active` flag someone already flipped

-- ---------------------------------------------------------------------
-- 2. organizations: country + tax_id_type (+ generic tax_id, currency)
--    Plain columns. `rut` is kept for backwards compatibility.
-- ---------------------------------------------------------------------
alter table public.organizations
  add column if not exists country        char(2) not null default 'CL' references public.tax_jurisdictions(country),
  add column if not exists tax_id_type    text,
  add column if not exists tax_id         text,
  add column if not exists local_currency char(3);

update public.organizations o
   set tax_id         = coalesce(o.tax_id, o.rut),
       tax_id_type    = j.org_tax_id_type,
       local_currency = j.local_currency
  from public.tax_jurisdictions j
 where j.country = o.country
   and (o.tax_id_type is null or o.local_currency is null or (o.tax_id is null and o.rut is not null));

create or replace function public.validate_org_country_tax_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.tax_jurisdictions;
begin
  select * into j from public.tax_jurisdictions where country = new.country;
  if not found or not j.active then
    raise exception 'country % is not enabled yet', new.country using errcode = '22023';
  end if;
  new.tax_id_type    := j.org_tax_id_type;
  new.local_currency := j.local_currency;
  if new.tax_id is not null and new.tax_id !~ j.org_tax_id_pattern then
    raise exception 'invalid % format', j.org_tax_id_type using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists organizations_country_tax_id on public.organizations;
create trigger organizations_country_tax_id
  before insert or update of country, tax_id on public.organizations
  for each row execute function public.validate_org_country_tax_id();

-- signup may pass options.data.country; unknown / inactive values fall back to CL
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name    text;
  v_country text;
  v_org     uuid;
begin
  v_name := left(btrim(coalesce(new.raw_user_meta_data ->> 'company_name', '')), 120);
  if length(v_name) < 2 then v_name := 'My Company'; end if;

  select j.country into v_country
    from public.tax_jurisdictions j
   where j.country = upper(coalesce(new.raw_user_meta_data ->> 'country', 'CL')) and j.active;
  v_country := coalesce(v_country, 'CL');

  insert into public.organizations (name, country) values (v_name, v_country) returning id into v_org;
  insert into public.org_members (org_id, user_id, role) values (v_org, new.id, 'owner');
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. shipments: stamp the export country from the org (never from the client)
-- ---------------------------------------------------------------------
alter table public.shipments
  add column if not exists export_country     char(2),
  add column if not exists buyer_tax_id_type  text check (buyer_tax_id_type in ('RUT','NIT','RUC','RFC','VAT','EIN','OTHER')),
  add column if not exists export_value_local bigint check (export_value_local >= 0);

update public.shipments s
   set export_country     = coalesce(s.export_country, o.country),
       export_value_local = coalesce(s.export_value_local, s.export_value_clp)
  from public.organizations o
 where o.id = s.org_id
   and (s.export_country is null or s.export_value_local is null);

create or replace function public.stamp_shipment_country()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select o.country into new.export_country from public.organizations o where o.id = new.org_id;
  if new.export_value_local is null and new.export_country = 'CL' then
    new.export_value_local := new.export_value_clp;
  end if;
  return new;
end;
$$;
drop trigger if exists shipments_stamp_country on public.shipments;
create trigger shipments_stamp_country
  before insert on public.shipments
  for each row execute function public.stamp_shipment_country();

-- ---------------------------------------------------------------------
-- 4. documents: local customs declaration types (DEX = CO, DAM = PE)
-- ---------------------------------------------------------------------
alter table public.documents drop constraint if exists documents_type_check;
alter table public.documents
  add constraint documents_type_check check (type in ('invoice','dus','dex','dam'));

-- ---------------------------------------------------------------------
-- 5. iva_claims: amounts in local currency WITHOUT generated columns
--      amount_clp   plain column, kept for the Chile UI / 0003 grants (0 for non-CLP claims)
--      amount_local plain column, the amount in local_currency
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_attribute
              where attrelid = 'public.iva_claims'::regclass and attname = 'amount_clp'
                and attgenerated <> '' and not attisdropped) then
    -- UPGRADE: database already ran the first 0005 (amount_clp was GENERATED). Replace it by a plain column.
    alter table public.iva_claims drop column amount_clp;
    alter table public.iva_claims add column amount_clp bigint not null default 0 check (amount_clp >= 0);
    update public.iva_claims
       set amount_clp = case when local_currency = 'CLP' then coalesce(amount_local, 0) else 0 end;
  elsif not exists (select 1 from pg_attribute
                     where attrelid = 'public.iva_claims'::regclass and attname = 'amount_local' and not attisdropped) then
    -- FRESH: only amount_clp exists
    alter table public.iva_claims add column amount_local bigint not null default 0 check (amount_local >= 0);
    update public.iva_claims set amount_local = amount_clp;
  end if;
end $$;

alter table public.iva_claims
  add column if not exists local_currency   char(3) not null default 'CLP',
  add column if not exists tax_authority    text,
  add column if not exists local_form_code  text,
  add column if not exists filing_reference text;       -- SII folio | DIAN radicado | SUNAT n° de orden

update public.iva_claims c
   set tax_authority = j.tax_authority, local_form_code = j.refund_form_code, local_currency = j.local_currency
  from public.organizations o
  join public.tax_jurisdictions j on j.country = o.country
 where o.id = c.org_id and (c.tax_authority is null or c.local_form_code is null);

-- One trigger stamps jurisdiction (INSERT) and keeps the two amount columns consistent.
--   CLP claim  : whichever of amount_clp / amount_local the writer changed wins; both end equal.
--   other      : amount_local is authoritative, amount_clp is forced to 0 (never mixes currencies).
create or replace function public.iva_claims_normalize()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    select j.local_currency, j.tax_authority, j.refund_form_code
      into new.local_currency, new.tax_authority, new.local_form_code
      from public.organizations o
      join public.tax_jurisdictions j on j.country = o.country
     where o.id = new.org_id;
  end if;

  if new.local_currency = 'CLP' then
    if tg_op = 'UPDATE'
       and new.amount_local is distinct from old.amount_local
       and new.amount_clp   is not distinct from old.amount_clp then
      new.amount_clp := new.amount_local;
    else
      new.amount_local := new.amount_clp;
    end if;
  else
    new.amount_clp := 0;
  end if;
  return new;
end;
$$;
drop trigger if exists iva_claims_stamp_jurisdiction on public.iva_claims;   -- first-version trigger
drop trigger if exists iva_claims_normalize on public.iva_claims;
create trigger iva_claims_normalize
  before insert or update on public.iva_claims
  for each row execute function public.iva_claims_normalize();

-- Clients: same column grants as 0003 plus the new plain columns. Status stays gated by enforce_claim_gate.
revoke update on public.iva_claims from authenticated;
grant  update (status, amount_clp, amount_local, filing_reference) on public.iva_claims to authenticated;

-- ---------------------------------------------------------------------
-- 6. Redefine the 0003 functions that referenced amount_clp / hard-coded docs
-- ---------------------------------------------------------------------
create or replace function public.doc_label(p_type text)
returns text language sql immutable set search_path = '' as $$
  select case p_type
           when 'invoice' then 'Commercial invoice'
           when 'dus'     then 'DUS'
           when 'dex'     then 'DEX'
           when 'dam'     then 'DAM'
           else p_type end;
$$;

create or replace function public.missing_docs_for(p_shipment uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(public.doc_label(t) order by t), '{}')
    from public.shipments s
    join public.organizations o on o.id = s.org_id
    join public.tax_jurisdictions j on j.country = o.country
    cross join lateral unnest(j.required_doc_types) as t
   where s.id = p_shipment
     and not exists (select 1 from public.documents d
                      where d.shipment_id = s.id and d.type = t and d.validated);
$$;
revoke execute on function public.missing_docs_for(uuid), public.doc_label(text) from public, anon;

create or replace function public.sync_claim_from_shipment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.iva_claims (org_id, shipment_id, amount_clp, amount_local, missing_docs)
    values (new.org_id, new.id, coalesce(new.input_vat_local, 0), coalesce(new.input_vat_local, 0),
            public.missing_docs_for(new.id))
    on conflict (shipment_id) do nothing;
  else
    update public.iva_claims
       set amount_clp = coalesce(new.input_vat_local, 0), amount_local = coalesce(new.input_vat_local, 0)
     where shipment_id = new.id
       and status in ('draft','ready')
       and amount_local is distinct from coalesce(new.input_vat_local, 0);
  end if;
  return null;
end;
$$;

create or replace function public.sync_missing_docs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ship uuid := coalesce(new.shipment_id, old.shipment_id);
begin
  update public.iva_claims
     set missing_docs = public.missing_docs_for(v_ship)
   where shipment_id = v_ship and status in ('draft','ready');

  update public.iva_claims
     set status = 'draft'
   where shipment_id = v_ship and status = 'ready' and cardinality(missing_docs) > 0;
  return null;
end;
$$;

update public.iva_claims c set missing_docs = public.missing_docs_for(c.shipment_id)
 where c.status in ('draft','ready');

create index if not exists organizations_country_idx on public.organizations (country);
