import { ApiError } from './client';
import type { ValidationErrorDetail } from './types';

const FALLBACK_MESSAGE = 'Ocorreu um erro inesperado. Tente de novo.';

/** Mensagem pronta para exibir ao usuário. Nunca devolve JSON cru nem detalhes técnicos. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return FALLBACK_MESSAGE;
}

function isValidationDetail(value: unknown): value is ValidationErrorDetail {
  return (
    typeof value === 'object' &&
    value !== null &&
    'path' in value &&
    typeof value.path === 'string' &&
    'message' in value &&
    typeof value.message === 'string'
  );
}

/**
 * Erros por campo para pendurar no formulário (`form.setErrors`). Vem de duas fontes:
 * - `VALIDATION_ERROR` (400): `details` traz `{ path, message }` por campo; vale a primeira
 *   mensagem de cada `path`.
 * - Códigos de negócio ligados a um campo (ex.: `INVALID_DOCUMENT` -> `cnpj`), via `fieldByCode`.
 * Devolve `{}` quando o erro não pertence a nenhum campo; nesse caso só a notificação aparece.
 */
export function getFieldErrors(
  error: unknown,
  fieldByCode: Readonly<Record<string, string>> = {},
): Record<string, string> {
  if (!(error instanceof ApiError)) return {};

  const field = fieldByCode[error.code];
  if (field) return { [field]: error.message };

  if (error.code !== 'VALIDATION_ERROR' || !Array.isArray(error.details)) return {};

  const errors: Record<string, string> = {};
  for (const detail of error.details) {
    if (isValidationDetail(detail) && detail.path && !(detail.path in errors)) {
      errors[detail.path] = detail.message;
    }
  }
  return errors;
}
