import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class UnauthorizedError extends Error {
  constructor(message = "No autenticado") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "No encontrado") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ConflictError extends Error {
  constructor(message = "Ya existe un recurso con esos datos") {
    super(message);
    this.name = "ConflictError";
  }
}

/**
 * An expense would take the account past what it has available.
 *
 * Not a hard block — the client is expected to show the user the real figure
 * and let them confirm, then retry with `confirmOverdraft: true`. It carries
 * `available` precisely so the confirmation can quote the *server's* number
 * rather than a possibly-stale cached balance.
 */
export class InsufficientFundsError extends Error {
  readonly available: number;
  readonly currency: string;

  constructor(available: number, currency: string) {
    super("El monto supera el saldo disponible de la cuenta");
    this.name = "InsufficientFundsError";
    this.available = available;
    this.currency = currency;
  }
}

function isMongoDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }
  if (error instanceof InsufficientFundsError) {
    return NextResponse.json(
      {
        error: error.message,
        code: "INSUFFICIENT_FUNDS",
        available: error.available,
        currency: error.currency,
      },
      { status: 422 }
    );
  }
  if (error instanceof ConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  // A Zod failure that reaches here came from a `.parse()` (rather than the
  // routes' usual `safeParse`) — today that's the `[id]` route param. Without
  // this branch it fell through to the 500 below.
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: error.issues },
      { status: 422 }
    );
  }
  if (isMongoDuplicateKeyError(error)) {
    return NextResponse.json(
      { error: "Ya existe un recurso con esos datos" },
      { status: 409 }
    );
  }
  return NextResponse.json(
    { error: "Error interno del servidor" },
    { status: 500 }
  );
}
