import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { DomainError, type DomainErrorCode } from '../domain/errors.js';

/** Formato único de erro da API (ver CLAUDE.md, "API HTTP"). */
export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

/**
 * Mapeamento `DomainError.code` -> status HTTP (409 conflito, 422 violação de regra). O tipo
 * obriga a mapear todo código de `DomainErrorCode`. Um código fora do mapa é tratado como bug
 * (500), para nunca vazar um status errado.
 */
export const statusByCode: Readonly<Record<DomainErrorCode, number>> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  EVENT_ALREADY_REGISTERED: 409,
  TRIP_NOT_LOADED: 409,
  UNLOADING_NOT_REGISTERED: 409,
  TITLE_ALREADY_PAID: 409,
  DOCUMENT_ALREADY_EXISTS: 409,
  CTE_NUMBER_IN_USE: 409,
  TRIP_CANCELLED: 409,
  TITLE_CANCELLED: 409,
  TRIP_ALREADY_FINISHED: 409,
  BALANCE_LOCKED: 422,
  ADVANCE_NOT_PAID: 422,
  PARTIAL_PAYMENT_NOT_SUPPORTED: 422,
  INVALID_EVENT_DATE: 422,
  INVALID_DATE: 422,
  ONLY_PAYABLE_CAN_BE_SCHEDULED: 422,
  INVALID_DOCUMENT: 422,
};

function getDomainErrorStatus(code: string): number | undefined {
  return Object.hasOwn(statusByCode, code) ? statusByCode[code as DomainErrorCode] : undefined;
}

const INTERNAL_ERROR_MESSAGE = 'Erro interno do servidor';

const clientErrorByStatus: Readonly<Record<number, { code: string; message: string }>> = {
  400: { code: 'VALIDATION_ERROR', message: 'Requisição inválida' },
  404: { code: 'NOT_FOUND', message: 'Recurso não encontrado' },
  413: { code: 'PAYLOAD_TOO_LARGE', message: 'O conteúdo enviado excede o tamanho permitido' },
  415: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Tipo de conteúdo não suportado' },
};

export function apiError(code: string, message: string, details?: unknown): ApiErrorBody {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

/** Erros 4xx gerados pelo próprio Fastify/plugins (JSON malformado, corpo grande demais...). */
function getClientErrorStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) return null;
  const { statusCode } = error;
  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500
    ? statusCode
    : null;
}

export function notFoundBody(): ApiErrorBody {
  const { code, message } = clientErrorByStatus[404]!;
  return apiError(code, message);
}

function handleError(error: unknown, request: FastifyRequest, reply: FastifyReply): void {
  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      path: issue.path.map(String).join('.'),
      message: issue.message,
    }));
    void reply.status(400).send(apiError('VALIDATION_ERROR', 'Dados inválidos', details));
    return;
  }

  if (error instanceof DomainError) {
    const status = getDomainErrorStatus(error.code);
    if (status !== undefined) {
      void reply.status(status).send(apiError(error.code, error.message, error.details));
      return;
    }
    request.log.error({ err: error, code: error.code }, 'DomainError sem status mapeado');
  } else {
    const status = getClientErrorStatus(error);
    if (status !== null) {
      const known = clientErrorByStatus[status] ?? {
        code: 'BAD_REQUEST',
        message: 'Requisição inválida',
      };
      void reply.status(status).send(apiError(known.code, known.message));
      return;
    }
    request.log.error({ err: error }, 'Erro não tratado');
  }

  void reply.status(500).send(apiError('INTERNAL_ERROR', INTERNAL_ERROR_MESSAGE));
}

export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler(handleError);
  app.setNotFoundHandler((_request, reply) => {
    void reply.status(404).send(notFoundBody());
  });
}
