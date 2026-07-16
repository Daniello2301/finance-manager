import mongoose, { Schema, type Document } from "mongoose";

/**
 * A user, and the ONE identity everything else hangs off.
 *
 * `_id` is that identity: every other collection carries it as `userId`
 * (Principle 8). No external provider's id ever takes its place — Google's `sub`
 * is stored as a link (`googleId`), never used as the identity. That distinction
 * is exactly why Google fits here as a provider and why Clerk was rejected
 * (ratified 2026-07-13 / 2026-07-16).
 */
export interface IUser extends Document {
  email: string;
  name: string;
  /**
   * Absent for accounts created with Google — they have no password, and that
   * is not an error state. A user may have BOTH (signed up with a password,
   * later linked Google), which is why this isn't a single `provider` enum:
   * that would have to lie about one of the two.
   */
  passwordHash?: string;
  /** Google's stable `sub`. Present once the account is linked to Google. */
  googleId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Not required (changed 2026-07-16): a Google account has no password. The
    // credential path refuses to log such a user in — see verifyCredentials,
    // where a missing hash used to make bcryptjs throw rather than return null.
    passwordHash: {
      type: String,
      select: false,
    },
    // Sparse: only linked accounts carry one, and `unique` must not collide
    // across the many users who have none. Matching on this first means a user
    // who changes their Google email still lands on their own account.
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true }
);

userSchema.index({ createdAt: -1 });

const User =
  (mongoose.models.User as mongoose.Model<IUser>) ||
  mongoose.model<IUser>("User", userSchema);

export default User;
