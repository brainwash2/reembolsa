import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Every route that lives behind login. (Before: only /dashboard was actually
// redirected, even though the matcher also listed /shipments and /iva; /settings
// was not matched at all.)
const PROTECTED = ["/dashboard", "/shipments", "/iva", "/settings"]

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  // getUser() validates the JWT with Supabase Auth (getSession() would trust the cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))

  if (!user && isProtected) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  if (user && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return response
}

export const config = {
  matcher: ["/dashboard/:path*", "/shipments/:path*", "/iva/:path*", "/settings/:path*", "/login", "/signup"],
}
