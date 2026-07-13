import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { errorResponse } from "@/lib/errors";
import { trendQuerySchema } from "@/lib/validation/dashboard";
import { getMonthlyTrend } from "@/lib/services/dashboard";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();

    const parsed = trendQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Parámetros inválidos", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    const trend = await getMonthlyTrend(session.user.id, parsed.data.months);

    return NextResponse.json({ trend });
  } catch (error) {
    return errorResponse(error);
  }
}
