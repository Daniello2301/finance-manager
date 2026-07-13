import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSession } from "@/lib/api-auth";
import { errorResponse, NotFoundError } from "@/lib/errors";
import { connectDB } from "@/lib/db";
import Account from "@/lib/models/Account";
import Transaction from "@/lib/models/Transaction";
import { signedDelta } from "@/lib/services/transactions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id } = await params;
    await connectDB();

    const dbSession = await mongoose.startSession();
    try {
      // Wrapped in a transaction so the read of every Transaction for this
      // account and the overwrite of currentBalance see one consistent
      // snapshot — otherwise a transaction created concurrently, mid-recompute,
      // could be counted in the aggregate but then also re-applied by its own
      // $inc, or missed entirely.
      const account = await dbSession.withTransaction(async () => {
        const existing = await Account.findOne({
          _id: id,
          userId: session.user.id,
        }).session(dbSession);
        if (!existing) {
          throw new NotFoundError();
        }

        const transactions = await Transaction.find({
          accountId: id,
          userId: session.user.id,
        }).session(dbSession);

        existing.currentBalance = transactions.reduce(
          (total, tx) => total + signedDelta(tx.type, tx.amount),
          existing.initialBalance
        );
        await existing.save({ session: dbSession });
        return existing;
      });

      return NextResponse.json({ account });
    } finally {
      await dbSession.endSession();
    }
  } catch (error) {
    return errorResponse(error);
  }
}
