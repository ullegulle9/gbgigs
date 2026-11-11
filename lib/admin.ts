import { createClient } from "@/lib/supabase/server";

export async function requireAdmin() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error && error.name !== "AuthSessionMissingError") {
    throw new Error(`Unable to verify the current user: ${error.message}`);
  }

  if (!data.user) {
    return null;
  }

  const { data: isAdmin, error: adminError } =
    await supabase.rpc("is_admin");

  if (adminError) {
    throw new Error(`Unable to verify admin access: ${adminError.message}`);
  }

  return isAdmin ? supabase : null;
}
