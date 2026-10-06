import { describe, expect, it } from 'vitest';
import { calculateTripMargin, percentOf, type MarginTitle } from './margin.js';

const titles = (clientCents: number, advanceCents: number, balanceCents: number): MarginTitle[] => [
  { kind: 'CLIENT_FREIGHT', status: 'OPEN', amountCents: clientCents },
  { kind: 'ADVANCE', status: 'PAID', amountCents: advanceCents },
  { kind: 'BALANCE', status: 'OPEN', amountCents: balanceCents },
];

describe('calculateTripMargin (R7)', () => {
  it('com títulos, a margem é realizada: frete do cliente − (adiantamento + saldo)', () => {
    const margin = calculateTripMargin({
      titles: titles(500000, 233333, 100000),
      quotedClientFreightCents: 450000,
      driverFreightCents: 333333,
    });

    expect(margin).toEqual({
      kind: 'REALIZED',
      amountCents: 166667,
      percent: 33.33,
      isNegative: false,
    });
  });

  it('sinaliza margem negativa quando o motorista custa mais que o frete do cliente', () => {
    const margin = calculateTripMargin({
      titles: titles(300000, 233333, 100000),
      quotedClientFreightCents: null,
      driverFreightCents: 333333,
    });

    expect(margin).toEqual({
      kind: 'REALIZED',
      amountCents: -33333,
      percent: -11.11,
      isNegative: true,
    });
  });

  it('ignora títulos cancelados', () => {
    const withCancelled: MarginTitle[] = [
      ...titles(500000, 233333, 100000),
      { kind: 'BALANCE', status: 'CANCELLED', amountCents: 999999 },
    ];

    const margin = calculateTripMargin({
      titles: withCancelled,
      quotedClientFreightCents: null,
      driverFreightCents: 333333,
    });

    expect(margin?.amountCents).toBe(166667);
  });

  it('sem títulos, com frete cotado, a margem é projetada', () => {
    const margin = calculateTripMargin({
      titles: [],
      quotedClientFreightCents: 300000,
      driverFreightCents: 333333,
    });

    expect(margin).toEqual({
      kind: 'PROJECTED',
      amountCents: -33333,
      percent: -11.11,
      isNegative: true,
    });
  });

  it('sem títulos e sem frete cotado, não há margem', () => {
    expect(
      calculateTripMargin({
        titles: [],
        quotedClientFreightCents: null,
        driverFreightCents: 333333,
      }),
    ).toBeNull();
  });
});

describe('percentOf', () => {
  it('arredonda em 2 casas, com meio ponto-base afastando do zero', () => {
    expect(percentOf(1, 20000)).toBe(0.01);
    expect(percentOf(-1, 20000)).toBe(-0.01);
    expect(percentOf(1, 30000)).toBe(0);
    expect(percentOf(-1, 30000)).toBe(0);
  });

  it('sem base positiva, não há percentual', () => {
    expect(percentOf(-50000, 0)).toBeNull();
  });
});
