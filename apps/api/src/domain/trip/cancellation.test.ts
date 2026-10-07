import { describe, expect, it } from 'vitest';
import type { DomainErrorCode } from '../errors.js';
import type { TitleKind, TitleStatus } from '../title/types.js';
import {
  assertTripCanBeCancelled,
  buildAdvanceRecovery,
  getCancellationStatusChange,
  planTripCancellation,
  selectTitlesToCancel,
  type CancellationTitle,
} from './cancellation.js';
import type { TripFacts } from './facts.js';
import type { TripStatus } from './types.js';

const withCode = (code: DomainErrorCode) => expect.objectContaining({ code });
const SAO_PAULO = 'America/Sao_Paulo';
const NOW = new Date('2026-03-20T15:00:00Z');

const LOADED: TripFacts = {
  cteIssuedAt: new Date('2026-03-18T12:00:00Z'),
  loadingPhotoAt: new Date('2026-03-18T13:00:00Z'),
  unloadedAt: null,
  proofsReceivedAt: null,
  advanceStatus: 'OPEN',
  balanceStatus: 'OPEN',
  cancelledAt: null,
  advanceRecoveryStatus: null,
};

const title = (
  id: string,
  kind: TitleKind,
  status: TitleStatus,
  amountCents: number,
): CancellationTitle & { id: string } => ({ id, kind, status, amountCents });

/** Títulos do critério de aceite: cliente R$ 5.000,00; motorista R$ 3.333,33 a 70%. */
const titlesWith = (advanceStatus: TitleStatus) => [
  title('client', 'CLIENT_FREIGHT', 'OPEN', 500000),
  title('advance', 'ADVANCE', advanceStatus, 233333),
  title('balance', 'BALANCE', 'OPEN', 100000),
];

describe('assertTripCanBeCancelled (R13)', () => {
  it.each<TripStatus>(['CREATED', 'LOADED', 'ADVANCE_PAID', 'UNLOADED', 'PROOFS_RECEIVED'])(
    'viagem em %s pode ser cancelada',
    (status) => {
      expect(() => assertTripCanBeCancelled(status)).not.toThrow();
    },
  );

  it('viagem finalizada (saldo pago) dá TRIP_ALREADY_FINISHED', () => {
    expect(() => assertTripCanBeCancelled('BALANCE_PAID')).toThrow(
      withCode('TRIP_ALREADY_FINISHED'),
    );
  });

  it('viagem já cancelada dá TRIP_CANCELLED', () => {
    expect(() => assertTripCanBeCancelled('CANCELLED')).toThrow(withCode('TRIP_CANCELLED'));
  });
});

describe('selectTitlesToCancel (R13)', () => {
  it('cancela os títulos em aberto, programados ou não, e mantém os pagos como histórico', () => {
    const titles = [
      title('client', 'CLIENT_FREIGHT', 'PAID', 500000),
      title('advance', 'ADVANCE', 'SCHEDULED', 233333),
      title('balance', 'BALANCE', 'OPEN', 100000),
    ];
    expect(selectTitlesToCancel(titles).map((candidate) => candidate.id)).toEqual([
      'advance',
      'balance',
    ]);
  });
});

describe('buildAdvanceRecovery (R13)', () => {
  it('adiantamento pago vira a receber do motorista, com o mesmo valor, vencendo no cancelamento', () => {
    // 22h de 19/03 em São Paulo (já 20/03 em UTC): a data de negócio é 19/03.
    const cancelledAt = new Date('2026-03-20T01:00:00Z');
    expect(buildAdvanceRecovery(titlesWith('PAID'), cancelledAt, SAO_PAULO)).toEqual({
      nature: 'RECEIVABLE',
      kind: 'ADVANCE_RECOVERY',
      amountCents: 233333,
      dueDate: '2026-03-19',
      status: 'OPEN',
    });
  });

  it('sem adiantamento pago (em aberto, programado ou sem títulos), nada a recuperar', () => {
    expect(buildAdvanceRecovery(titlesWith('OPEN'), NOW, SAO_PAULO)).toBeNull();
    expect(buildAdvanceRecovery(titlesWith('SCHEDULED'), NOW, SAO_PAULO)).toBeNull();
    expect(buildAdvanceRecovery([], NOW, SAO_PAULO)).toBeNull();
  });
});

describe('getCancellationStatusChange (R13)', () => {
  it('leva a viagem a CANCELLED com o gatilho TRIP_CANCELLED, de onde ela estiver', () => {
    expect(getCancellationStatusChange('UNLOADED')).toEqual({
      from: 'UNLOADED',
      to: 'CANCELLED',
      trigger: 'TRIP_CANCELLED',
    });
  });
});

describe('planTripCancellation (R13)', () => {
  const plan = (status: TripStatus, facts: TripFacts, advanceStatus: TitleStatus, at = NOW) =>
    planTripCancellation({
      trip: { status, facts },
      titles: titlesWith(advanceStatus),
      cancelledAt: at,
      now: NOW,
      timeZone: SAO_PAULO,
    });

  it('com o adiantamento em aberto: cancela os três títulos e não gera recuperação', () => {
    const result = plan('LOADED', LOADED, 'OPEN');

    expect(result.titlesToCancel.map((candidate) => candidate.id)).toEqual([
      'client',
      'advance',
      'balance',
    ]);
    expect(result.advanceRecovery).toBeNull();
    expect(result.statusChange).toEqual({
      from: 'LOADED',
      to: 'CANCELLED',
      trigger: 'TRIP_CANCELLED',
    });
  });

  it('com o adiantamento pago: cancela o resto e gera a recuperação', () => {
    const result = plan('ADVANCE_PAID', { ...LOADED, advanceStatus: 'PAID' }, 'PAID');

    expect(result.titlesToCancel.map((candidate) => candidate.id)).toEqual(['client', 'balance']);
    expect(result.advanceRecovery).toMatchObject({
      kind: 'ADVANCE_RECOVERY',
      amountCents: 233333,
      dueDate: '2026-03-20',
    });
  });

  it('recusa viagem finalizada e data inválida', () => {
    expect(() => plan('BALANCE_PAID', LOADED, 'PAID')).toThrow(withCode('TRIP_ALREADY_FINISHED'));
    expect(() => plan('LOADED', LOADED, 'OPEN', new Date(NOW.getTime() + 1))).toThrow(
      withCode('INVALID_EVENT_DATE'),
    );
    expect(() => plan('LOADED', LOADED, 'OPEN', new Date('2026-03-18T12:30:00Z'))).toThrow(
      withCode('INVALID_EVENT_DATE'),
    );
  });
});
