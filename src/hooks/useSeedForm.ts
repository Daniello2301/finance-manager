"use client";

import { useEffect, useRef } from "react";

interface SeedFormOptions {
  /** Whether the modal holding the form is open. */
  isOpen: boolean;
  /** What the form is being seeded FOR: a record id, or something like "create". */
  target: string;
  /**
   * False while the record being edited hasn't arrived from the cache yet.
   * Without it the form would be seeded once, with nothing, and — because
   * seeding happens only once per target — never corrected.
   */
  ready?: boolean;
  /** Fills the form. Called exactly once per open/target, never on a refetch. */
  seed: () => void;
}

/**
 * Seeds a react-hook-form once per (open, target) instead of on every render
 * its inputs happen to change on.
 *
 * These forms read their initial values out of a React Query cache that has no
 * `staleTime`, so a plain `useEffect(() => reset(...), [editingX])` re-fires on
 * every background refetch: the query hands back a fresh array, `find(...)`
 * yields a new object identity even when the data is byte-for-byte identical,
 * and `reset()` wipes whatever the user was in the middle of typing — in create
 * mode too, where there is nothing to re-seed from in the first place.
 */
export function useSeedForm({ isOpen, target, ready = true, seed }: SeedFormOptions): void {
  const seededFor = useRef<string | null>(null);

  // The caller's `seed` closure is a new function on every render. Keeping it
  // in a ref lets the seeding effect depend only on what should actually
  // re-trigger it, instead of forcing every caller to useCallback.
  const seedRef = useRef(seed);
  useEffect(() => {
    seedRef.current = seed;
  });

  useEffect(() => {
    if (!isOpen) {
      seededFor.current = null;
      return;
    }
    if (!ready || seededFor.current === target) return;

    seedRef.current();
    seededFor.current = target;
  }, [isOpen, target, ready]);
}
