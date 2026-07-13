import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { errorResponse } from "@/lib/errors";
import { getDebtSummary } from "@/lib/services/debts";

export async function GET() {
  try {
    const session = await requireSession();
    const summary = await getDebtSummary(session.user.id);
    return NextResponse.json(summary);
  } catch (error) {
    return errorResponse(error);
  }
}
