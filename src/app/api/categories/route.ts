import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { ConflictError, errorResponse } from "@/lib/errors";
import { connectDB } from "@/lib/db";
import Category, { type CategoryType } from "@/lib/models/Category";
import { createCategorySchema } from "@/lib/validation/categories";

const VALID_TYPES: readonly CategoryType[] = ["income", "expense"];

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    await connectDB();

    const typeParam = request.nextUrl.searchParams.get("type");
    const type = VALID_TYPES.includes(typeParam as CategoryType)
      ? (typeParam as CategoryType)
      : undefined;
    const includeArchived =
      request.nextUrl.searchParams.get("includeArchived") === "true";

    const categories = await Category.findForUser(session.user.id, {
      ...(type ? { type } : {}),
      ...(includeArchived ? {} : { isArchived: false }),
    }).sort({ createdAt: -1 });

    return NextResponse.json({ categories });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const parsed = createCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    await connectDB();

    const existing = await Category.findOne({
      userId: session.user.id,
      name: parsed.data.name,
      type: parsed.data.type,
    });
    if (existing) {
      throw new ConflictError("Ya existe una categoría con ese nombre y tipo");
    }

    const category = await Category.create({
      ...parsed.data,
      userId: session.user.id,
      isDefault: false,
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
