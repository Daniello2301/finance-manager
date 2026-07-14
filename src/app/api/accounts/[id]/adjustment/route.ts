import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/api-auth";
import { parseObjectIdParam } from "@/lib/validation/common";
import { errorResponse } from "@/lib/errors";
import { adjustAccountBalance } from "@/lib/services/adjustments";

const adjustmentSchema = z.object({
  amount: z
    .number()
    .int("El monto debe ser un entero")
    .positive("El monto debe ser mayor que cero"),
  description: z.string().trim().max(200).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Recognises money the app didn't know this account had. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id: rawId } = await params;
    const id = parseObjectIdParam(rawId);

    const parsed = adjustmentSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    const transaction = await adjustAccountBalance(
      session.user.id,
      id,
      parsed.data
    );

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
