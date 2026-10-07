import { isOpenTitle } from '../title/agenda.js';
import { getTitleLocks } from '../title/locks.js';
import { isLoaded, type TripFacts } from './facts.js';

export type PendingStepCode =
  | 'CTE_PENDING'
  | 'LOADING_PHOTO_PENDING'
  | 'ADVANCE_PAYMENT_PENDING'
  | 'UNLOADING_PENDING'
  | 'PROOFS_PENDING'
  | 'BALANCE_READY_TO_SCHEDULE'
  | 'BALANCE_PAYMENT_PENDING'
  | 'ADVANCE_RECOVERY_PENDING';

export interface PendingStep {
  code: PendingStepCode;
  message: string;
}

const PENDING_STEP_MESSAGES: Record<PendingStepCode, string> = {
  CTE_PENDING: 'Aguardando emissão do CT-e',
  LOADING_PHOTO_PENDING: 'Aguardando foto do carregamento',
  ADVANCE_PAYMENT_PENDING: 'Aguardando baixa do adiantamento',
  UNLOADING_PENDING: 'Aguardando descarga',
  PROOFS_PENDING: 'Aguardando canhoto original',
  BALANCE_READY_TO_SCHEDULE: 'Saldo liberado — programar pagamento',
  BALANCE_PAYMENT_PENDING: 'Aguardando pagamento do saldo',
  ADVANCE_RECOVERY_PENDING: 'Recuperar adiantamento pago ao motorista',
};

/**
 * "O que falta" na viagem, na ordem do fluxo. Como os fatos são aceitos fora de ordem, mais de
 * uma pendência pode valer ao mesmo tempo (ex.: adiantamento a baixar e saldo já liberado).
 * Na viagem cancelada (R13), o fluxo acabou: só resta receber de volta o adiantamento pago.
 * Lista vazia: nada pendente.
 */
export function getPendingSteps(facts: TripFacts): PendingStep[] {
  const codes: PendingStepCode[] = [];

  if (facts.cancelledAt !== null) {
    if (isOpenTitle(facts.advanceRecoveryStatus)) codes.push('ADVANCE_RECOVERY_PENDING');
    return codes.map((code) => ({ code, message: PENDING_STEP_MESSAGES[code] }));
  }

  if (facts.cteIssuedAt === null) codes.push('CTE_PENDING');
  if (facts.loadingPhotoAt === null) codes.push('LOADING_PHOTO_PENDING');

  if (isLoaded(facts)) {
    if (isOpenTitle(facts.advanceStatus)) codes.push('ADVANCE_PAYMENT_PENDING');

    if (facts.unloadedAt === null) codes.push('UNLOADING_PENDING');
    else if (facts.proofsReceivedAt === null) codes.push('PROOFS_PENDING');

    // "Liberado" é o que as travas dizem, para não haver duas fontes da mesma regra.
    const { balanceStatus } = facts;
    if (
      isOpenTitle(balanceStatus) &&
      getTitleLocks({ kind: 'BALANCE', status: balanceStatus }, facts).canSchedule
    ) {
      codes.push(
        balanceStatus === 'SCHEDULED' ? 'BALANCE_PAYMENT_PENDING' : 'BALANCE_READY_TO_SCHEDULE',
      );
    }
  }

  return codes.map((code) => ({ code, message: PENDING_STEP_MESSAGES[code] }));
}
