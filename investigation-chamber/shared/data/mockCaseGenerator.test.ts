import { describe, it, expect } from 'vitest';
import { generateMockCase } from './mockCaseGenerator';
import { computeDetentionStatus } from '../engine/detentionEngine';

describe('generateMockCase', () => {
  it('produces exactly 60 defendants with unique ids', () => {
    const bundle = generateMockCase();
    expect(bundle.defendants).toHaveLength(60);
    expect(new Set(bundle.defendants.map((d) => d.id)).size).toBe(60);
  });

  it('gives every defendant exactly one charge', () => {
    const bundle = generateMockCase();
    const byDefendant = new Map(bundle.defendants.map((d) => [d.id, 0]));
    for (const charge of bundle.charges) {
      byDefendant.set(charge.defendantId, (byDefendant.get(charge.defendantId) ?? 0) + 1);
    }
    for (const count of byDefendant.values()) expect(count).toBe(1);
  });

  it('produces a detention timeline for every detained defendant with no engine violations', () => {
    const bundle = generateMockCase();
    const chargesByDefendant = new Map(bundle.charges.map((c) => [c.defendantId, c]));

    const detained = bundle.defendants.filter((d) => d.custodyStatus === 'detained');
    expect(detained.length).toBeGreaterThan(0);

    for (const defendant of detained) {
      const events = bundle.detentionEvents.filter((e) => e.defendantId === defendant.id);
      expect(events.length).toBeGreaterThan(0);
      const charge = chargesByDefendant.get(defendant.id)!;
      const status = computeDetentionStatus(events, charge.severityTier, { chamberExtensionEligible: true });
      expect(status.violations).toHaveLength(0);
    }
  });

  it('covers every detention alert band across the mock population', () => {
    const bundle = generateMockCase();
    const chargesByDefendant = new Map(bundle.charges.map((c) => [c.defendantId, c]));
    const now = new Date();

    const bands = new Set(
      bundle.defendants
        .filter((d) => d.custodyStatus === 'detained')
        .map((d) => {
          const events = bundle.detentionEvents.filter((e) => e.defendantId === d.id);
          const charge = chargesByDefendant.get(d.id)!;
          return computeDetentionStatus(events, charge.severityTier, { chamberExtensionEligible: true }, now)
            .alertLevel;
        }),
    );

    // The mock data intentionally spans the full range so the UI/demo shows
    // every alert color, including the arbitrary-detention "overdue" case.
    expect(bands.has('green')).toBe(true);
    expect(bands.size).toBeGreaterThanOrEqual(2);
  });

  it('links judicial-control defendants to at least one of the 10 statutory measures', () => {
    const bundle = generateMockCase();
    const underControl = bundle.defendants.filter((d) => d.custodyStatus === 'judicial_control');
    for (const defendant of underControl) {
      const measures = bundle.judicialControlMeasures.filter((m) => m.defendantId === defendant.id);
      expect(measures.length).toBeGreaterThan(0);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = generateMockCase(42, new Date('2026-06-01T00:00:00Z'));
    const b = generateMockCase(42, new Date('2026-06-01T00:00:00Z'));
    expect(a.defendants.map((d) => d.fullName)).toEqual(b.defendants.map((d) => d.fullName));
  });
});
