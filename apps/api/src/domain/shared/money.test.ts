import { describe, expect, it } from 'vitest';
import type { DomainErrorCode } from '../errors.js';
import { formatBRL, splitDriverFreight } from './money.js';

const withCode = (code: DomainErrorCode) => expect.objectContaining({ code });

describe('splitDriverFreight (R2)', () => {
  it('divide 333333 a 70% em 233333 de adiantamento e 100000 de saldo', () => {
    expect(splitDriverFreight(333333, 70)).toEqual({ advanceCents: 233333, balanceCents: 100000 });
  });

  it('divide 333333 a 50% arredondando o adiantamento para cima: 166667 + 166666', () => {
    expect(splitDriverFreight(333333, 50)).toEqual({ advanceCents: 166667, balanceCents: 166666 });
  });

  it('com 1 centavo, o meio centavo arredonda para cima e o saldo fica zerado', () => {
    expect(splitDriverFreight(1, 50)).toEqual({ advanceCents: 1, balanceCents: 0 });
    expect(splitDriverFreight(1, 70)).toEqual({ advanceCents: 1, balanceCents: 0 });
  });

  it('mantém adiantamento + saldo igual ao total para qualquer valor', () => {
    const totals = [2, 3, 7, 99, 100, 101, 12_345, 999_999, 2_147_483_647];
    for (let total = 1; total <= 5_000; total += 1) totals.push(total);

    for (const total of totals) {
      for (const percent of [50, 70]) {
        const { advanceCents, balanceCents } = splitDriverFreight(total, percent);
        expect(Number.isInteger(advanceCents)).toBe(true);
        expect(advanceCents + balanceCents).toBe(total);
      }
    }
  });

  it('recusa percentual diferente de 50% ou 70%', () => {
    expect(() => splitDriverFreight(100_000, 60)).toThrow(withCode('VALIDATION_ERROR'));
  });

  it.each([0, -100, 100.5, Number.NaN])('recusa total %s, que não é inteiro positivo', (total) => {
    expect(() => splitDriverFreight(total, 70)).toThrow(withCode('VALIDATION_ERROR'));
  });
});

describe('formatBRL', () => {
  it('formata centavos como reais', () => {
    expect(formatBRL(233333)).toBe('R$\u00a02.333,33');
  });
});
