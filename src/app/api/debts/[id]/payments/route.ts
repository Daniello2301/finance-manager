import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { parseObjectIdParam } from "@/lib/validation/common";
import { errorResponse, NotFoundError } from "@/lib/errors";
import { connectDB } from "@/lib/db";
import Account from "@/lib/models/Account";
import Category from "@/lib/models/Category";
import { createDebtPaymentSchema } from "@/lib/validation/debts";
import { payDebt } from "@/lib/services/debts";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id: rawId } = await params;
    const id = parseObjectIdParam(rawId);

    const parsed = createDebtPaymentSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    await connectDB();

    // Same ownership checks the transactions route does, in the same order.
    const account = await Account.findOne({
      _id: parsed.data.accountId,
      userId: session.user.id,
    });
    if (!account) {
      throw new NotFoundError("La cuenta no existe o no te pertenece");
    }
    const category = await Category.findOne({
      _id: parsed.data.categoryId,
      userId: session.user.id,
    });
    if (!category) {
      throw new NotFoundError("La categoría no existe o no te pertenece");
    }

    // payDebt delegates to createTransaction, so the account balance moves, the
    // whole thing runs in one Mongo transaction, and paying with money you don't
    // have raises InsufficientFundsError just like any other expense.
    const transaction = await payDebt(session.user.id, id, parsed.data);

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
