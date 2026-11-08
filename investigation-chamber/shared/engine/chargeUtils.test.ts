import { describe, it, expect } from 'vitest';
import { selectGoverningCharge } from './chargeUtils';

describe('selectGoverningCharge', () => {
  it('returns null for no charges', () => {
    expect(selectGoverningCharge([])).toBeNull();
  });

  it('returns the single charge when there is only one', () => {
    const ordinary = { severityTier: 'ordinary' as const, id: 'a' };
    expect(selectGoverningCharge([ordinary])).toBe(ordinary);
  });

  it('picks the aggravated charge even when it is not first', () => {
    const first = { severityTier: 'ordinary' as const, id: 'a' };
    const second = { severityTier: 'aggravated' as const, id: 'b' };
    expect(selectGoverningCharge([first, second])).toBe(second);
  });

  it('picks the aggravated charge when it is first', () => {
    const first = { severityTier: 'aggravated' as const, id: 'a' };
    const second = { severityTier: 'ordinary' as const, id: 'b' };
    expect(selectGoverningCharge([first, second])).toBe(first);
  });

  it('falls back to the first charge when none are aggravated', () => {
    const first = { severityTier: 'ordinary' as const, id: 'a' };
    const second = { severityTier: 'ordinary' as const, id: 'b' };
    expect(selectGoverningCharge([first, second])).toBe(first);
  });
});
