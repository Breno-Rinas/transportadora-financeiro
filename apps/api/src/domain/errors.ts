/**
 * Catálogo dos códigos de erro de negócio, nos grupos da tabela de erros do CLAUDE.md.
 * TRIP_CANCELLED e TITLE_CANCELLED cobrem o status CANCELLED, reservado para o bônus.
 */
export type DomainErrorCode =
  // Entrada inválida
  | 'VALIDATION_ERROR'
  // Recurso inexistente
  | 'NOT_FOUND'
  // Conflito de estado ou duplicidade
  | 'EVENT_ALREADY_REGISTERED'
  | 'TRIP_NOT_LOADED'
  | 'UNLOADING_NOT_REGISTERED'
  | 'TITLE_ALREADY_PAID'
  | 'DOCUMENT_ALREADY_EXISTS'
  | 'CTE_NUMBER_IN_USE'
  | 'TRIP_CANCELLED'
  | 'TITLE_CANCELLED'
  // Violação de regra
  | 'BALANCE_LOCKED'
  | 'ADVANCE_NOT_PAID'
  | 'PARTIAL_PAYMENT_NOT_SUPPORTED'
  | 'INVALID_EVENT_DATE'
  | 'INVALID_DATE'
  | 'ONLY_PAYABLE_CAN_BE_SCHEDULED'
  | 'INVALID_DOCUMENT';

/**
 * Violação de regra de negócio. O `code` é estável (contrato com o front) e a
 * `message` é em pt-BR, pronta para exibir. O mapeamento code -> status HTTP
 * fica em `http/error-handler.ts`.
 */
export class DomainError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}
