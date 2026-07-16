import Category, { type CategoryType, type ICategory } from "@/lib/models/Category";

export const ADJUSTMENT_CATEGORY = "Ajuste de saldo";
export const TRANSFER_CATEGORY = "Transferencia";

/**
 * Categories the app needs but the user never asked for.
 *
 * Created on first use rather than seeded: they are not among the 21 categories
 * every account starts with, and backfilling every existing user would be a
 * migration for a category most of them will never touch. One indexed lookup,
 * and it is correct both for the users who predate the feature and the ones who
 * come after.
 *
 * The unique {userId, name, type} index is the real backstop — two concurrent
 * transfers cannot create it twice.
 */
export async function findOrCreateCategory(
  userId: string,
  name: string,
  type: CategoryType
): Promise<ICategory> {
  const existing = await Category.findOne({ userId, name, type });
  if (existing) return existing;

  try {
    return await Category.create({ userId, name, type, isDefault: true });
  } catch (error) {
    // Lost the race — the other writer created it. Read it back rather than
    // failing an operation the user has every right to expect to succeed.
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: number }).code === 11000
    ) {
      const raced = await Category.findOne({ userId, name, type });
      if (raced) return raced;
    }
    throw error;
  }
}
