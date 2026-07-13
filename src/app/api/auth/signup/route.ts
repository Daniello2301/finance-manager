import { NextRequest, NextResponse } from "next/server";
import bcryptjs from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import { signupSchema } from "@/lib/validation/auth";
import { seedDefaultCategories } from "@/lib/seed/defaultCategories";
import { errorResponse } from "@/lib/errors";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const { email, name, password } = parsed.data;

  await connectDB();

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return NextResponse.json(
      { error: "El correo electrónico ya está en uso" },
      { status: 409 }
    );
  }

  const passwordHash = await bcryptjs.hash(password, 10);
  const user = await User.create({ email, name, passwordHash });

  try {
    await seedDefaultCategories(user._id);
  } catch (error) {
    // No Mongo transaction ties these two writes together (see
    // .speckit/plans/categories.md's Decision 1) — a compensating delete
    // keeps the same user-visible guarantee: never a signed-up user with
    // zero categories.
    await User.deleteOne({ _id: user._id });
    return errorResponse(error);
  }

  return NextResponse.json(
    {
      success: true,
      user: { id: user._id.toString(), email: user.email, name: user.name },
    },
    { status: 201 }
  );
}
