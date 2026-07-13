import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { parseObjectIdParam } from "@/lib/validation/common";
import { errorResponse, NotFoundError } from "@/lib/errors";
import { connectDB } from "@/lib/db";
import Debt from "@/lib/models/Debt";
import { updateDebtSchema } from "@/lib/validation/debts";
import { getDebtState } from "@/lib/services/debts";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id: rawId } = await params;
    const id = parseObjectIdParam(rawId);

    const result = await getDebtState(session.user.id, id);

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id: rawId } = await params;
    const id = parseObjectIdParam(rawId);

    const parsed = updateDebtSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    await connectDB();

    const updated = await Debt.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      parsed.data,
      { returnDocument: "after", runValidators: true }
    );
    if (!updated) {
      throw new NotFoundError("La deuda no existe o no te pertenece");
    }

    return NextResponse.json({ debt: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Archives, never deletes.
 *
 * A debt's payments are real transactions that moved real money. Hard-deleting
 * the debt would leave them pointing at nothing, and deleting them too would
 * silently rewrite the user's account balances. Archiving keeps both true.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id: rawId } = await params;
    const id = parseObjectIdParam(rawId);

    await connectDB();

    const archived = await Debt.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      { isArchived: true },
      { returnDocument: "after" }
    );
    if (!archived) {
      throw new NotFoundError("La deuda no existe o no te pertenece");
    }

    return NextResponse.json({ debt: archived });
  } catch (error) {
    return errorResponse(error);
  }
}
