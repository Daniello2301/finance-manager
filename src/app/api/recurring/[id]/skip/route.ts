import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { parseObjectIdParam } from "@/lib/validation/common";
import { errorResponse } from "@/lib/errors";
import { skipOccurrenceSchema } from "@/lib/validation/recurring";
import { skipOccurrence } from "@/lib/services/recurring";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Advances past one pending occurrence without creating anything (US4 / Scenario 6). */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id: rawId } = await params;
    const id = parseObjectIdParam(rawId);

    const parsed = skipOccurrenceSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    const recurring = await skipOccurrence(
      session.user.id,
      id,
      parsed.data.occurrenceKey
    );

    return NextResponse.json({ recurring });
  } catch (error) {
    return errorResponse(error);
  }
}
