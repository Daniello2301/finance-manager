import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { errorResponse, NotFoundError } from "@/lib/errors";
import { connectDB } from "@/lib/db";
import Account from "@/lib/models/Account";
import Category from "@/lib/models/Category";
import Transaction from "@/lib/models/Transaction";
import {
  createTransactionSchema,
  listTransactionsQuerySchema,
} from "@/lib/validation/transactions";
import { createTransaction } from "@/lib/services/transactions";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();

    const parsed = listTransactionsQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Parámetros inválidos", issues: parsed.error.issues },
        { status: 422 }
      );
    }
    const { accountId, categoryId, type, dateFrom, dateTo, page, limit } =
      parsed.data;

    await connectDB();

    const filter: Record<string, unknown> = {};
    if (accountId) filter.accountId = accountId;
    if (categoryId) filter.categoryId = categoryId;
    if (type) filter.type = type;
    if (dateFrom || dateTo) {
      filter.date = {
        ...(dateFrom ? { $gte: dateFrom } : {}),
        ...(dateTo ? { $lte: dateTo } : {}),
      };
    }

    const [data, total] = await Promise.all([
      Transaction.findForUser(session.user.id, filter)
        .sort({ date: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Transaction.countDocuments({ ...filter, userId: session.user.id }),
    ]);

    return NextResponse.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const parsed = createTransactionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    await connectDB();

    const [account, category] = await Promise.all([
      Account.findOne({ _id: parsed.data.accountId, userId: session.user.id }),
      Category.findOne({
        _id: parsed.data.categoryId,
        userId: session.user.id,
      }),
    ]);
    if (!account) {
      throw new NotFoundError("La cuenta no existe o no te pertenece");
    }
    if (!category) {
      throw new NotFoundError("La categoría no existe o no te pertenece");
    }

    const transaction = await createTransaction(session.user.id, parsed.data);

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
