"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/app/admin/login/actions";
import { emptyFormState } from "@/lib/form-state";

export default function ResetPasswordForm() {
  const [state, action, pending] = useActionState(
    requestPasswordReset,
    emptyFormState,
  );

  return (
    <form action={action} className="space-y-5">
      {state.error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800" role="status">
          {state.success}
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
      <button
        className="w-full rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Sending..." : "Send password setup link"}
      </button>
    </form>
  );
}
