import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/auth/logout/route";

describe("POST /api/auth/logout", () => {
  it("returns 200 and clears both session cookie variants", async () => {
    const res = await POST();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("next-auth.session-token=");
    expect(setCookie).toContain("__Secure-next-auth.session-token=");
    expect(setCookie).toContain("Max-Age=0");
  });

  it("is idempotent when called repeatedly", async () => {
    const first = await POST();
    const second = await POST();
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });
});
