# Reembolsa fixes - copy over your project (same paths)
1. Files: lib/auth.ts, components/no-org-notice.tsx, components/layout/Topbar.tsx, actions/shipments.ts,
   app/(dashboard)/{dashboard,shipments,iva,settings}/page.tsx, proxy.ts
2. SQL, in order: supabase/migrations/0003 -> 0004 -> 0005 -> 0006 (0003+0004 alone fix the $0 dashboard)
3. Optional: supabase/seed.sql (demo data), supabase/tests/rls_smoke.sql (run on a scratch DB, rolls back)
Full audit + architecture: REEMBOLSA_AUDIT_AND_ARCHITECTURE.md
