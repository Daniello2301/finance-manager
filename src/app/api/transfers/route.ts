import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { errorResponse } from "@/lib/errors";
import { createTransferSchema } from "@/lib/validation/transfers";
import { transferMoney } from "@/lib/services/transfers";

/** Moves money between two of the user's own accounts. */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();

    const parsed = createTransferSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    const transfer = await transferMoney(session.user.id, parsed.data);

    return NextResponse.json({ transfer }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
