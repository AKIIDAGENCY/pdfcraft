import { describe, it, expect } from 'vitest';
import { renderOrderHtml } from './templates';

const BASE_CASE = { caseNumber: '12/2026', title: 'قضية تجريبية', legalQualifications: ['تمويل الإرهاب'] };

describe('renderOrderHtml — HTML escaping of free-text fields', () => {
  it('escapes a script tag typed into the judge name', () => {
    const html = renderOrderHtml('DETENTION_ORDER', {
      theCase: BASE_CASE,
      judgeName: '<script>alert(1)</script>',
      issueDate: new Date('2026-01-01'),
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes an injected tag in the defendant full name', () => {
    const html = renderOrderHtml('DETENTION_ORDER', {
      theCase: BASE_CASE,
      defendant: { fullName: '<img src=x onerror=alert(1)>', nationalId: '1', nationality: 'جزائرية', dateOfBirth: '2000-01-01', role: 'principal' },
      judgeName: 'قاضي',
      issueDate: new Date('2026-01-01'),
    });
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img');
  });

  it('escapes the case number and legal qualifications', () => {
    const html = renderOrderHtml('CASE_REFERRAL_ORDER', {
      theCase: { caseNumber: '"><script>x</script>', title: 't', legalQualifications: ['<b>x</b>'] },
      judgeName: 'قاضي',
      issueDate: new Date('2026-01-01'),
    });
    expect(html).not.toContain('<script>x</script>');
    expect(html).not.toContain('<b>x</b>');
  });

  it('escapes extraLines (judicial-control measures annex)', () => {
    const html = renderOrderHtml('JUDICIAL_CONTROL_ORDER', {
      theCase: BASE_CASE,
      judgeName: 'قاضي',
      issueDate: new Date('2026-01-01'),
      extraLines: ['<script>evil()</script>'],
    });
    expect(html).not.toContain('<script>evil()</script>');
  });
});
