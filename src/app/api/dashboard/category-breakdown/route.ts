import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { errorResponse } from "@/lib/errors";
import { categoryBreakdownQuerySchema } from "@/lib/validation/dashboard";
import { getCategoryBreakdown } from "@/lib/services/dashboard";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();

    const parsed = categoryBreakdownQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Parámetros inválidos", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    const breakdown = await getCategoryBreakdown(
      session.user.id,
      parsed.data.period
    );

    return NextResponse.json({ breakdown });
  } catch (error) {
    return errorResponse(error);
  }
}
