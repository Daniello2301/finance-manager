import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { errorResponse } from "@/lib/errors";
import { catchUp, pendingConfirmations } from "@/lib/services/recurring";

/**
 * Materialises the overdue occurrences of the caller's AUTOMATIC templates, and
 * returns the MANUAL ones still awaiting confirmation.
 *
 * Idempotent by design (Scenario 3): the unique index means running it twice —
 * two tabs, a refresh — never double-charges. Fired on every dashboard load.
 */
export async function POST() {
  try {
    const session = await requireSession();

    const { created } = await catchUp(session.user.id);
    const pending = await pendingConfirmations(session.user.id);

    return NextResponse.json({ created, pending });
  } catch (error) {
    return errorResponse(error);
  }
}
