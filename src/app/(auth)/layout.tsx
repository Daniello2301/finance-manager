import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-dvh flex-1 items-center justify-center bg-muted/30 p-4 sm:p-6">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
