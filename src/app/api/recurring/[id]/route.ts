import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { parseObjectIdParam } from "@/lib/validation/common";
import { errorResponse, NotFoundError, ValidationError } from "@/lib/errors";
import { connectDB } from "@/lib/db";
import Account from "@/lib/models/Account";
import Category from "@/lib/models/Category";
import RecurringTransaction from "@/lib/models/RecurringTransaction";
import { updateRecurringSchema } from "@/lib/validation/recurring";
import { firstDueDate } from "@/lib/recurrence";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id: rawId } = await params;
    const id = parseObjectIdParam(rawId);

    await connectDB();
    const recurring = await RecurringTransaction.findOne({
      _id: id,
      userId: session.user.id,
    });
    if (!recurring) {
      throw new NotFoundError("El recurrente no existe o no te pertenece");
    }

    return NextResponse.json({ recurring });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id: rawId } = await params;
    const id = parseObjectIdParam(rawId);

    const parsed = updateRecurringSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    await connectDB();
    const userId = session.user.id;
    const existing = await RecurringTransaction.findOne({ _id: id, userId });
    if (!existing) {
      throw new NotFoundError("El recurrente no existe o no te pertenece");
    }

    const data = parsed.data;

    // Re-validate ownership only for fields actually present in the patch.
    if (data.accountId !== undefined) {
      const account = await Account.findOne({ _id: data.accountId, userId });
      if (!account) {
        throw new NotFoundError("La cuenta no existe o no te pertenece");
      }
    }
    if (data.categoryId !== undefined || data.type !== undefined) {
      const effectiveType = data.type ?? existing.type;
      const effectiveCategoryId = data.categoryId ?? existing.categoryId.toString();
      const category = await Category.findOne({ _id: effectiveCategoryId, userId });
      if (!category) {
        throw new NotFoundError("La categoría no existe o no te pertenece");
      }
      if (category.type !== effectiveType) {
        throw new ValidationError(
          "La categoría no corresponde al tipo del recurrente"
        );
      }
    }

    const updates: Record<string, unknown> = { ...data };

    // startDate re-derives anchorDay so the two can never disagree.
    if (data.startDate !== undefined) {
      updates.anchorDay = data.startDate.getUTCDate();
    }

    // Recompute nextDueDate — always forward, never backfilling — when the
    // schedule itself moves (startDate/frequency) or when resuming from a pause
    // (FR-008: the paused span is not filled in, the next due is the first one
    // from today onward).
    const resuming = data.isPaused === false && existing.isPaused === true;
    if (data.startDate !== undefined || data.frequency !== undefined || resuming) {
      const startDate = data.startDate ?? existing.startDate;
      const frequency = data.frequency ?? existing.frequency;
      const anchorDay = (updates.anchorDay as number) ?? existing.anchorDay;
      updates.nextDueDate = firstDueDate(
        startDate,
        frequency,
        anchorDay,
        new Date()
      );
    }

    const updated = await RecurringTransaction.findOneAndUpdate(
      { _id: id, userId },
      updates,
      { returnDocument: "after", runValidators: true }
    );

    return NextResponse.json({ recurring: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Archives, never deletes (FR-010).
 *
 * The transactions this template already generated are real money that moved.
 * Hard-deleting the template would leave them pointing at nothing; archiving
 * keeps the history intact and simply stops it coming due.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id: rawId } = await params;
    const id = parseObjectIdParam(rawId);

    await connectDB();
    const archived = await RecurringTransaction.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      { isArchived: true },
      { returnDocument: "after" }
    );
    if (!archived) {
      throw new NotFoundError("El recurrente no existe o no te pertenece");
    }

    return NextResponse.json({ recurring: archived });
  } catch (error) {
    return errorResponse(error);
  }
}
