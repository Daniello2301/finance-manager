import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/lib/validation/auth";
import { verifyCredentials } from "@/lib/auth/verifyCredentials";

const INVALID_CREDENTIALS_MESSAGE =
  "Correo electrónico o contraseña inválidos";

/**
 * Thin validation endpoint — does NOT set the session cookie itself. The
 * frontend calls NextAuth's signIn('credentials', ...) against
 * /api/auth/[...nextauth] right after a 200 here, which is what actually
 * issues the cookie via the adapter's own session-creation pipeline.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const { email, password } = parsed.data;
  const user = await verifyCredentials(email, password);

  if (!user) {
    return NextResponse.json(
      { error: INVALID_CREDENTIALS_MESSAGE },
      { status: 401 }
    );
  }

  return NextResponse.json({ success: true, user }, { status: 200 });
}
