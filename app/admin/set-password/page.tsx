import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import PasswordForm from "@/app/admin/set-password/password-form";
import { createClient } from "@/lib/supabase/server";

export default async function SetPasswordPage() {
  await connection();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error && error.name !== "AuthSessionMissingError") {
    throw new Error(`Unable to verify the current user: ${error.message}`);
  }
  if (!data.user) {
    redirect("/admin/login?auth=invalid-link");
  }

  const { data: isAdmin, error: adminError } =
    await supabase.rpc("is_admin");

  if (adminError) {
    throw new Error(`Unable to verify admin access: ${adminError.message}`);
  }
  if (!isAdmin) {
    redirect("/admin/login?error=not-admin");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <h1 className="mb-2 text-3xl font-semibold">Set your password</h1>
      <p className="mb-8 text-zinc-600">
        Choose a password with at least 12 characters.
      </p>
      <PasswordForm />
      <Link
        className="mt-6 text-sm font-medium underline underline-offset-4"
        href="/admin/login"
      >
        Back to sign in
      </Link>
    </main>
  );
}
