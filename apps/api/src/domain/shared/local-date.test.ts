import { describe, expect, it } from 'vitest';
import type { DomainErrorCode } from '../errors.js';
import {
  addDays,
  compareLocalDate,
  getMonthRange,
  isValidLocalDate,
  isWithinRange,
  startOfBusinessDay,
  toBusinessDate,
} from './local-date.js';

const withCode = (code: DomainErrorCode) => expect.objectContaining({ code });
const SAO_PAULO = 'America/Sao_Paulo';

describe('toBusinessDate', () => {
  it('2026-03-12T01:00Z ainda é 11/03 em São Paulo', () => {
    expect(toBusinessDate(new Date('2026-03-12T01:00:00Z'), SAO_PAULO)).toBe('2026-03-11');
  });

  it('vira o dia exatamente à meia-noite de São Paulo (03:00Z)', () => {
    expect(toBusinessDate(new Date('2026-03-12T02:59:59.999Z'), SAO_PAULO)).toBe('2026-03-11');
    expect(toBusinessDate(new Date('2026-03-12T03:00:00Z'), SAO_PAULO)).toBe('2026-03-12');
  });

  it('respeita o fuso informado', () => {
    expect(toBusinessDate(new Date('2026-03-12T01:00:00Z'), 'UTC')).toBe('2026-03-12');
  });
});

describe('isValidLocalDate', () => {
  it.each(['2026-03-12', '2028-02-29', '2026-12-31'])('aceita %s', (value) => {
    expect(isValidLocalDate(value)).toBe(true);
  });

  it.each([
    '2026-02-29',
    '2026-13-01',
    '2026-04-31',
    '2026-3-12',
    '12/03/2026',
    '2026-03-12T00:00',
  ])('recusa %s', (value) => {
    expect(isValidLocalDate(value)).toBe(false);
  });
});

describe('addDays', () => {
  it('atravessa fim de mês, de ano e o 29 de fevereiro', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-03-12', 0)).toBe('2026-03-12');
  });

  it('recusa data inexistente', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow(withCode('INVALID_DATE'));
  });
});

describe('compareLocalDate e isWithinRange', () => {
  it('ordena cronologicamente', () => {
    expect(compareLocalDate('2026-03-11', '2026-03-12')).toBeLessThan(0);
    expect(compareLocalDate('2026-03-12', '2026-03-12')).toBe(0);
    expect(compareLocalDate('2027-01-01', '2026-12-31')).toBeGreaterThan(0);
  });

  it('considera os dois limites do intervalo', () => {
    const march = { from: '2026-03-01', to: '2026-03-31' };
    expect(isWithinRange('2026-03-01', march)).toBe(true);
    expect(isWithinRange('2026-03-31', march)).toBe(true);
    expect(isWithinRange('2026-04-01', march)).toBe(false);
  });
});

describe('getMonthRange', () => {
  it('vai do primeiro ao último dia do mês, inclusive em ano bissexto', () => {
    expect(getMonthRange('2026-02-15')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(getMonthRange('2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(getMonthRange('2026-12-31')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });
});

describe('startOfBusinessDay', () => {
  it('12/03 começa às 03:00Z em São Paulo e à meia-noite em UTC', () => {
    expect(startOfBusinessDay('2026-03-12', SAO_PAULO).toISOString()).toBe(
      '2026-03-12T03:00:00.000Z',
    );
    expect(startOfBusinessDay('2026-03-12', 'UTC').toISOString()).toBe('2026-03-12T00:00:00.000Z');
  });

  it('é o inverso de toBusinessDate: o instante anterior ainda é o dia de antes', () => {
    for (const date of ['2026-01-01', '2026-03-12', '2026-10-06', '2026-12-31']) {
      const start = startOfBusinessDay(date, SAO_PAULO);
      expect(toBusinessDate(start, SAO_PAULO)).toBe(date);
      expect(toBusinessDate(new Date(start.getTime() - 1), SAO_PAULO)).toBe(addDays(date, -1));
    }
  });

  it('acompanha o horário de verão do fuso', () => {
    // Nova York: o horário de verão começa em 08/03/2026 às 02:00; a meia-noite ainda é -05:00.
    expect(startOfBusinessDay('2026-03-08', 'America/New_York').toISOString()).toBe(
      '2026-03-08T05:00:00.000Z',
    );
    expect(startOfBusinessDay('2026-03-09', 'America/New_York').toISOString()).toBe(
      '2026-03-09T04:00:00.000Z',
    );
  });

  it('num dia sem meia-noite (início do antigo horário de verão de SP), começa às 01:00', () => {
    // 04/11/2018: o relógio pulou de 00:00 para 01:00 (-02:00).
    expect(startOfBusinessDay('2018-11-04', SAO_PAULO).toISOString()).toBe(
      '2018-11-04T03:00:00.000Z',
    );
    // 17/02/2019: o horário de verão terminou à meia-noite e 16/02 teve 25 horas.
    expect(startOfBusinessDay('2019-02-17', SAO_PAULO).toISOString()).toBe(
      '2019-02-17T03:00:00.000Z',
    );
  });

  it('recusa data inexistente', () => {
    expect(() => startOfBusinessDay('2026-02-30', SAO_PAULO)).toThrow(withCode('INVALID_DATE'));
  });
});
