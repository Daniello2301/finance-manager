import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UnauthorizedError } from "@/lib/errors";

/**
 * API-route-only guard (never called from service/model code — signup-time
 * flows that need a userId before a session exists take a plain userId
 * parameter instead). Reuses the same getServerSession/authOptions pair as
 * ProtectedRoute.tsx, but throws instead of redirecting.
 */
export async function requireSession(): Promise<Session> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }
  return session;
}
