import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { errorResponse } from "@/lib/errors";
import { connectDB } from "@/lib/db";
import Account from "@/lib/models/Account";
import { createAccountSchema } from "@/lib/validation/accounts";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    await connectDB();

    const includeArchived =
      request.nextUrl.searchParams.get("includeArchived") === "true";

    const accounts = await Account.findForUser(
      session.user.id,
      includeArchived ? {} : { isArchived: false }
    ).sort({ createdAt: -1 });

    return NextResponse.json({ accounts });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const parsed = createAccountSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    await connectDB();

    const account = await Account.create({
      ...parsed.data,
      userId: session.user.id,
      currentBalance: parsed.data.initialBalance,
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
