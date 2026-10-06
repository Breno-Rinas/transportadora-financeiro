import { describe, expect, it } from 'vitest';
import { classifyDueDate, getEffectiveDate, isOpenTitle } from './agenda.js';

const TODAY = '2026-03-20';

describe('getEffectiveDate (R10)', () => {
  it('a programação prevalece sobre o vencimento', () => {
    expect(getEffectiveDate({ scheduledFor: '2026-03-25', dueDate: '2026-03-18' })).toBe(
      '2026-03-25',
    );
  });

  it('sem programação, vale o vencimento; sem nenhum dos dois, não há data', () => {
    expect(getEffectiveDate({ scheduledFor: null, dueDate: '2026-03-18' })).toBe('2026-03-18');
    expect(getEffectiveDate({ scheduledFor: null, dueDate: null })).toBeNull();
  });
});

describe('classifyDueDate', () => {
  it.each([
    ['2026-03-19', 'OVERDUE'],
    ['2026-03-20', 'TODAY'],
    ['2026-03-21', 'WITHIN_WEEK'],
    ['2026-03-26', 'WITHIN_WEEK'],
    ['2026-03-27', 'LATER'],
    [null, 'NO_DATE'],
  ])('%s em relação a hoje (20/03) é %s', (date, bucket) => {
    expect(classifyDueDate(date, TODAY)).toBe(bucket);
  });
});

describe('isOpenTitle', () => {
  it('só OPEN e SCHEDULED estão em aberto', () => {
    expect(isOpenTitle('OPEN')).toBe(true);
    expect(isOpenTitle('SCHEDULED')).toBe(true);
    expect(isOpenTitle('PAID')).toBe(false);
    expect(isOpenTitle('CANCELLED')).toBe(false);
    expect(isOpenTitle(null)).toBe(false);
  });
});
