import { safeNextPath } from "@/lib/supabase/redirect";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin;
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const requestedNext = requestUrl.searchParams.get("next");
  const next = type === "recovery" ? "/update-password" : safeNextPath(requestedNext);
  if (!isSupabaseConfigured()) return NextResponse.redirect(new URL("/login", siteOrigin));
  const supabase = await createClient();

  let error: Error | null = null;
  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error;
  } else if (tokenHash && (type === "signup" || type === "recovery" || type === "email")) {
    const result = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    error = result.error;
  } else {
    error = new Error("Missing confirmation token");
  }

  if (error) {
    const loginUrl = new URL("/login", siteOrigin);
    loginUrl.searchParams.set("error", "confirmation");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(new URL(next, siteOrigin));
}
