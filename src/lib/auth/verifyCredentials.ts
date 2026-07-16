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

  // A Google account has no password (FR-018). Returning null — rather than
  // "this account uses Google" — is deliberate: a distinguishable answer here
  // would tell an attacker which addresses are registered, which is the exact
  // leak FR-014 exists to prevent. Without this guard bcryptjs is handed
  // `undefined` and THROWS ("Illegal arguments"), surfacing as a broken login
  // rather than a refused one.
  if (!user.passwordHash) {
    return null;
  }

  const isValid = await bcryptjs.compare(password, user.passwordHash);
  if (!isValid) {
    return null;
  }

  return { id: user._id.toString(), email: user.email, name: user.name };
}
