/**
 * Picks the charge that governs a defendant's detention-cap severity tier.
 *
 * Art. 204's aggravated bracket (3 judge renewals) applies if ANY charge
 * against the person is punishable by 20+ years, life, or death — not
 * whichever charge happens to be first in insertion order. `charges[0]`
 * with no ordering is wrong the moment a defendant has more than one
 * charge (a realistic outcome as a multi-year investigation develops).
 */
export function selectGoverningCharge<T extends { severityTier: 'aggravated' | 'ordinary' }>(
  charges: T[],
): T | null {
  if (charges.length === 0) return null;
  return charges.find((c) => c.severityTier === 'aggravated') ?? charges[0];
}
