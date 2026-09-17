import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { safeNextPath } from "@/lib/supabase/redirect";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  const redirect = (path: string) => {
    const response = NextResponse.redirect(new URL(path, siteOrigin));
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };

  // Never render provider error descriptions or forward untrusted destinations.
  if (url.searchParams.has("error")) {
    return redirect(url.searchParams.get("error") === "access_denied"
      ? "/login?error=google_cancelled"
      : "/login?error=google");
  }
  const code = url.searchParams.get("code");
  if (!code || !isSupabaseConfigured()) return redirect("/login?error=google");

  try {
    const supabase = await createClient();
    // SSR client verifies the PKCE code and persists the session in cookies.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return redirect("/login?error=google");
    return redirect(safeNextPath(url.searchParams.get("next")));
  } catch {
    return redirect("/login?error=google");
  }
}
