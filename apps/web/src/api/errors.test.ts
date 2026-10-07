import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import { getErrorMessage, getFieldErrors } from './errors';

describe('getErrorMessage', () => {
  it('usa a mensagem de negócio do backend', () => {
    const error = new ApiError(422, 'BALANCE_LOCKED', 'Saldo travado: aguardando a descarga');
    expect(getErrorMessage(error)).toBe('Saldo travado: aguardando a descarga');
  });

  it('não vaza o texto de erros desconhecidos', () => {
    expect(getErrorMessage(new TypeError('x is not a function'))).toBe(
      'Ocorreu um erro inesperado. Tente de novo.',
    );
    expect(getErrorMessage('{"error":{"code":"X"}}')).toBe(
      'Ocorreu um erro inesperado. Tente de novo.',
    );
  });
});

describe('getFieldErrors', () => {
  it('pendura cada detalhe de VALIDATION_ERROR no seu campo, ficando com a primeira mensagem', () => {
    const error = new ApiError(400, 'VALIDATION_ERROR', 'Dados inválidos', [
      { path: 'legalName', message: 'Informe a razão social' },
      { path: 'legalName', message: 'Segunda mensagem' },
      { path: 'paymentTermDays', message: 'Deve ser maior ou igual a 0' },
    ]);
    expect(getFieldErrors(error)).toEqual({
      legalName: 'Informe a razão social',
      paymentTermDays: 'Deve ser maior ou igual a 0',
    });
  });

  it('mapeia códigos de negócio para um campo', () => {
    const error = new ApiError(422, 'INVALID_DOCUMENT', 'CNPJ inválido');
    expect(getFieldErrors(error, { INVALID_DOCUMENT: 'cnpj' })).toEqual({ cnpj: 'CNPJ inválido' });
  });

  it('devolve vazio quando o erro não é de um campo', () => {
    expect(getFieldErrors(new ApiError(409, 'DOCUMENT_ALREADY_EXISTS', 'Já existe'))).toEqual({});
    expect(
      getFieldErrors(new ApiError(400, 'VALIDATION_ERROR', 'Dados inválidos', 'texto')),
    ).toEqual({});
    expect(getFieldErrors(new Error('boom'))).toEqual({});
  });
});
