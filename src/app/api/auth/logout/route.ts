import { NextResponse } from "next/server";

const SESSION_COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

/**
 * JWT session strategy keeps no server-side session record — the cookie
 * itself IS the session, so logging out is just clearing it. Idempotent
 * even without an active session, so the frontend can call this
 * unconditionally on logout without checking session state first.
 */
export async function POST() {
  const response = NextResponse.json({ success: true }, { status: 200 });
  for (const name of SESSION_COOKIE_NAMES) {
    response.cookies.set(name, "", { maxAge: 0, path: "/" });
  }
  return response;
}
