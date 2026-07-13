import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { errorResponse } from "@/lib/errors";
import { getBalanceSummary, getTopBudgets } from "@/lib/services/dashboard";

export async function GET() {
  try {
    const session = await requireSession();

    const [balances, topBudgets] = await Promise.all([
      getBalanceSummary(session.user.id),
      getTopBudgets(session.user.id),
    ]);

    return NextResponse.json({ balances, topBudgets });
  } catch (error) {
    return errorResponse(error);
  }
}
