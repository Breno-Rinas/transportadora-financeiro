import { describe, expect, it } from 'vitest';
import { fromDbDate, fromNullableDbDate, toDbDate, toNullableDbDate } from './db-date.js';

describe('conversão LocalDate <-> coluna @db.Date', () => {
  it('grava à meia-noite UTC, sem deslocar o dia pelo fuso', () => {
    expect(toDbDate('2026-03-12').toISOString()).toBe('2026-03-12T00:00:00.000Z');
  });

  it('lê pelo calendário UTC, como o Prisma entrega a coluna', () => {
    expect(fromDbDate(new Date('2026-03-12T00:00:00.000Z'))).toBe('2026-03-12');
  });

  it('ida e volta preservam a data, inclusive em virada de ano e 29/02', () => {
    for (const date of ['2026-01-01', '2026-03-12', '2026-12-31', '2028-02-29']) {
      expect(fromDbDate(toDbDate(date))).toBe(date);
    }
  });

  it('aceita nulo nas colunas opcionais', () => {
    expect(toNullableDbDate(null)).toBeNull();
    expect(fromNullableDbDate(null)).toBeNull();
  });

  it('recusa data inexistente', () => {
    expect(() => toDbDate('2026-02-30')).toThrow(expect.objectContaining({ code: 'INVALID_DATE' }));
  });
});
