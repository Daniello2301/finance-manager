import { describe, expect, it } from "vitest";
import {
  ConflictError,
  errorResponse,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";

describe("errorResponse", () => {
  it("maps UnauthorizedError to 401 with a default message", async () => {
    const res = errorResponse(new UnauthorizedError());
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("No autenticado");
  });

  it("maps UnauthorizedError with a custom message", async () => {
    const res = errorResponse(new UnauthorizedError("Sesión expirada"));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Sesión expirada");
  });

  it("maps NotFoundError to 404 with a default message", async () => {
    const res = errorResponse(new NotFoundError());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("No encontrado");
  });

  it("maps ValidationError to 422 with its message", async () => {
    const res = errorResponse(
      new ValidationError("La moneda no se puede modificar")
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("La moneda no se puede modificar");
  });

  it("maps ConflictError to 409 with a default message", async () => {
    const res = errorResponse(new ConflictError());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe(
      "Ya existe un recurso con esos datos"
    );
  });

  it("maps ConflictError with a custom message", async () => {
    const res = errorResponse(new ConflictError("Ya existe esa categoría"));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Ya existe esa categoría");
  });

  it("maps a raw Mongo duplicate-key error (code 11000) to a generic 409", async () => {
    const mongoError = Object.assign(new Error("E11000 duplicate key"), {
      code: 11000,
    });
    const res = errorResponse(mongoError);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe(
      "Ya existe un recurso con esos datos"
    );
  });

  it("maps unknown Error instances to a generic 500", async () => {
    const res = errorResponse(new Error("boom"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Error interno del servidor");
  });

  it("maps non-Error thrown values to a generic 500", async () => {
    const res = errorResponse("not an error");
    expect(res.status).toBe(500);
  });
});
