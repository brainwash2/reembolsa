create extension if not exists pgcrypto;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rut text,
  created_at timestamptz not null default now()
);

create table public.org_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','accountant','viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id),
  reference text not null,
  buyer text not null,
  buyer_tax_id text,
  buyer_country char(2),
  destination text not null,
  incoterm text check (incoterm in ('EXW','FCA','FAS','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP')),
  invoice_amount numeric(14,2) not null check (invoice_amount >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  exchange_rate numeric(14,6),
  exchange_rate_date date,
  exchange_rate_source text,
  export_value_clp bigint,
  shipment_date date,
  status text not null default 'draft' check (status in ('draft','documents_pending','validated','claimed')),
  created_at timestamptz not null default now(),
  unique (org_id, reference),
  unique (id, org_id)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  shipment_id uuid not null,
  type text not null check (type in ('invoice','dus')),
  file_url text not null,
  extracted_data jsonb,
  validated boolean not null default false,
  created_at timestamptz not null default now(),
  unique (shipment_id, type),
  foreign key (shipment_id, org_id) references public.shipments(id, org_id) on delete cascade
);

create table public.iva_claims (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  shipment_id uuid not null,
  amount_clp bigint not null default 0 check (amount_clp >= 0),
  status text not null default 'draft' check (status in ('draft','ready','filed','approved','paid')),
  missing_docs text[] not null default '{}',
  filed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (shipment_id),
  foreign key (shipment_id, org_id) references public.shipments(id, org_id) on delete cascade
);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  shipment_id uuid not null,
  severity text not null check (severity in ('error','warning','info')),
  code text not null,
  message text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (shipment_id, org_id) references public.shipments(id, org_id) on delete cascade
);
