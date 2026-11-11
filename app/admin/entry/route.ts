import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error && error.name !== "AuthSessionMissingError") {
    throw new Error(`Unable to verify the current user: ${error.message}`);
  }

  if (!data.user) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const { data: isAdmin, error: adminError } =
    await supabase.rpc("is_admin");

  if (adminError) {
    throw new Error(`Unable to verify admin access: ${adminError.message}`);
  }

  return NextResponse.redirect(
    new URL(isAdmin ? "/admin/events" : "/admin/login?error=not-admin", request.url),
  );
}
