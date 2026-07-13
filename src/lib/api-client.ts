/**
 * An HTTP error from our own API, with the response body kept intact.
 *
 * The hooks used to throw a bare `new Error(body.error)`, which discarded
 * everything except the message. That was fine while every error was just a
 * message — but `InsufficientFundsError` answers with a `code` and the account's
 * real `available` balance, and the confirmation dialog needs both.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>) {
    super(
      typeof body.error === "string"
        ? body.error
        : "Ocurrió un error inesperado"
    );
    this.name = "ApiError";
    this.status = status;
    this.code = typeof body.code === "string" ? body.code : undefined;
    this.body = body;
  }
}

/**
 * Reads a JSON response, throwing `ApiError` on a non-2xx.
 *
 * Shared by every React Query hook — this was copy-pasted verbatim into all
 * five of them before.
 */
export async function parseJsonOrThrow(res: Response) {
  const body = await res.json();
  if (!res.ok) {
    throw new ApiError(res.status, body);
  }
  return body;
}

export function isInsufficientFunds(
  error: unknown
): error is ApiError & { body: { available: number; currency: string } } {
  return error instanceof ApiError && error.code === "INSUFFICIENT_FUNDS";
}
