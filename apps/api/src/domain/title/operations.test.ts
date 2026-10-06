import { describe, expect, it } from 'vitest';
import type { DomainErrorCode } from '../errors.js';
import type { TripFacts } from '../trip/facts.js';
import { assertCanSchedule, assertCanSettle, type OperableTitle } from './operations.js';

const withCode = (code: DomainErrorCode) => expect.objectContaining({ code });
const TODAY = '2026-03-20';

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

const ADVANCE: OperableTitle = {
  nature: 'PAYABLE',
  kind: 'ADVANCE',
  status: 'OPEN',
  amountCents: 233333,
};
const BALANCE: OperableTitle = {
  nature: 'PAYABLE',
  kind: 'BALANCE',
  status: 'OPEN',
  amountCents: 100000,
};
const CLIENT_FREIGHT: OperableTitle = {
  nature: 'RECEIVABLE',
  kind: 'CLIENT_FREIGHT',
  status: 'OPEN',
  amountCents: 500000,
};

describe('assertCanSchedule (R10)', () => {
  const schedule =
    (title: OperableTitle, facts: TripFacts, date = TODAY) =>
    () =>
      assertCanSchedule({ title, facts, date, today: TODAY });

  it('programa título a pagar para hoje ou depois, inclusive reprogramando', () => {
    expect(schedule(ADVANCE, LOADED)).not.toThrow();
    expect(schedule({ ...ADVANCE, status: 'SCHEDULED' }, LOADED, '2026-03-25')).not.toThrow();
  });

  it('só títulos a pagar podem ser programados', () => {
    expect(schedule(CLIENT_FREIGHT, LOADED)).toThrow(withCode('ONLY_PAYABLE_CAN_BE_SCHEDULED'));
  });

  it('título pago ou cancelado não pode ser programado', () => {
    expect(schedule({ ...ADVANCE, status: 'PAID' }, LOADED)).toThrow(
      withCode('TITLE_ALREADY_PAID'),
    );
    expect(schedule({ ...ADVANCE, status: 'CANCELLED' }, LOADED)).toThrow(
      withCode('TITLE_CANCELLED'),
    );
  });

  it('recusa data anterior a hoje ou inválida', () => {
    expect(schedule(ADVANCE, LOADED, '2026-03-19')).toThrow(withCode('INVALID_DATE'));
    expect(schedule(ADVANCE, LOADED, '2026-02-30')).toThrow(withCode('INVALID_DATE'));
  });

  it('saldo antes da descarga dá BALANCE_LOCKED listando os motivos', () => {
    expect(schedule(BALANCE, LOADED)).toThrow(
      expect.objectContaining({
        code: 'BALANCE_LOCKED',
        message:
          'O saldo está travado. Aguardando registro da descarga. ' +
          'Aguardando chegada do canhoto original do CT-e. ' +
          'O saldo só pode ser pago após a baixa do adiantamento.',
      }),
    );
  });

  it('saldo com comprovante pode ser programado mesmo sem o adiantamento pago', () => {
    expect(schedule(BALANCE, PROOFS_RECEIVED)).not.toThrow();
  });
});

describe('assertCanSettle (R10/R5)', () => {
  const settle =
    (title: OperableTitle, facts: TripFacts, paidOn = TODAY, amountCents = title.amountCents) =>
    () =>
      assertCanSettle({ title, facts, paidOn, amountCents, today: TODAY });

  it('baixa integral de título em aberto, com pagamento até hoje', () => {
    expect(settle(ADVANCE, LOADED)).not.toThrow();
    expect(settle(CLIENT_FREIGHT, LOADED, '2026-03-01')).not.toThrow();
    expect(settle({ ...BALANCE, status: 'SCHEDULED' }, RELEASED)).not.toThrow();
  });

  it('título já pago dá TITLE_ALREADY_PAID', () => {
    expect(settle({ ...ADVANCE, status: 'PAID' }, LOADED)).toThrow(withCode('TITLE_ALREADY_PAID'));
  });

  it('valor diferente do título dá PARTIAL_PAYMENT_NOT_SUPPORTED', () => {
    expect(settle(ADVANCE, LOADED, TODAY, 100000)).toThrow(
      withCode('PARTIAL_PAYMENT_NOT_SUPPORTED'),
    );
  });

  it('recusa pagamento com data futura', () => {
    expect(settle(ADVANCE, LOADED, '2026-03-21')).toThrow(withCode('INVALID_DATE'));
  });

  it('saldo liberado mas com adiantamento em aberto dá ADVANCE_NOT_PAID', () => {
    expect(settle(BALANCE, PROOFS_RECEIVED)).toThrow(withCode('ADVANCE_NOT_PAID'));
  });

  it('saldo sem descarga ou comprovante dá BALANCE_LOCKED com todos os motivos', () => {
    expect(settle(BALANCE, LOADED)).toThrow(
      expect.objectContaining({
        code: 'BALANCE_LOCKED',
        details: {
          reasons: [
            expect.objectContaining({ code: 'NOT_UNLOADED' }),
            expect.objectContaining({ code: 'PROOFS_NOT_RECEIVED' }),
            expect.objectContaining({ code: 'ADVANCE_NOT_PAID' }),
          ],
        },
      }),
    );
  });
});
