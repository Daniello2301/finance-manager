import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import { useSeedForm } from "@/hooks/useSeedForm";

describe("useSeedForm", () => {
  it("seeds once when the form opens", () => {
    const seed = vi.fn();
    renderHook(() => useSeedForm({ isOpen: true, target: "create", seed }));

    expect(seed).toHaveBeenCalledTimes(1);
  });

  it("does not seed while the form is closed", () => {
    const seed = vi.fn();
    renderHook(() => useSeedForm({ isOpen: false, target: "create", seed }));

    expect(seed).not.toHaveBeenCalled();
  });

  // The bug this hook exists for. The old `useEffect(..., [editingX])` re-fired
  // whenever React Query refetched in the background: the query hands back a
  // fresh array, so `find(...)` is a new object identity even when nothing
  // changed, and reset() wiped whatever was half-typed.
  it("does not re-seed when the seed closure changes identity on a re-render", () => {
    const seed = vi.fn();
    const { rerender } = renderHook(
      ({ s }: { s: () => void }) =>
        useSeedForm({ isOpen: true, target: "acc-1", seed: s }),
      { initialProps: { s: seed } }
    );

    // A background refetch: same data, brand-new closure over a new object.
    rerender({ s: vi.fn(seed) });
    rerender({ s: vi.fn(seed) });

    expect(seed).toHaveBeenCalledTimes(1);
  });

  it("re-seeds when the target changes (editing a different record)", () => {
    const seed = vi.fn();
    const { rerender } = renderHook(
      ({ target }: { target: string }) =>
        useSeedForm({ isOpen: true, target, seed }),
      { initialProps: { target: "acc-1" } }
    );

    rerender({ target: "acc-2" });

    expect(seed).toHaveBeenCalledTimes(2);
  });

  it("re-seeds after a close/open cycle", () => {
    const seed = vi.fn();
    const { rerender } = renderHook(
      ({ isOpen }: { isOpen: boolean }) =>
        useSeedForm({ isOpen, target: "create", seed }),
      { initialProps: { isOpen: true } }
    );

    rerender({ isOpen: false });
    rerender({ isOpen: true });

    expect(seed).toHaveBeenCalledTimes(2);
  });

  // Opening "edit" before the record has arrived from the cache. Seeding then
  // would fill the form with nothing — and, since seeding happens once per
  // target, it would never be corrected once the record actually loaded.
  it("waits for ready before seeding, then seeds exactly once", () => {
    const seed = vi.fn();
    const { rerender } = renderHook(
      ({ ready }: { ready: boolean }) =>
        useSeedForm({ isOpen: true, target: "acc-1", ready, seed }),
      { initialProps: { ready: false } }
    );

    expect(seed).not.toHaveBeenCalled();

    rerender({ ready: true });
    expect(seed).toHaveBeenCalledTimes(1);

    rerender({ ready: true });
    expect(seed).toHaveBeenCalledTimes(1);
  });
});
