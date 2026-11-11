"use client";

import { useActionState } from "react";
import { updatePassword } from "@/app/admin/login/actions";
import { emptyFormState } from "@/lib/form-state";

export default function PasswordForm() {
  const [state, action, pending] = useActionState(
    updatePassword,
    emptyFormState,
  );

  return (
    <form action={action} className="space-y-5">
      {state.error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      )}
      <label className="block space-y-2 text-sm font-medium">
        New password
        <input
          autoComplete="new-password"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 font-normal"
          minLength={12}
          name="password"
          required
          type="password"
        />
      </label>
      <label className="block space-y-2 text-sm font-medium">
        Confirm new password
        <input
          autoComplete="new-password"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 font-normal"
          minLength={12}
          name="confirmation"
          required
          type="password"
        />
      </label>
      <button
        className="w-full rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Saving..." : "Set password"}
      </button>
    </form>
  );
}
