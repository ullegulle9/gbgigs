import Link from "next/link";
import ResetPasswordForm from "@/app/admin/login/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <h1 className="mb-2 text-3xl font-semibold">Set or reset password</h1>
      <p className="mb-8 text-zinc-600">
        Enter your invited admin email and we’ll send a one-time password setup
        link.
      </p>
      <ResetPasswordForm />
      <Link
        className="mt-6 text-sm font-medium underline underline-offset-4"
        href="/admin/login"
      >
        Back to sign in
      </Link>
    </main>
  );
}
