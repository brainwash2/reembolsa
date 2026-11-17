# Reembolsa - turn 4 (mobile + Financial OS)

Copy every file over the same path in your repo. Then, in this order:

1. **Vercel env var (this is why your dashboard showed 0 filed / all draft):**
   add `SUPABASE_SERVICE_ROLE_KEY` (Supabase > Project Settings > API > service_role). No `NEXT_PUBLIC_` prefix. Redeploy.
2. **Supabase SQL editor:** run `0006` and `0007` if not yet applied, then `supabase/migrations/0008_buyer_verification.sql`.
3. Open **Cash flow** (the dashboard). The amber banner has a **Run checks now** button: it runs the rules engine on the 10 already-synced shipments. Nothing is re-imported.
4. Optional: `supabase/tests/rls_buyer.sql` (RLS checks for 0008) and `node --experimental-strip-types tests/cashflow.test.mts` / `tests/buyer.test.mts`.

## What is new
- Mobile: hamburger Sheet, cards below `md`, tables scroll inside their box. Touch targets fixed: the project is on Tailwind 3.3, where `min-h-11` does not exist, so the earlier zip had no 44px targets; now `min-h-[44px]`.
- **Cash flow** dashboard: locked / arriving in 30 days / ready to file / stuck by a failed check, a month-by-month refund calendar (plain HTML/CSS, no chart library), alerts, dated "money arriving" list.
- **Financing** page: advance simulator on filed claims (illustrative, not an offer) and a lender CSV export (`/api/export/claims`).
- **Buyer verification** on a real shipment page: VIES (EU) and the Norwegian business register; result stored as evidence (informational, never a claim gate).
- `shipments/[id]` is now real (was mock): claim stepper, rules-engine checks, issues, FX provenance.
- MCP: 3 new read-only tools: `get_cashflow_forecast`, `get_alerts`, `get_financing_estimate`.
- Landing copy no longer promises AI verdicts or one-click Form 3600 filing (the product does neither).

## Not verified here
- Live VIES / Norwegian register calls (sandbox cannot reach them; logic is unit-tested with mocked responses; any failure is shown as "unavailable", never "invalid").
- The pages against your real Supabase (tested against a fake client, plus a local Postgres for migrations 0001-0008 and the 0008 RLS checks).
- `components/cashflow-chart.tsx` (Recharts) is no longer used; you may delete it.
