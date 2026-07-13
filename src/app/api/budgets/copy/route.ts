import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { errorResponse } from "@/lib/errors";
import { connectDB } from "@/lib/db";
import { copyBudgetsSchema } from "@/lib/validation/budgets";
import { copyBudgets } from "@/lib/services/budgets";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const parsed = copyBudgetsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    await connectDB();

    const budgets = await copyBudgets(
      session.user.id,
      parsed.data.fromPeriod,
      parsed.data.toPeriod
    );

    return NextResponse.json({ budgets }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
