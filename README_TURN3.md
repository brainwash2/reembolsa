# Reembolsa - dynamic ingestion + live data + MCP (turn 3)

## Install
    npm i mcp-handler@^2 @modelcontextprotocol/server@^2 zod@^4        # Node 20+
    cp .env.example .env.local   # add SUPABASE_SERVICE_ROLE_KEY (server only) for validation + PAT tokens
Apply migrations in order: 0003, 0004, 0005, 0006, 0007 (0005/0006 are the corrected versions; safe over the old ones).
Copy files over your project (same paths). `actions/shipments.ts` is kept but no longer used by the UI.

## Free no-key data sources (see lib/api-client.ts)
| Need | Source | Fallback |
|---|---|---|
| USD/EUR -> CLP (live + dated) | Frankfurter v2 (CLP from Banco Central de Chile; also COP/PEN) | mindicador.cl, open.er-api.com (latest only, attribution) |
| UF, UTM, dolar observado | mindicador.cl (Banco Central) | findic.cl |
| RUT validation | local modulo-11 (lib/rut.ts) - no API exists | - |
| Dolar aduanero | NO free JSON API found; not faked (dashboard shows only what is verifiable) | - |

## Honest limits
* "Sync with SII" is a LABELLED SIMULATION (lib/sii-demo.ts, source='sii_demo', "Demo" badge). A real SII feed needs the taxpayer's credentials/certificate or an accredited intermediary.
* Providers were not probed live from the build sandbox (network allow-list); logic was tested against stub servers using the documented response shapes. Verify mindicador/findic shapes once with curl.
* PAT/MCP path tested end to end against stubs + real Postgres functions, not against a real Supabase project. OAuth (JWT) path needs Supabase OAuth 2.1 server enabled; check the `client_id` claim name on a real token.
* "Refund = filing + 45 days" is a planning assumption (REFUND_ETA_DAYS), not an SII deadline.
