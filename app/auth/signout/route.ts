import { isSupabaseConfigured } from "@/lib/supabase/config";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (!origin || origin !== siteOrigin) {
    return new NextResponse("Origem inválida", { status: 403 });
  }
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return new NextResponse("Não foi possível sair. Tente novamente.", { status: 503 });
  }
  revalidatePath("/", "layout");
  const response = NextResponse.redirect(new URL("/login", siteOrigin), { status: 303 });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
