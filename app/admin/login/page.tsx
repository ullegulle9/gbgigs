import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import LoginForm from "@/app/admin/login/login-form";
import { createClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; auth?: string }>;
};

async function AdminLoginContent({
  searchParams,
}: LoginPageProps) {
  await connection();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error && error.name !== "AuthSessionMissingError") {
    throw new Error(`Unable to verify the current user: ${error.message}`);
  }

  if (data.user) {
    const { data: isAdmin, error: adminError } =
      await supabase.rpc("is_admin");

    if (adminError) {
      throw new Error(`Unable to verify admin access: ${adminError.message}`);
    }

    if (isAdmin) {
      return (
        <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
          <h1 className="mb-2 text-3xl font-semibold">You’re signed in</h1>
          <p className="mb-8 text-zinc-600">
            Your account has admin access.
          </p>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-zinc-900 px-4 py-2 font-medium text-white"
            href="/admin/events"
          >
            Go to event admin
          </Link>
        </main>
      );
    }
  }

  const { error: queryError, auth: authError } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <h1 className="mb-2 text-3xl font-semibold">Admin sign in</h1>
      <p className="mb-8 text-zinc-600">
        Sign in with an account invited by the site administrator.
      </p>
      {queryError === "not-admin" && (
        <p className="mb-5 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This account does not have admin access.
        </p>
      )}
      {authError === "invalid-link" && (
        <p className="mb-5 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
          That password setup link is invalid or has expired. Request a new one.
        </p>
      )}
      <LoginForm />
    </main>
  );
}

function AdminLoginLoading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <p className="text-sm text-zinc-600">Loading sign in...</p>
    </main>
  );
}

export default function AdminLoginPage({ searchParams }: LoginPageProps) {
  return (
    <Suspense fallback={<AdminLoginLoading />}>
      <AdminLoginContent searchParams={searchParams} />
    </Suspense>
  );
}
