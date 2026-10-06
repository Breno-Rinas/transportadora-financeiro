import { describe, expect, it } from 'vitest';
import type { TripFacts } from './facts.js';
import { advanceLifecycle } from './lifecycle.js';

const NOTHING_REGISTERED: TripFacts = {
  cteIssuedAt: null,
  loadingPhotoAt: null,
  unloadedAt: null,
  proofsReceivedAt: null,
  advanceStatus: null,
  balanceStatus: null,
};

const LOADED: TripFacts = {
  ...NOTHING_REGISTERED,
  cteIssuedAt: new Date('2026-03-10T12:00:00Z'),
  loadingPhotoAt: new Date('2026-03-10T13:00:00Z'),
  advanceStatus: 'OPEN',
  balanceStatus: 'OPEN',
};

/** Descarga e comprovantes registrados, adiantamento ainda não pago (roteiro de aceite). */
const PROOFS_BEFORE_ADVANCE: TripFacts = {
  ...LOADED,
  unloadedAt: new Date('2026-03-12T10:00:00Z'),
  proofsReceivedAt: new Date('2026-03-14T10:00:00Z'),
};

describe('advanceLifecycle (R8)', () => {
  it('com só o CT-e, a viagem continua CREATED', () => {
    const facts = { ...NOTHING_REGISTERED, cteIssuedAt: new Date('2026-03-10T12:00:00Z') };
    expect(advanceLifecycle('CREATED', facts)).toEqual({ status: 'CREATED', changes: [] });
  });

  it('com CT-e e foto, vai de CREATED para LOADED', () => {
    expect(advanceLifecycle('CREATED', LOADED)).toEqual({
      status: 'LOADED',
      changes: [{ from: 'CREATED', to: 'LOADED', trigger: 'CTE_AND_LOADING_PHOTO_REGISTERED' }],
    });
  });

  it('descarga e comprovantes antes da baixa do adiantamento não tiram a viagem de LOADED', () => {
    expect(advanceLifecycle('LOADED', PROOFS_BEFORE_ADVANCE)).toEqual({
      status: 'LOADED',
      changes: [],
    });
  });

  it('a baixa do adiantamento recupera as etapas atrasadas, uma transição por vez', () => {
    const facts: TripFacts = { ...PROOFS_BEFORE_ADVANCE, advanceStatus: 'PAID' };

    expect(advanceLifecycle('LOADED', facts)).toEqual({
      status: 'PROOFS_RECEIVED',
      changes: [
        { from: 'LOADED', to: 'ADVANCE_PAID', trigger: 'ADVANCE_SETTLED' },
        { from: 'ADVANCE_PAID', to: 'UNLOADED', trigger: 'UNLOADING_REGISTERED' },
        { from: 'UNLOADED', to: 'PROOFS_RECEIVED', trigger: 'PROOFS_REGISTERED' },
      ],
    });
  });

  it('a baixa do saldo finaliza a viagem em BALANCE_PAID', () => {
    const facts: TripFacts = {
      ...PROOFS_BEFORE_ADVANCE,
      advanceStatus: 'PAID',
      balanceStatus: 'PAID',
    };

    expect(advanceLifecycle('PROOFS_RECEIVED', facts)).toEqual({
      status: 'BALANCE_PAID',
      changes: [{ from: 'PROOFS_RECEIVED', to: 'BALANCE_PAID', trigger: 'BALANCE_SETTLED' }],
    });
  });

  it('é idempotente e não sai de BALANCE_PAID nem de CANCELLED', () => {
    const finished: TripFacts = {
      ...PROOFS_BEFORE_ADVANCE,
      advanceStatus: 'PAID',
      balanceStatus: 'PAID',
    };

    expect(advanceLifecycle('BALANCE_PAID', finished)).toEqual({
      status: 'BALANCE_PAID',
      changes: [],
    });
    expect(advanceLifecycle('CANCELLED', finished)).toEqual({ status: 'CANCELLED', changes: [] });
  });
});
