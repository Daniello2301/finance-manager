import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { parseObjectIdParam } from "@/lib/validation/common";
import { errorResponse, NotFoundError } from "@/lib/errors";
import { connectDB } from "@/lib/db";
import Account from "@/lib/models/Account";
import Category from "@/lib/models/Category";
import Transaction from "@/lib/models/Transaction";
import { updateTransactionSchema } from "@/lib/validation/transactions";
import { deleteTransaction, updateTransaction } from "@/lib/services/transactions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id: rawId } = await params;
    const id = parseObjectIdParam(rawId);
    await connectDB();

    const transaction = await Transaction.findOne({
      _id: id,
      userId: session.user.id,
    });
    if (!transaction) {
      throw new NotFoundError();
    }

    return NextResponse.json({ transaction });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id: rawId } = await params;
    const id = parseObjectIdParam(rawId);
    const rawBody = await request.json();

    const parsed = updateTransactionSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    await connectDB();

    // Only re-validate ownership for a field that's actually present in
    // this PATCH — if accountId/categoryId are absent, they were already
    // validated when the transaction was created.
    if ("accountId" in parsed.data) {
      const account = await Account.findOne({
        _id: parsed.data.accountId,
        userId: session.user.id,
      });
      if (!account) {
        throw new NotFoundError("La cuenta no existe o no te pertenece");
      }
    }
    if ("categoryId" in parsed.data) {
      const category = await Category.findOne({
        _id: parsed.data.categoryId,
        userId: session.user.id,
      });
      if (!category) {
        throw new NotFoundError("La categoría no existe o no te pertenece");
      }
    }

    const transaction = await updateTransaction(
      session.user.id,
      id,
      parsed.data
    );

    return NextResponse.json({ transaction });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id: rawId } = await params;
    const id = parseObjectIdParam(rawId);
    await connectDB();

    await deleteTransaction(session.user.id, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
