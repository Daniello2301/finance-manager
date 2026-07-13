import { z } from "zod";

/**
 * A 24-char hex Mongo ObjectId.
 *
 * Plain regex, deliberately NOT `mongoose.Types.ObjectId.isValid` — this module
 * is imported by client components (via the transaction/budget form schemas),
 * and importing mongoose there drags `fs`/`net`/`tls` into the browser bundle
 * and breaks the build. The regex is also stricter: mongoose's own check accepts
 * *any* 12-character string as valid.
 */
export const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "ID inválido");

/**
 * Validates an `[id]` route param.
 *
 * Every `[id]` route used to hand the raw string straight to Mongoose, which
 * throws a `CastError` that `errorResponse()` doesn't recognise — so a URL like
 * `/api/accounts/abc` returned a 500 instead of a 422.
 */
export function parseObjectIdParam(id: string): string {
  return objectIdSchema.parse(id);
}
