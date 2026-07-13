import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { errorResponse, NotFoundError, ValidationError } from "@/lib/errors";
import { connectDB } from "@/lib/db";
import Category from "@/lib/models/Category";
import Budget from "@/lib/models/Budget";
import { createBudgetSchema, listBudgetsQuerySchema } from "@/lib/validation/budgets";
import { getBudgetProgress, periodRange } from "@/lib/services/budgets";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();

    const parsed = listBudgetsQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Parámetros inválidos", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    await connectDB();

    const budgets = await getBudgetProgress(
      session.user.id,
      parsed.data.period
    );

    return NextResponse.json({ budgets });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const parsed = createBudgetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    await connectDB();

    const category = await Category.findOne({
      _id: parsed.data.categoryId,
      userId: session.user.id,
    });
    if (!category) {
      throw new NotFoundError("La categoría no existe o no te pertenece");
    }
    if (category.type !== "expense") {
      throw new ValidationError(
        "Solo se pueden crear presupuestos para categorías de gasto"
      );
    }

    const budget = await Budget.create({
      userId: session.user.id,
      categoryId: parsed.data.categoryId,
      periodKey: parsed.data.periodKey,
      periodStart: periodRange(parsed.data.periodKey).periodStart,
      limitAmount: parsed.data.limitAmount,
      currency: "COP",
    });

    return NextResponse.json({ budget }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
