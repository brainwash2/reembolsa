-- Note: Assure-toi d'avoir créé un utilisateur via le dashboard Supabase avant de lancer ceci.
-- Remplace 'TON_USER_ID' par l'UUID de ton utilisateur.
DO $$
DECLARE
  v_user_id UUID := 'TON_USER_ID';
  v_org_id UUID;
  v_shipment_id UUID;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('Viña Exportadora SpA') RETURNING id INTO v_org_id;
  INSERT INTO public.org_members (org_id, user_id, role) VALUES (v_org_id, v_user_id, 'owner');

  INSERT INTO public.shipments (org_id, user_id, reference, buyer, destination, incoterm, invoice_amount, currency, status)
  VALUES (v_org_id, v_user_id, 'EXP-2026-001', 'Hamburg Fresh Imports GmbH', 'Germany', 'CIF', 48200, 'EUR', 'validated') RETURNING id INTO v_shipment_id;
  INSERT INTO public.iva_claims (org_id, shipment_id, amount_clp, status) VALUES (v_org_id, v_shipment_id, 7940000, 'filed');
END $$;
