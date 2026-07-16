import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { parseObjectIdParam } from "@/lib/validation/common";
import { errorResponse } from "@/lib/errors";
import { confirmOccurrenceSchema } from "@/lib/validation/recurring";
import { confirmOccurrence } from "@/lib/services/recurring";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Materialises one pending occurrence of a manual template (FR-005), optionally
 * at a corrected amount (FR-007). A confirm is a decision, so it goes through the
 * normal funds check — an overdraw surfaces the four-exit dialog, not a bypass.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id: rawId } = await params;
    const id = parseObjectIdParam(rawId);

    const parsed = confirmOccurrenceSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    const recurring = await confirmOccurrence(
      session.user.id,
      id,
      parsed.data.occurrenceKey,
      parsed.data.amount
    );

    return NextResponse.json({ recurring });
  } catch (error) {
    return errorResponse(error);
  }
}
