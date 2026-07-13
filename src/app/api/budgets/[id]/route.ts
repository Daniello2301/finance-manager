import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { errorResponse, NotFoundError } from "@/lib/errors";
import { connectDB } from "@/lib/db";
import Budget from "@/lib/models/Budget";
import { updateBudgetSchema } from "@/lib/validation/budgets";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const rawBody = await request.json();
    const parsed = updateBudgetSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    await connectDB();

    const updated = await Budget.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      parsed.data,
      { returnDocument: "after", runValidators: true }
    );
    if (!updated) {
      throw new NotFoundError();
    }

    return NextResponse.json({ budget: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id } = await params;
    await connectDB();

    // A hard delete, unlike Cuentas/Categorías' archive — a Budget is never
    // referenced by Transaction, so nothing downstream can dangle.
    const deleted = await Budget.findOneAndDelete({
      _id: id,
      userId: session.user.id,
    });
    if (!deleted) {
      throw new NotFoundError();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
