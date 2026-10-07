import { describe, expect, it } from 'vitest';
import { getTitleCounterparty, getTitleStatusLabel, TITLE_KIND_LABELS } from './labels.js';

describe('rótulos dos títulos', () => {
  it('o frete é acertado com o cliente; adiantamento, saldo e recuperação, com o motorista', () => {
    expect(getTitleCounterparty('CLIENT_FREIGHT')).toBe('CLIENT');
    expect(getTitleCounterparty('ADVANCE')).toBe('DRIVER');
    expect(getTitleCounterparty('BALANCE')).toBe('DRIVER');
    expect(getTitleCounterparty('ADVANCE_RECOVERY')).toBe('DRIVER');
  });

  it('a recuperação do adiantamento tem nome próprio (R13)', () => {
    expect(TITLE_KIND_LABELS.ADVANCE_RECOVERY).toBe('Recuperação de adiantamento');
  });

  it('o a receber pago aparece como "Recebido"', () => {
    expect(getTitleStatusLabel('PAID', 'RECEIVABLE')).toBe('Recebido');
    expect(getTitleStatusLabel('PAID', 'PAYABLE')).toBe('Pago');
    expect(getTitleStatusLabel('CANCELLED', 'RECEIVABLE')).toBe('Cancelado');
  });
});
