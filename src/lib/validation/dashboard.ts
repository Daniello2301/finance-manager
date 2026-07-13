import { z } from "zod";

export const trendQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(6),
});

export const categoryBreakdownQuerySchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "El período debe tener el formato AAAA-MM"),
});

export const recentTransactionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type TrendQuery = z.infer<typeof trendQuerySchema>;
export type CategoryBreakdownQuery = z.infer<typeof categoryBreakdownQuerySchema>;
export type RecentTransactionsQuery = z.infer<typeof recentTransactionsQuerySchema>;
