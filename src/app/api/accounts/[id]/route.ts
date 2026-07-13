import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { errorResponse, NotFoundError, ValidationError } from "@/lib/errors";
import { connectDB } from "@/lib/db";
import Account from "@/lib/models/Account";
import { updateAccountSchema } from "@/lib/validation/accounts";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id } = await params;
    await connectDB();

    const account = await Account.findOne({
      _id: id,
      userId: session.user.id,
    });
    if (!account) {
      throw new NotFoundError();
    }

    return NextResponse.json({ account });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const rawBody = await request.json();

    // FR-006: reject, don't silently strip — omitting `currency` from the
    // Zod schema would let a client-sent value pass through unnoticed.
    if (Object.prototype.hasOwnProperty.call(rawBody, "currency")) {
      throw new ValidationError(
        "La moneda no se puede modificar. Archiva esta cuenta y crea una nueva si necesitas otra moneda."
      );
    }

    const parsed = updateAccountSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    await connectDB();

    const existing = await Account.findOne({
      _id: id,
      userId: session.user.id,
    });
    if (!existing) {
      throw new NotFoundError();
    }

    // Zod only sees this request's body, not the account's stored type —
    // a PATCH sending just `{ creditLimit }` needs the *effective* type
    // (payload's, falling back to the stored one) checked here.
    const effectiveType = parsed.data.type ?? existing.type;
    if (
      parsed.data.creditLimit !== undefined &&
      effectiveType !== "credit_card"
    ) {
      throw new ValidationError(
        "creditLimit solo aplica a cuentas tipo tarjeta de crédito"
      );
    }

    const updated = await Account.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      parsed.data,
      { returnDocument: "after", runValidators: true }
    );

    return NextResponse.json({ account: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id } = await params;
    await connectDB();

    const archived = await Account.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      { isArchived: true },
      { returnDocument: "after" }
    );

    if (!archived) {
      throw new NotFoundError();
    }

    return NextResponse.json({ account: archived });
  } catch (error) {
    return errorResponse(error);
  }
}
