import { protectedResourceHandler, metadataCorsOptionsRequestHandler } from "mcp-handler"

// RFC 9728 metadata so MCP clients (Claude connectors) discover Supabase Auth as the authorization server.
// Requires Supabase "OAuth 2.1 server" enabled; issuer = https://<project-ref>.supabase.co/auth/v1
const handler = protectedResourceHandler({
  authServerUrls: [`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`],
})

const options = metadataCorsOptionsRequestHandler()

export { handler as GET, options as OPTIONS }
