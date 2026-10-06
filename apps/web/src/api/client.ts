/** Formato de erro do backend: `{ error: { code, message, details? } }`. */
interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

/** Erro de uma chamada à API. `code` e `message` vêm do backend (message já em pt-BR). */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions {
  query?: QueryParams;
  /** Objeto serializado como JSON. */
  json?: unknown;
  /** Upload multipart (não define content-type: o browser coloca o boundary). */
  form?: FormData;
  signal?: AbortSignal;
}

const API_PREFIX = '/api';

function buildUrl(path: string, query?: QueryParams): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  return `${API_PREFIX}${path}${search ? `?${search}` : ''}`;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const { error } = value;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const init: RequestInit = { method, signal: options.signal };
  if (options.form) {
    init.body = options.form;
  } else if (options.json !== undefined) {
    init.body = JSON.stringify(options.json);
    init.headers = { 'Content-Type': 'application/json' };
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), init);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'Não foi possível conectar ao servidor. Tente de novo.');
  }

  const body = response.status === 204 ? undefined : await readJson(response);

  if (!response.ok) {
    if (isApiErrorBody(body)) {
      const { code, message, details } = body.error;
      throw new ApiError(response.status, code, message, details);
    }
    throw new ApiError(
      response.status,
      'UNEXPECTED_RESPONSE',
      'Erro inesperado no servidor. Tente de novo.',
    );
  }

  return body as T;
}

export const api = {
  get: <T>(path: string, query?: QueryParams, signal?: AbortSignal) =>
    request<T>('GET', path, { query, signal }),
  post: <T>(path: string, json?: unknown) => request<T>('POST', path, { json }),
  postForm: <T>(path: string, form: FormData) => request<T>('POST', path, { form }),
};
