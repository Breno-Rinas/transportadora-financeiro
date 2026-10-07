import { describe, expect, it } from 'vitest';
import type { DomainErrorCode } from '../errors.js';
import type { TripFacts } from './facts.js';
import {
  buildLoadingTitles,
  getBalanceDueDate,
  shouldGenerateTitles,
  type LoadingTitlesInput,
} from './title-generation.js';

const withCode = (code: DomainErrorCode) => expect.objectContaining({ code });
const SAO_PAULO = 'America/Sao_Paulo';

const NOTHING_REGISTERED: TripFacts = {
  cteIssuedAt: null,
  loadingPhotoAt: null,
  unloadedAt: null,
  proofsReceivedAt: null,
  advanceStatus: null,
  balanceStatus: null,
  cancelledAt: null,
  advanceRecoveryStatus: null,
};

// CT-e emitido às 22h de 11/03 em São Paulo (já 12/03 em UTC); foto às 09h de 12/03.
const CTE_AT = new Date('2026-03-12T01:00:00Z');
const PHOTO_AT = new Date('2026-03-12T12:00:00Z');

/** Critério de aceite: cliente R$ 5.000,00 com prazo de 30 dias; motorista R$ 3.333,33 a 70%. */
const acceptanceInput = (facts: TripFacts): LoadingTitlesInput => ({
  facts,
  cte: { issuedAt: CTE_AT, clientFreightCents: 500000 },
  clientPaymentTermDays: 30,
  agreement: { driverFreightCents: 333333, advancePercent: 70 },
  timeZone: SAO_PAULO,
});

describe('shouldGenerateTitles (R1)', () => {
  it('só com o CT-e ou só com a foto, nada é gerado', () => {
    expect(shouldGenerateTitles({ ...NOTHING_REGISTERED, cteIssuedAt: CTE_AT })).toBe(false);
    expect(shouldGenerateTitles({ ...NOTHING_REGISTERED, loadingPhotoAt: PHOTO_AT })).toBe(false);
  });

  it('com CT-e e foto, em qualquer ordem, gera', () => {
    const loaded = { ...NOTHING_REGISTERED, cteIssuedAt: CTE_AT, loadingPhotoAt: PHOTO_AT };
    expect(shouldGenerateTitles(loaded)).toBe(true);
  });

  it('não gera de novo quando os títulos já existem', () => {
    const withTitles: TripFacts = {
      ...NOTHING_REGISTERED,
      cteIssuedAt: CTE_AT,
      loadingPhotoAt: PHOTO_AT,
      advanceStatus: 'OPEN',
      balanceStatus: 'OPEN',
    };
    expect(shouldGenerateTitles(withTitles)).toBe(false);
  });

  it('viagem cancelada não gera títulos (R13)', () => {
    const cancelled: TripFacts = {
      ...NOTHING_REGISTERED,
      cteIssuedAt: CTE_AT,
      loadingPhotoAt: PHOTO_AT,
      cancelledAt: PHOTO_AT,
    };
    expect(shouldGenerateTitles(cancelled)).toBe(false);
  });
});

describe('buildLoadingTitles (R2/R3)', () => {
  it('gera a receber, adiantamento e saldo com valores e vencimentos', () => {
    const facts = { ...NOTHING_REGISTERED, cteIssuedAt: CTE_AT, loadingPhotoAt: PHOTO_AT };

    expect(buildLoadingTitles(acceptanceInput(facts))).toEqual([
      // 11/03 (data de negócio da emissão) + 30 dias
      {
        nature: 'RECEIVABLE',
        kind: 'CLIENT_FREIGHT',
        amountCents: 500000,
        dueDate: '2026-04-10',
        status: 'OPEN',
      },
      // carregamento = foto, a mais tarde
      {
        nature: 'PAYABLE',
        kind: 'ADVANCE',
        amountCents: 233333,
        dueDate: '2026-03-12',
        status: 'OPEN',
      },
      { nature: 'PAYABLE', kind: 'BALANCE', amountCents: 100000, dueDate: null, status: 'OPEN' },
    ]);
  });

  it('com a foto antes do CT-e, o adiantamento vence na data de negócio do CT-e', () => {
    const photoFirst = {
      ...NOTHING_REGISTERED,
      loadingPhotoAt: new Date('2026-03-10T12:00:00Z'),
      cteIssuedAt: CTE_AT,
    };

    const [, advance] = buildLoadingTitles(acceptanceInput(photoFirst));
    expect(advance.dueDate).toBe('2026-03-11');
  });

  it('exige CT-e e foto registrados', () => {
    const onlyCte = { ...NOTHING_REGISTERED, cteIssuedAt: CTE_AT };
    expect(() => buildLoadingTitles(acceptanceInput(onlyCte))).toThrow(withCode('TRIP_NOT_LOADED'));
  });

  it('recusa prazo do cliente negativo', () => {
    const facts = { ...NOTHING_REGISTERED, cteIssuedAt: CTE_AT, loadingPhotoAt: PHOTO_AT };
    const input = { ...acceptanceInput(facts), clientPaymentTermDays: -1 };
    expect(() => buildLoadingTitles(input)).toThrow(withCode('VALIDATION_ERROR'));
  });
});

describe('getBalanceDueDate (R3)', () => {
  it('o saldo vence na data de negócio da chegada dos comprovantes', () => {
    expect(getBalanceDueDate(new Date('2026-03-20T02:30:00Z'), SAO_PAULO)).toBe('2026-03-19');
  });
});
