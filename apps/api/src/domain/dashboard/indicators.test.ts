import { describe, expect, it } from 'vitest';
import type { DomainErrorCode } from '../errors.js';
import type { TripFacts } from '../trip/facts.js';
import type { MarginTitle } from '../trip/margin.js';
import {
  buildDashboard,
  resolveDashboardPeriod,
  type DashboardTitle,
  type DashboardTrip,
} from './indicators.js';

const withCode = (code: DomainErrorCode) => expect.objectContaining({ code });
const TODAY = '2026-03-20';
const MARCH = { from: '2026-03-01', to: '2026-03-31' };
const SAO_PAULO = 'America/Sao_Paulo';

const LOADED: TripFacts = {
  cteIssuedAt: new Date('2026-03-10T12:00:00Z'),
  loadingPhotoAt: new Date('2026-03-10T13:00:00Z'),
  unloadedAt: null,
  proofsReceivedAt: null,
  advanceStatus: 'OPEN',
  balanceStatus: 'OPEN',
};
const PROOFS_RECEIVED: TripFacts = {
  ...LOADED,
  unloadedAt: new Date('2026-03-12T10:00:00Z'),
  proofsReceivedAt: new Date('2026-03-14T10:00:00Z'),
};
const RELEASED: TripFacts = { ...PROOFS_RECEIVED, advanceStatus: 'PAID' };

const payable = (overrides: Partial<DashboardTitle>): DashboardTitle => ({
  nature: 'PAYABLE',
  kind: 'ADVANCE',
  status: 'OPEN',
  amountCents: 0,
  dueDate: null,
  scheduledFor: null,
  tripFacts: LOADED,
  ...overrides,
});
const receivable = (overrides: Partial<DashboardTitle>): DashboardTitle =>
  payable({ nature: 'RECEIVABLE', kind: 'CLIENT_FREIGHT', ...overrides });

const tripTitles = (clientCents: number, driverCents: number): MarginTitle[] => [
  { kind: 'CLIENT_FREIGHT', status: 'OPEN', amountCents: clientCents },
  { kind: 'ADVANCE', status: 'PAID', amountCents: driverCents },
];

describe('buildDashboard', () => {
  const titles: DashboardTitle[] = [
    payable({ amountCents: 100, dueDate: '2026-03-18' }),
    // Vencido, mas programado para depois de amanhã: a data efetiva é a programação.
    payable({
      amountCents: 200,
      status: 'SCHEDULED',
      dueDate: '2026-03-15',
      scheduledFor: '2026-03-22',
    }),
    payable({ amountCents: 400, dueDate: TODAY }),
    payable({ amountCents: 800, kind: 'BALANCE', tripFacts: LOADED }),
    payable({
      amountCents: 1600,
      kind: 'BALANCE',
      dueDate: '2026-03-30',
      tripFacts: PROOFS_RECEIVED,
    }),
    payable({ amountCents: 3200, kind: 'BALANCE', dueDate: '2026-03-26', tripFacts: RELEASED }),
    payable({ amountCents: 6400, status: 'PAID', dueDate: '2026-03-01' }),
    receivable({ amountCents: 10000, dueDate: '2026-03-10' }),
    receivable({ amountCents: 20000, dueDate: '2026-04-10' }),
    receivable({ amountCents: 40000, status: 'CANCELLED', dueDate: '2026-03-10' }),
  ];

  const dashboard = buildDashboard({
    today: TODAY,
    period: MARCH,
    timeZone: SAO_PAULO,
    titles,
    trips: [],
  });

  it('a pagar vencidos, vencendo hoje e na janela de 7 dias, pela data efetiva', () => {
    expect(dashboard.payableOverdue).toEqual({ count: 1, totalCents: 100 });
    expect(dashboard.payableDueToday).toEqual({ count: 1, totalCents: 400 });
    expect(dashboard.payableDueWeek).toEqual({ count: 3, totalCents: 200 + 400 + 3200 });
  });

  it('a receber em aberto, com a contagem dos vencidos', () => {
    expect(dashboard.receivableOpen).toEqual({ count: 2, totalCents: 30000, overdueCount: 1 });
  });

  it('saldos travados por qualquer motivo, inclusive só pelo adiantamento não pago', () => {
    expect(dashboard.lockedBalances).toEqual({ count: 2, totalCents: 800 + 1600 });
  });

  it('soma as margens realizadas das viagens com CT-e emitido no período, no fuso de negócio', () => {
    const trips: DashboardTrip[] = [
      { cteIssuedAt: new Date('2026-03-05T15:00:00Z'), titles: tripTitles(500000, 333333) },
      // 22h de 31/03 em São Paulo: entra em março.
      { cteIssuedAt: new Date('2026-04-01T01:00:00Z'), titles: tripTitles(300000, 333333) },
      // 23h de 28/02 em São Paulo: fica de fora.
      { cteIssuedAt: new Date('2026-03-01T02:00:00Z'), titles: tripTitles(100000, 1) },
      // CT-e sem foto: ainda não há margem realizada.
      { cteIssuedAt: new Date('2026-03-06T15:00:00Z'), titles: [] },
      { cteIssuedAt: null, titles: [] },
    ];

    const { margin } = buildDashboard({
      today: TODAY,
      period: MARCH,
      timeZone: SAO_PAULO,
      titles: [],
      trips,
    });

    // (166667 − 33333) / 800000 = 16,66675%
    expect(margin).toEqual({ amountCents: 133334, percent: 16.67 });
  });

  it('sem viagens no período, a margem é zero e sem percentual', () => {
    expect(dashboard.margin).toEqual({ amountCents: 0, percent: null });
  });
});

describe('resolveDashboardPeriod', () => {
  it('o padrão é o mês corrente', () => {
    expect(resolveDashboardPeriod('2026-02-15', {})).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
  });

  it('usa os limites informados', () => {
    expect(resolveDashboardPeriod(TODAY, { from: '2026-01-10', to: '2026-03-05' })).toEqual({
      from: '2026-01-10',
      to: '2026-03-05',
    });
  });

  it('recusa início depois do fim', () => {
    expect(() => resolveDashboardPeriod(TODAY, { from: '2026-04-01', to: '2026-03-31' })).toThrow(
      withCode('INVALID_DATE'),
    );
  });
});
