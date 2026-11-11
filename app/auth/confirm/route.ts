import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const requestedNext = request.nextUrl.searchParams.get("next");
  const nextPath =
    requestedNext === "/admin/set-password" ? requestedNext : "/admin/login";

  if (!code && (!tokenHash || (type !== "recovery" && type !== "invite"))) {
    return NextResponse.redirect(
      new URL("/admin/login?auth=invalid-link", request.url),
    );
  }

  const supabase = await createClient();
  let error;

  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && (type === "recovery" || type === "invite")) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else {
    return NextResponse.redirect(
      new URL("/admin/login?auth=invalid-link", request.url),
    );
  }

  if (error) {
    return NextResponse.redirect(
      new URL("/admin/login?auth=invalid-link", request.url),
    );
  }

  return NextResponse.redirect(new URL(nextPath, request.url));
}
