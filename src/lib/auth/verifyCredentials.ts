import bcryptjs from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";

export interface VerifiedUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Returns null for both "no such user" and "wrong password" — the caller
 * must not surface a different message for either case (FR-014, prevents
 * user-enumeration via distinguishable error responses).
 */
export async function verifyCredentials(
  email: string,
  password: string
): Promise<VerifiedUser | null> {
  await connectDB();

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+passwordHash"
  );
  if (!user) {
    return null;
  }

  const isValid = await bcryptjs.compare(password, user.passwordHash);
  if (!isValid) {
    return null;
  }

  return { id: user._id.toString(), email: user.email, name: user.name };
}
