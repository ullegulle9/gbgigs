"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/app/admin/login/actions";
import { emptyFormState } from "@/lib/form-state";

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, emptyFormState);

  return (
    <form action={action} className="space-y-5">
      {state.error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      )}
      <label className="block space-y-2 text-sm font-medium">
        Email
        <input
          autoComplete="email"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 font-normal"
          name="email"
          required
          type="email"
        />
      </label>
      <label className="block space-y-2 text-sm font-medium">
        Password
        <input
          autoComplete="current-password"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 font-normal"
          name="password"
          required
          type="password"
        />
      </label>
      <button
        className="w-full rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
      <Link
        className="block text-center text-sm font-medium underline underline-offset-4"
        href="/admin/login/reset-password"
      >
        Set or reset password
      </Link>
    </form>
  );
}
