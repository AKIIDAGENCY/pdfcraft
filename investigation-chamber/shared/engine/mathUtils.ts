/**
 * `Math.ceil` (and similarly `Math.round`/`Math.floor`) on a small negative
 * fraction yields `-0` (e.g. `Math.ceil(-0.3) === -0`). That's numerically
 * equal to 0 (`-0 === 0`), so alert-level branching on it is unaffected —
 * but `Intl.NumberFormat` renders `-0` with a visible minus sign, which
 * reads as "-0 days remaining" to a judge. Normalize it before display.
 */
export function normalizeZero(n: number): number {
  return n === 0 ? 0 : n;
}
