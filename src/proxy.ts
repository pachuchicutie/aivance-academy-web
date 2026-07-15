import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/client";

/**
 * Refreshes the Supabase auth session cookies and gates the student portal:
 * unauthenticated visitors are sent to /portal/login, and signed-in students
 * skip the login page. Route/layout code re-checks auth server-side; this
 * exists for session refresh and fast redirects, not as the only guard.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLoginRoute = path === "/portal/login";
  const isPortalPage = path.startsWith("/portal") && !isLoginRoute;

  const withSessionCookies = (redirect: NextResponse) => {
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  };

  if (!user && isPortalPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/portal/login";
    redirectUrl.search = "";
    return withSessionCookies(NextResponse.redirect(redirectUrl));
  }

  if (user && isLoginRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/portal";
    redirectUrl.search = "";
    return withSessionCookies(NextResponse.redirect(redirectUrl));
  }

  return response;
}

export const config = {
  matcher: ["/portal/:path*", "/api/portal/:path*"],
};
