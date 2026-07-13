import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

/**
 * Server-side gate: redirects before anything renders, so an
 * unauthenticated visitor never sees a flash of protected content and no
 * client JS is needed for the check itself.
 */
export async function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return <>{children}</>;
}
