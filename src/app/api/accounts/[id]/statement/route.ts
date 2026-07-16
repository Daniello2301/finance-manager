import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { parseObjectIdParam } from "@/lib/validation/common";
import { errorResponse } from "@/lib/errors";
import { getStatement } from "@/lib/services/statements";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** What this card demands by when — as opposed to what it owes in total. */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id: rawId } = await params;
    const id = parseObjectIdParam(rawId);

    const statement = await getStatement(session.user.id, id);

    return NextResponse.json({ statement });
  } catch (error) {
    return errorResponse(error);
  }
}
