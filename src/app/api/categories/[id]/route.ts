import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { errorResponse, NotFoundError, ValidationError } from "@/lib/errors";
import { connectDB } from "@/lib/db";
import Category from "@/lib/models/Category";
import { updateCategorySchema } from "@/lib/validation/categories";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const rawBody = await request.json();

    // type is immutable after creation — reject, don't silently strip
    // (same pattern as Account's currency immutability).
    if (Object.prototype.hasOwnProperty.call(rawBody, "type")) {
      throw new ValidationError(
        "El tipo de la categoría no se puede modificar."
      );
    }

    const parsed = updateCategorySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    await connectDB();

    const updated = await Category.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      parsed.data,
      { returnDocument: "after", runValidators: true }
    );

    if (!updated) {
      throw new NotFoundError();
    }

    return NextResponse.json({ category: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id } = await params;
    await connectDB();

    const archived = await Category.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      { isArchived: true },
      { returnDocument: "after" }
    );

    if (!archived) {
      throw new NotFoundError();
    }

    return NextResponse.json({ category: archived });
  } catch (error) {
    return errorResponse(error);
  }
}
