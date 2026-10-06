import { describe, expect, it } from 'vitest';
import type { TripFacts } from './facts.js';
import { getPendingSteps } from './pending-steps.js';

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
const UNLOADED: TripFacts = { ...LOADED, unloadedAt: new Date('2026-03-12T10:00:00Z') };
const PROOFS_RECEIVED: TripFacts = {
  ...UNLOADED,
  proofsReceivedAt: new Date('2026-03-14T10:00:00Z'),
};

const codesOf = (facts: TripFacts) => getPendingSteps(facts).map((step) => step.code);

describe('getPendingSteps', () => {
  it('viagem criada aguarda CT-e e foto, com a mensagem para o analista', () => {
    expect(getPendingSteps(NOTHING_REGISTERED)).toEqual([
      { code: 'CTE_PENDING', message: 'Aguardando emissão do CT-e' },
      { code: 'LOADING_PHOTO_PENDING', message: 'Aguardando foto do carregamento' },
    ]);
  });

  it('com só a foto, falta o CT-e', () => {
    expect(codesOf({ ...NOTHING_REGISTERED, loadingPhotoAt: LOADED.loadingPhotoAt })).toEqual([
      'CTE_PENDING',
    ]);
  });

  it('carregada: aguarda a baixa do adiantamento e a descarga', () => {
    expect(codesOf(LOADED)).toEqual(['ADVANCE_PAYMENT_PENDING', 'UNLOADING_PENDING']);
  });

  it('descarregada com adiantamento pago: aguarda o canhoto original', () => {
    expect(codesOf({ ...UNLOADED, advanceStatus: 'PAID' })).toEqual(['PROOFS_PENDING']);
  });

  it('comprovantes antes da baixa do adiantamento: adiantamento pendente e saldo já programável', () => {
    expect(codesOf(PROOFS_RECEIVED)).toEqual([
      'ADVANCE_PAYMENT_PENDING',
      'BALANCE_READY_TO_SCHEDULE',
    ]);
  });

  it('saldo programado aguarda o pagamento', () => {
    const scheduled: TripFacts = {
      ...PROOFS_RECEIVED,
      advanceStatus: 'PAID',
      balanceStatus: 'SCHEDULED',
    };
    expect(getPendingSteps(scheduled)).toEqual([
      { code: 'BALANCE_PAYMENT_PENDING', message: 'Aguardando pagamento do saldo' },
    ]);
  });

  it('viagem finalizada não tem pendências', () => {
    expect(
      getPendingSteps({ ...PROOFS_RECEIVED, advanceStatus: 'PAID', balanceStatus: 'PAID' }),
    ).toEqual([]);
  });
});
