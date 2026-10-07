import { isLoaded, type TripFacts } from './facts.js';
import type { TripStatus } from './types.js';

/** O fato que satisfez a transição; gravado em `TripStatusChange.trigger`. */
export type LifecycleTrigger =
  | 'TRIP_CREATED'
  | 'CTE_AND_LOADING_PHOTO_REGISTERED'
  | 'ADVANCE_SETTLED'
  | 'UNLOADING_REGISTERED'
  | 'PROOFS_REGISTERED'
  | 'BALANCE_SETTLED'
  | 'TRIP_CANCELLED';

export interface StatusChange {
  from: TripStatus;
  to: TripStatus;
  trigger: LifecycleTrigger;
}

export interface LifecycleResult {
  status: TripStatus;
  /** Transições percorridas, em ordem; vazia quando o status não muda. */
  changes: StatusChange[];
}

/** Primeiro registro do histórico, gravado na criação da viagem: não há status anterior. */
export const INITIAL_STATUS_CHANGE = {
  from: null,
  to: 'CREATED',
  trigger: 'TRIP_CREATED',
} as const satisfies { from: null; to: TripStatus; trigger: LifecycleTrigger };

interface LifecycleStep extends StatusChange {
  isSatisfied: (facts: TripFacts) => boolean;
}

/** Sequência canônica do R8: cada seta tem uma única condição. */
const LIFECYCLE_STEPS: readonly LifecycleStep[] = [
  {
    from: 'CREATED',
    to: 'LOADED',
    trigger: 'CTE_AND_LOADING_PHOTO_REGISTERED',
    isSatisfied: isLoaded,
  },
  {
    from: 'LOADED',
    to: 'ADVANCE_PAID',
    trigger: 'ADVANCE_SETTLED',
    isSatisfied: (facts) => facts.advanceStatus === 'PAID',
  },
  {
    from: 'ADVANCE_PAID',
    to: 'UNLOADED',
    trigger: 'UNLOADING_REGISTERED',
    isSatisfied: (facts) => facts.unloadedAt !== null,
  },
  {
    from: 'UNLOADED',
    to: 'PROOFS_RECEIVED',
    trigger: 'PROOFS_REGISTERED',
    isSatisfied: (facts) => facts.proofsReceivedAt !== null,
  },
  {
    from: 'PROOFS_RECEIVED',
    to: 'BALANCE_PAID',
    trigger: 'BALANCE_SETTLED',
    isSatisfied: (facts) => facts.balanceStatus === 'PAID',
  },
];

/**
 * R8 — Avança o status pela sequência canônica enquanto a condição da próxima seta estiver
 * satisfeita. Os fatos são aceitos quando acontecem (descarga e comprovantes podem chegar antes
 * da baixa do adiantamento); quando a etapa pendente se resolve, o status percorre as seguintes
 * em sequência, uma transição por vez, sem nunca pular etapas. BALANCE_PAID e CANCELLED não têm
 * próxima seta; o cancelamento (R13) é uma transição à parte, em `cancellation.ts`.
 */
export function advanceLifecycle(status: TripStatus, facts: TripFacts): LifecycleResult {
  const changes: StatusChange[] = [];
  let current = status;

  for (;;) {
    const step = LIFECYCLE_STEPS.find((candidate) => candidate.from === current);
    if (step === undefined || !step.isSatisfied(facts)) return { status: current, changes };

    changes.push({ from: step.from, to: step.to, trigger: step.trigger });
    current = step.to;
  }
}
