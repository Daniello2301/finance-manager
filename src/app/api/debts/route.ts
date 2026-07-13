import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { errorResponse } from "@/lib/errors";
import { connectDB } from "@/lib/db";
import Debt from "@/lib/models/Debt";
import { createDebtSchema } from "@/lib/validation/debts";
import { listDebtsWithState } from "@/lib/services/debts";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const includeArchived =
      request.nextUrl.searchParams.get("includeArchived") === "true";

    const debts = await listDebtsWithState(session.user.id, includeArchived);

    return NextResponse.json({ debts });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const parsed = createDebtSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    await connectDB();

    const debt = await Debt.create({ ...parsed.data, userId: session.user.id });

    return NextResponse.json({ debt }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
