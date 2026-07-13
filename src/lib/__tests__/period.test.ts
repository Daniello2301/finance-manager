import { afterEach, describe, expect, it, vi } from "vitest";
import { getCurrentPeriodKey, getLastPeriodKeys } from "@/lib/period";

describe("getCurrentPeriodKey", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the current UTC year-month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));
    expect(getCurrentPeriodKey()).toBe("2026-07");
  });

  it("uses the UTC calendar date, not a local-time-shifted one", () => {
    vi.useFakeTimers();
    // Late on the last day of July in UTC — a local-time implementation in
    // a timezone ahead of UTC would already see August here.
    vi.setSystemTime(new Date("2026-07-31T23:30:00.000Z"));
    expect(getCurrentPeriodKey()).toBe("2026-07");
  });
});

describe("getLastPeriodKeys", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the last N months ending at the current month, oldest first", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));
    expect(getLastPeriodKeys(3)).toEqual(["2026-05", "2026-06", "2026-07"]);
  });

  it("rolls over the year boundary correctly", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    expect(getLastPeriodKeys(3)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });

  it("returns exactly one key for months=1", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));
    expect(getLastPeriodKeys(1)).toEqual(["2026-07"]);
  });
});
