import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import { seedDefaultCategories } from "@/lib/seed/defaultCategories";
import type { VerifiedUser } from "@/lib/auth/verifyCredentials";

export interface GoogleProfileInput {
  /** Google's stable `sub`. Never used as our identity — only as a link. */
  googleId: string;
  email: string;
  name: string;
  /** Whether GOOGLE says it owns this address. Load-bearing — see below. */
  emailVerified: boolean;
}

/**
 * Resolves a Google profile to one of OUR users, creating or linking as needed.
 *
 * Returns our `User._id`, never Google's `sub`: every other collection hangs off
 * our ObjectId (Principle 8), so letting an external id stand in as the identity
 * would break every query in the app. This is the whole reason Google fits as a
 * provider where Clerk didn't.
 *
 * Returns null when Google hasn't verified the address — see below.
 */
export async function findOrCreateGoogleUser(
  profile: GoogleProfileInput
): Promise<VerifiedUser | null> {
  // The rule the linking policy rests on (FR-017). Matching an existing account
  // by email is only safe because Google is asserting it owns that address; take
  // the assertion away and this becomes "type someone's email into a fresh
  // Google account and inherit their money". Refuse, don't guess.
  if (!profile.emailVerified) {
    return null;
  }

  await connectDB();

  const email = profile.email.toLowerCase();

  // By googleId first, so a user who later changes their Google address still
  // lands on their own account rather than being treated as a new person.
  const linked = await User.findOne({ googleId: profile.googleId });
  if (linked) {
    return { id: linked._id.toString(), email: linked.email, name: linked.name };
  }

  // FR-016: the address already has an account — this is the same person coming
  // in through a different door. Link, don't fork: a second account would leave
  // them staring at an empty app believing their data was lost.
  const existing = await User.findOne({ email });
  if (existing) {
    existing.googleId = profile.googleId;
    // Deliberately leaves passwordHash alone: linking adds a way in, it never
    // takes one away.
    await existing.save();
    return {
      id: existing._id.toString(),
      email: existing.email,
      name: existing.name,
    };
  }

  // A genuinely new user. No passwordHash — that is not a missing field, it's
  // an account that has no password.
  const user = await User.create({
    email,
    name: profile.name,
    googleId: profile.googleId,
  });

  try {
    // FR-015. This is the one thing a Google sign-in would otherwise skip: the
    // seed lives in /api/auth/signup, which OAuth never touches. Without it the
    // user has zero categories, and every Transaction and Budget requires one —
    // they couldn't record a single expense.
    await seedDefaultCategories(user._id);
  } catch (error) {
    // Same compensating delete as the signup route: no Mongo transaction ties
    // these two writes together, and a user with zero categories is worse than
    // no user at all — they'd have to be fixed by hand.
    await User.deleteOne({ _id: user._id });
    throw error;
  }

  return { id: user._id.toString(), email: user.email, name: user.name };
}
