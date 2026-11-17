-- run after 0001..0008 on the stub: buyer_verifications RLS
\set ON_ERROR_STOP 0
set client_min_messages = notice;
do $$
declare a uuid := '00000000-0000-0000-0000-0000000000a1'; b uuid := '00000000-0000-0000-0000-0000000000b1';
        ua uuid := '00000000-0000-0000-0000-00000000aaa1'; uv uuid := '00000000-0000-0000-0000-00000000aaa2'; ub uuid := '00000000-0000-0000-0000-00000000bbb1';
        sa uuid := '00000000-0000-0000-0000-0000000005a1';
        n int;
begin
  insert into auth.users(id) values (ua),(uv),(ub) on conflict do nothing;
  insert into public.organizations(id,name) values (a,'A'),(b,'B') on conflict do nothing;
  insert into public.org_members(org_id,user_id,role) values (a,ua,'owner'),(a,uv,'viewer'),(b,ub,'owner') on conflict do nothing;
  insert into public.shipments(id,org_id,user_id,reference,buyer,destination,invoice_amount,currency) values (sa,a,ua,'R1','Buyer','DE',10,'EUR') on conflict do nothing;

  -- owner of A can insert
  perform set_config('request.jwt.claims', json_build_object('sub',ua,'role','authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.buyer_verifications(org_id,shipment_id,provider,status,country,query,note) values (a,sa,'vies','valid','DE','DE1','ok');
    raise notice 'PASS owner can insert';
  exception when others then raise notice 'FAIL owner insert: %', sqlerrm; end;
  -- cannot forge another user as checker
  begin
    insert into public.buyer_verifications(org_id,shipment_id,provider,status,country,query,note,checked_by) values (a,sa,'vies','valid','DE','DE1','ok',ub);
    raise notice 'FAIL forged checked_by was accepted';
  exception when others then raise notice 'PASS cannot set checked_by (%)', sqlstate; end;
  begin delete from public.buyer_verifications; raise notice 'FAIL delete allowed'; exception when others then raise notice 'PASS no delete'; end;
  begin update public.buyer_verifications set status='invalid'; raise notice 'FAIL update allowed'; exception when others then raise notice 'PASS no update'; end;
  reset role;

  -- viewer cannot insert, but can read
  perform set_config('request.jwt.claims', json_build_object('sub',uv,'role','authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.buyer_verifications(org_id,shipment_id,provider,status,country,query,note) values (a,sa,'vies','valid','DE','DE2','x');
    raise notice 'FAIL viewer inserted';
  exception when others then raise notice 'PASS viewer cannot insert'; end;
  select count(*) into n from public.buyer_verifications; if n = 1 then raise notice 'PASS viewer can read own org (1 row)'; else raise notice 'FAIL viewer sees % rows', n; end if;
  reset role;

  -- other org: sees nothing, cannot insert for org A's shipment
  perform set_config('request.jwt.claims', json_build_object('sub',ub,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.buyer_verifications; if n = 0 then raise notice 'PASS other org sees 0 rows'; else raise notice 'FAIL other org sees %', n; end if;
  begin
    insert into public.buyer_verifications(org_id,shipment_id,provider,status,country,query,note) values (a,sa,'vies','valid','DE','DE3','x');
    raise notice 'FAIL cross-tenant insert';
  exception when others then raise notice 'PASS cross-tenant insert blocked'; end;
  reset role;
end $$;
