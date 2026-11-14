create or replace function public.is_org_member(_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.org_members m where m.org_id = _org and m.user_id = (select auth.uid()));
$$;

create or replace function public.has_org_role(_org uuid, _roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.org_members m where m.org_id = _org and m.user_id = (select auth.uid()) and m.role = any(_roles));
$$;

alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.shipments enable row level security;
alter table public.documents enable row level security;
alter table public.iva_claims enable row level security;
alter table public.issues enable row level security;

create policy org_select on public.organizations for select to authenticated using (public.is_org_member(id));
create policy org_update on public.organizations for update to authenticated using (public.has_org_role(id, array['owner'])) with check (public.has_org_role(id, array['owner']));

create policy members_select on public.org_members for select to authenticated using (public.is_org_member(org_id));
create policy members_owner_write on public.org_members for all to authenticated using (public.has_org_role(org_id, array['owner'])) with check (public.has_org_role(org_id, array['owner']));

create policy shipments_select on public.shipments for select to authenticated using (public.is_org_member(org_id));
create policy shipments_insert on public.shipments for insert to authenticated with check (public.has_org_role(org_id, array['owner','accountant']) and user_id = (select auth.uid()));
create policy shipments_update on public.shipments for update to authenticated using (public.has_org_role(org_id, array['owner','accountant'])) with check (public.has_org_role(org_id, array['owner','accountant']));
create policy shipments_delete on public.shipments for delete to authenticated using (public.has_org_role(org_id, array['owner']));

create policy documents_select on public.documents for select to authenticated using (public.is_org_member(org_id));
create policy documents_insert on public.documents for insert to authenticated with check (public.has_org_role(org_id, array['owner','accountant']));
create policy documents_update on public.documents for update to authenticated using (public.has_org_role(org_id, array['owner','accountant'])) with check (public.has_org_role(org_id, array['owner','accountant']));
create policy documents_delete on public.documents for delete to authenticated using (public.has_org_role(org_id, array['owner']));

create policy claims_select on public.iva_claims for select to authenticated using (public.is_org_member(org_id));
create policy claims_insert on public.iva_claims for insert to authenticated with check (public.has_org_role(org_id, array['owner','accountant']));
create policy claims_update on public.iva_claims for update to authenticated using (public.has_org_role(org_id, array['owner','accountant'])) with check (public.has_org_role(org_id, array['owner','accountant']));
create policy claims_delete on public.iva_claims for delete to authenticated using (public.has_org_role(org_id, array['owner']));

create policy issues_select on public.issues for select to authenticated using (public.is_org_member(org_id));
create policy issues_insert on public.issues for insert to authenticated with check (public.has_org_role(org_id, array['owner','accountant']));
create policy issues_update on public.issues for update to authenticated using (public.has_org_role(org_id, array['owner','accountant'])) with check (public.has_org_role(org_id, array['owner','accountant']));
create policy issues_delete on public.issues for delete to authenticated using (public.has_org_role(org_id, array['owner','accountant']));
