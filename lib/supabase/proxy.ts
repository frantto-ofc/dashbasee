import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig, isSupabaseConfigured } from "./config";

const redirectWithCookies = (url: URL, response: NextResponse) => {
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  redirect.headers.set("Cache-Control", "private, no-store");
  return redirect;
};

export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.next({ request });

  // Some OAuth providers can fall back to the configured Site URL. Route the
  // one-time PKCE code through the callback before checking authentication.
  if (request.nextUrl.pathname === "/" && request.nextUrl.searchParams.has("code")) {
    const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
    const callbackUrl = new URL("/auth/callback", siteOrigin);
    callbackUrl.searchParams.set("code", request.nextUrl.searchParams.get("code")!);
    callbackUrl.searchParams.set("next", "/");
    return NextResponse.redirect(callbackUrl);
  }

  const { url, publishableKey } = getSupabaseConfig();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const pathname = request.nextUrl.pathname;
  const isPublicAuthRoute =
    pathname === "/login" ||
    pathname === "/privacidade" ||
    pathname === "/termos" ||
    pathname.startsWith("/auth/");

  if (!signedIn && !isPublicAuthRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return redirectWithCookies(loginUrl, response);
  }

  if (signedIn && pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return redirectWithCookies(homeUrl, response);
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
