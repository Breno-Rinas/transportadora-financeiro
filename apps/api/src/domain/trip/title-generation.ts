import { DomainError } from '../errors.js';
import { addDays, toBusinessDate, type LocalDate } from '../shared/local-date.js';
import { assertPositiveCents, splitDriverFreight } from '../shared/money.js';
import type { TitleKind, TitleNature } from '../title/types.js';
import { getLoadedAt, isLoaded, type TripFacts } from './facts.js';

/** Título pronto para ser persistido. */
export interface TitleDraft {
  nature: TitleNature;
  kind: TitleKind;
  amountCents: number;
  dueDate: LocalDate | null;
  status: 'OPEN';
}

export interface LoadingTitlesInput {
  facts: TripFacts;
  cte: { issuedAt: Date; clientFreightCents: number };
  clientPaymentTermDays: number;
  agreement: { driverFreightCents: number; advancePercent: number };
  timeZone: string;
}

/**
 * R1 — Os títulos nascem quando a viagem tem CT-e e foto do carregamento, em qualquer ordem,
 * e ainda não foram gerados. Os três nascem juntos, então basta olhar o adiantamento. Viagem
 * cancelada (R13) não gera títulos.
 */
export function shouldGenerateTitles(facts: TripFacts): boolean {
  return facts.cancelledAt === null && isLoaded(facts) && facts.advanceStatus === null;
}

/**
 * R2/R3 — Os três títulos do carregamento:
 * - CLIENT_FREIGHT: valor do CT-e; vence na data de negócio da emissão + prazo do cliente.
 * - ADVANCE: parte do frete do motorista; vence na data de negócio do carregamento.
 * - BALANCE: o restante; sem vencimento até a chegada dos comprovantes.
 */
export function buildLoadingTitles(
  input: LoadingTitlesInput,
): [TitleDraft, TitleDraft, TitleDraft] {
  const { facts, cte, clientPaymentTermDays, agreement, timeZone } = input;

  const loadedAt = getLoadedAt(facts);
  if (loadedAt === null) {
    throw new DomainError(
      'TRIP_NOT_LOADED',
      'Os títulos só são gerados depois do registro do CT-e e da foto do carregamento.',
    );
  }
  assertPositiveCents(cte.clientFreightCents, 'Frete do cliente');
  if (!Number.isSafeInteger(clientPaymentTermDays) || clientPaymentTermDays < 0) {
    throw new DomainError(
      'VALIDATION_ERROR',
      'Prazo de pagamento do cliente: informe um número inteiro de dias, zero ou maior.',
      { clientPaymentTermDays },
    );
  }
  const { advanceCents, balanceCents } = splitDriverFreight(
    agreement.driverFreightCents,
    agreement.advancePercent,
  );

  return [
    {
      nature: 'RECEIVABLE',
      kind: 'CLIENT_FREIGHT',
      amountCents: cte.clientFreightCents,
      dueDate: addDays(toBusinessDate(cte.issuedAt, timeZone), clientPaymentTermDays),
      status: 'OPEN',
    },
    {
      nature: 'PAYABLE',
      kind: 'ADVANCE',
      amountCents: advanceCents,
      dueDate: toBusinessDate(loadedAt, timeZone),
      status: 'OPEN',
    },
    {
      nature: 'PAYABLE',
      kind: 'BALANCE',
      amountCents: balanceCents,
      dueDate: null,
      status: 'OPEN',
    },
  ];
}

/** R3 — Com a chegada dos comprovantes, o saldo passa a vencer na data de negócio desse evento. */
export function getBalanceDueDate(proofsReceivedAt: Date, timeZone: string): LocalDate {
  return toBusinessDate(proofsReceivedAt, timeZone);
}
