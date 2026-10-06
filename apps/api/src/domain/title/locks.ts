import type { TripFacts } from '../trip/facts.js';
import type { TitleKind } from './types.js';

export type LockReasonCode = 'NOT_UNLOADED' | 'PROOFS_NOT_RECEIVED' | 'ADVANCE_NOT_PAID';

export interface LockReason {
  code: LockReasonCode;
  message: string;
}

export interface TitleLocks {
  canSchedule: boolean;
  canSettle: boolean;
  reasons: LockReason[];
}

interface BalanceLockRule extends LockReason {
  /** ADVANCE_NOT_PAID trava só a baixa (R5); a programação continua permitida. */
  blocksScheduling: boolean;
  isActive: (facts: TripFacts) => boolean;
}

const BALANCE_LOCK_RULES: readonly BalanceLockRule[] = [
  {
    code: 'NOT_UNLOADED',
    message: 'Aguardando registro da descarga',
    blocksScheduling: true,
    isActive: (facts) => facts.unloadedAt === null,
  },
  {
    code: 'PROOFS_NOT_RECEIVED',
    message: 'Aguardando chegada do canhoto original do CT-e',
    blocksScheduling: true,
    isActive: (facts) => facts.proofsReceivedAt === null,
  },
  {
    code: 'ADVANCE_NOT_PAID',
    message: 'O saldo só pode ser pago após a baixa do adiantamento',
    blocksScheduling: false,
    isActive: (facts) => facts.advanceStatus !== 'PAID',
  },
];

/**
 * R4/R5 — Fonte única das travas: os guards de programação e baixa e a resposta da API usam
 * esta função. Só o saldo tem travas. Natureza e status do título não são travas: são regras
 * das operações (R10).
 */
export function getTitleLocks(title: { kind: TitleKind }, facts: TripFacts): TitleLocks {
  if (title.kind !== 'BALANCE') return { canSchedule: true, canSettle: true, reasons: [] };

  const activeRules = BALANCE_LOCK_RULES.filter((rule) => rule.isActive(facts));
  return {
    canSchedule: activeRules.every((rule) => !rule.blocksScheduling),
    canSettle: activeRules.length === 0,
    reasons: activeRules.map(({ code, message }) => ({ code, message })),
  };
}
