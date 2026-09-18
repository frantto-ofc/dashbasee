import { redirect } from "next/navigation";
import Dashboard from "./dashboard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <Dashboard
      user={{
        id: user.id,
        email: user.email ?? "Conta",
        fullName: user.user_metadata.full_name,
        businessName: user.user_metadata.business_name,
        phone: user.user_metadata.phone,
        avatarUrl: user.user_metadata.avatar_url,
      }}
    />
  );
}
