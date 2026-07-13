import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { errorResponse } from "@/lib/errors";
import { recentTransactionsQuerySchema } from "@/lib/validation/dashboard";
import { getRecentTransactions } from "@/lib/services/dashboard";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();

    const parsed = recentTransactionsQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Parámetros inválidos", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    const transactions = await getRecentTransactions(
      session.user.id,
      parsed.data.limit
    );

    return NextResponse.json({ transactions });
  } catch (error) {
    return errorResponse(error);
  }
}
