import { describe, expect, it } from "vitest";
import {
  dueOccurrences,
  firstDueDate,
  nextOccurrence,
  occurrenceKey,
} from "@/lib/recurrence";

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("occurrenceKey", () => {
  it("formats a date as YYYY-MM-DD in UTC", () => {
    expect(occurrenceKey(utc("2026-07-20"))).toBe("2026-07-20");
  });

  it("ignores the time of day (UTC start of day)", () => {
    expect(occurrenceKey(new Date("2026-07-20T23:59:59.000Z"))).toBe(
      "2026-07-20"
    );
  });
});

describe("nextOccurrence", () => {
  it("weekly advances 7 days", () => {
    expect(occurrenceKey(nextOccurrence(utc("2026-07-20"), "weekly", 20))).toBe(
      "2026-07-27"
    );
  });

  it("biweekly advances 14 days (a fixed cadence, not twice a month)", () => {
    expect(
      occurrenceKey(nextOccurrence(utc("2026-07-20"), "biweekly", 20))
    ).toBe("2026-08-03");
  });

  it("monthly advances to the anchor day of the next month", () => {
    expect(occurrenceKey(nextOccurrence(utc("2026-07-05"), "monthly", 5))).toBe(
      "2026-08-05"
    );
  });

  it("yearly advances one year, same month and day", () => {
    expect(occurrenceKey(nextOccurrence(utc("2026-03-15"), "yearly", 15))).toBe(
      "2027-03-15"
    );
  });

  // Scenario 8 — the day-31 clamp.
  it("clamps day 31 to the last day of a short month", () => {
    expect(occurrenceKey(nextOccurrence(utc("2026-01-31"), "monthly", 31))).toBe(
      "2026-02-28"
    );
  });

  it("clamps to 29 in a leap February", () => {
    expect(occurrenceKey(nextOccurrence(utc("2024-01-31"), "monthly", 31))).toBe(
      "2024-02-29"
    );
  });

  // The anchor is kept SEPARATELY from the clamped date: from a clamped Feb 28,
  // March must return to the 31st, not stay on the 28th.
  it("returns to the anchor after a clamped month", () => {
    expect(occurrenceKey(nextOccurrence(utc("2026-02-28"), "monthly", 31))).toBe(
      "2026-03-31"
    );
  });

  it("rolls the year over on a December monthly", () => {
    expect(occurrenceKey(nextOccurrence(utc("2026-12-10"), "monthly", 10))).toBe(
      "2027-01-10"
    );
  });
});

describe("firstDueDate", () => {
  // FR-003 / Scenario 1: the first due date is the first occurrence >= today.
  // Never anything before it — no backfill.
  it("is the first anchored day on or after today", () => {
    // Netflix day 20, created the 14th → first due is the 20th of this month.
    expect(
      occurrenceKey(
        firstDueDate(utc("2026-07-20"), "monthly", 20, utc("2026-07-14"))
      )
    ).toBe("2026-07-20");
  });

  it("jumps to next month when the anchor already passed this month", () => {
    // Created on the 25th, day-20 anchor already gone → first due is next month.
    expect(
      occurrenceKey(
        firstDueDate(utc("2026-07-20"), "monthly", 20, utc("2026-07-25"))
      )
    ).toBe("2026-08-20");
  });

  it("does not backfill when the anchor day is far in the past", () => {
    // startDate anchors the DAY (the 5th), not history: a 2020 anchor still
    // yields the first day-5 from today onward, not five years of occurrences.
    const first = firstDueDate(utc("2020-01-05"), "monthly", 5, utc("2026-07-14"));
    expect(occurrenceKey(first)).toBe("2026-08-05");
  });

  it("returns the startDate itself when it is in the future", () => {
    expect(
      occurrenceKey(
        firstDueDate(utc("2026-09-05"), "monthly", 5, utc("2026-07-14"))
      )
    ).toBe("2026-09-05");
  });

  // Defensive branch: the API always derives anchorDay FROM startDate, so the
  // two agree. A caller that passes an anchor earlier in the month than the
  // startDate's own day must still land on a real occurrence, not before it.
  it("steps forward when the anchor day precedes the startDate's day", () => {
    expect(
      occurrenceKey(
        firstDueDate(utc("2026-07-20"), "monthly", 5, utc("2026-07-01"))
      )
    ).toBe("2026-08-05");
  });

  it("runs weekly from the startDate's cadence", () => {
    // startDate Mon 2026-07-06; today the 15th → first due Mon 2026-07-20.
    expect(
      occurrenceKey(
        firstDueDate(utc("2026-07-06"), "weekly", 6, utc("2026-07-15"))
      )
    ).toBe("2026-07-20");
  });
});

describe("dueOccurrences", () => {
  it("returns nothing when the next due date is still in the future", () => {
    const due = dueOccurrences(
      { nextDueDate: utc("2026-08-05"), frequency: "monthly", anchorDay: 5 },
      utc("2026-07-14")
    );
    expect(due).toHaveLength(0);
  });

  it("returns a single occurrence due today", () => {
    const due = dueOccurrences(
      { nextDueDate: utc("2026-07-20"), frequency: "monthly", anchorDay: 20 },
      utc("2026-07-21")
    );
    expect(due.map(occurrenceKey)).toEqual(["2026-07-20"]);
  });

  // Scenario 4: catching up after two months away yields one occurrence each.
  it("lists every overdue occurrence when the app wasn't opened for months", () => {
    const due = dueOccurrences(
      { nextDueDate: utc("2026-06-05"), frequency: "monthly", anchorDay: 5 },
      utc("2026-07-14")
    );
    expect(due.map(occurrenceKey)).toEqual(["2026-06-05", "2026-07-05"]);
  });

  it("stops at endDate and never generates past it (FR-009)", () => {
    const due = dueOccurrences(
      {
        nextDueDate: utc("2026-05-05"),
        frequency: "monthly",
        anchorDay: 5,
        endDate: utc("2026-06-05"),
      },
      utc("2026-08-14")
    );
    expect(due.map(occurrenceKey)).toEqual(["2026-05-05", "2026-06-05"]);
  });

  // A mistyped startDate (year 1900) must not try to generate 1500 occurrences.
  it("honours a safety cap against a runaway backlog", () => {
    const due = dueOccurrences(
      { nextDueDate: utc("1900-01-05"), frequency: "monthly", anchorDay: 5 },
      utc("2026-07-14"),
      60
    );
    expect(due).toHaveLength(60);
  });
});
