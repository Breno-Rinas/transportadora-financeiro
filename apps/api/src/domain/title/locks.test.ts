import { describe, expect, it } from 'vitest';
import type { TripFacts } from '../trip/facts.js';
import { getTitleLocks } from './locks.js';

const LOADED: TripFacts = {
  cteIssuedAt: new Date('2026-03-10T12:00:00Z'),
  loadingPhotoAt: new Date('2026-03-10T13:00:00Z'),
  unloadedAt: null,
  proofsReceivedAt: null,
  advanceStatus: 'OPEN',
  balanceStatus: 'OPEN',
};
const UNLOADED: TripFacts = { ...LOADED, unloadedAt: new Date('2026-03-12T10:00:00Z') };
const PROOFS_RECEIVED: TripFacts = {
  ...UNLOADED,
  proofsReceivedAt: new Date('2026-03-14T10:00:00Z'),
};

const BALANCE = { kind: 'BALANCE' } as const;

describe('getTitleLocks (R4/R5)', () => {
  it('adiantamento e frete do cliente não têm travas', () => {
    const unlocked = { canSchedule: true, canSettle: true, reasons: [] };
    expect(getTitleLocks({ kind: 'ADVANCE' }, LOADED)).toEqual(unlocked);
    expect(getTitleLocks({ kind: 'CLIENT_FREIGHT' }, LOADED)).toEqual(unlocked);
  });

  it('saldo antes da descarga: três motivos, nada permitido', () => {
    expect(getTitleLocks(BALANCE, LOADED)).toEqual({
      canSchedule: false,
      canSettle: false,
      reasons: [
        { code: 'NOT_UNLOADED', message: 'Aguardando registro da descarga' },
        { code: 'PROOFS_NOT_RECEIVED', message: 'Aguardando chegada do canhoto original do CT-e' },
        {
          code: 'ADVANCE_NOT_PAID',
          message: 'O saldo só pode ser pago após a baixa do adiantamento',
        },
      ],
    });
  });

  it('descarregado sem comprovante: o saldo continua travado', () => {
    const locks = getTitleLocks(BALANCE, { ...UNLOADED, advanceStatus: 'PAID' });

    expect(locks.canSchedule).toBe(false);
    expect(locks.canSettle).toBe(false);
    expect(locks.reasons.map((reason) => reason.code)).toEqual(['PROOFS_NOT_RECEIVED']);
  });

  it('adiantamento não pago trava só a baixa: a programação continua permitida', () => {
    const locks = getTitleLocks(BALANCE, PROOFS_RECEIVED);

    expect(locks.canSchedule).toBe(true);
    expect(locks.canSettle).toBe(false);
    expect(locks.reasons.map((reason) => reason.code)).toEqual(['ADVANCE_NOT_PAID']);
  });

  it('com comprovante e adiantamento pago, o saldo está liberado', () => {
    expect(getTitleLocks(BALANCE, { ...PROOFS_RECEIVED, advanceStatus: 'PAID' })).toEqual({
      canSchedule: true,
      canSettle: true,
      reasons: [],
    });
  });
});
