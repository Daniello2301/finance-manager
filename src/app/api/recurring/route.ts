import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { errorResponse, NotFoundError, ValidationError } from "@/lib/errors";
import { connectDB } from "@/lib/db";
import Account from "@/lib/models/Account";
import Category from "@/lib/models/Category";
import RecurringTransaction from "@/lib/models/RecurringTransaction";
import { createRecurringSchema } from "@/lib/validation/recurring";
import { firstDueDate } from "@/lib/recurrence";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const includeArchived =
      request.nextUrl.searchParams.get("includeArchived") === "true";

    await connectDB();
    const filter = includeArchived ? {} : { isArchived: false };
    const recurring = await RecurringTransaction.findForUser(
      session.user.id,
      filter
    ).sort({ nextDueDate: 1 });

    return NextResponse.json({ recurring });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const parsed = createRecurringSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    await connectDB();

    // FR-001: both the account and the category must be the caller's own. Bare
    // queries (not findForUser) match the convention in accounts/transactions.
    const [account, category] = await Promise.all([
      Account.findOne({ _id: parsed.data.accountId, userId: session.user.id }),
      Category.findOne({ _id: parsed.data.categoryId, userId: session.user.id }),
    ]);
    if (!account) {
      throw new NotFoundError("La cuenta no existe o no te pertenece");
    }
    if (!category) {
      throw new NotFoundError("La categoría no existe o no te pertenece");
    }
    // An income template must land in an income category, and vice versa — an
    // expense filed under "Salario" would corrupt every report that splits by type.
    if (category.type !== parsed.data.type) {
      throw new ValidationError(
        "La categoría no corresponde al tipo del recurrente"
      );
    }

    // anchorDay is derived, never client-sent, so the anchor and the date can't
    // disagree. nextDueDate is the first occurrence >= today (FR-003, no backfill).
    const anchorDay = parsed.data.startDate.getUTCDate();
    const nextDueDate = firstDueDate(
      parsed.data.startDate,
      parsed.data.frequency,
      anchorDay,
      new Date()
    );

    const recurring = await RecurringTransaction.create({
      ...parsed.data,
      userId: session.user.id,
      anchorDay,
      nextDueDate,
    });

    return NextResponse.json({ recurring }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
