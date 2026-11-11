"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/form-state";

export async function login(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !password
  ) {
    return { error: "Enter your email and password.", success: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    return { error: "Sign-in failed. Check your email and password.", success: null };
  }

  const { data: isAdmin, error: adminError } =
    await supabase.rpc("is_admin");

  if (adminError) {
    throw new Error(`Unable to verify admin access: ${adminError.message}`);
  }

  if (!isAdmin) {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      throw new Error(`Unable to end the non-admin session: ${signOutError.message}`);
    }

    return {
      error: "This account does not have admin access.",
      success: null,
    };
  }

  redirect("/admin/events");
}

export async function requestPasswordReset(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = formData.get("email");

  if (typeof email !== "string" || !email.trim()) {
    return { error: "Enter your email address.", success: null };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    throw new Error("Missing NEXT_PUBLIC_SITE_URL.");
  }

  let redirectTo: string;
  try {
    const baseUrl = new URL(siteUrl);
    if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
      throw new Error("The site URL must use http or https.");
    }
    redirectTo = new URL(
      "/auth/confirm?next=%2Fadmin%2Fset-password",
      baseUrl,
    ).toString();
  } catch (error) {
    throw new Error(
      `Invalid NEXT_PUBLIC_SITE_URL: ${error instanceof Error ? error.message : "invalid URL"}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo,
  });

  if (error) {
    throw new Error(`Unable to send password setup email: ${error.message}`);
  }

  return {
    error: null,
    success:
      "If an account exists for that email, a password setup link has been sent.",
  };
}

export async function updatePassword(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const password = formData.get("password");
  const confirmation = formData.get("confirmation");

  if (typeof password !== "string" || typeof confirmation !== "string") {
    return { error: "Enter and confirm your new password.", success: null };
  }
  if (password.length < 12) {
    return {
      error: "Choose a password with at least 12 characters.",
      success: null,
    };
  }
  if (password !== confirmation) {
    return { error: "The passwords do not match.", success: null };
  }

  const supabase = await createClient();
  const { data, error: userError } = await supabase.auth.getUser();

  if (userError && userError.name !== "AuthSessionMissingError") {
    throw new Error(`Unable to verify the current user: ${userError.message}`);
  }
  if (!data.user) {
    return {
      error: "Your password setup link is invalid or expired. Request a new one.",
      success: null,
    };
  }

  const { data: isAdmin, error: adminError } =
    await supabase.rpc("is_admin");

  if (adminError) {
    throw new Error(`Unable to verify admin access: ${adminError.message}`);
  }
  if (!isAdmin) {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      throw new Error(`Unable to end the non-admin session: ${signOutError.message}`);
    }
    return { error: "This account does not have admin access.", success: null };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    throw new Error(`Unable to update password: ${error.message}`);
  }

  redirect("/admin/events");
}

export async function logout() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(`Unable to sign out: ${error.message}`);
  }

  redirect("/admin/login");
}
