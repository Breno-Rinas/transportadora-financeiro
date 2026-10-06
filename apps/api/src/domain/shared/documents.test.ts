import { describe, expect, it } from 'vitest';
import type { DomainErrorCode } from '../errors.js';
import {
  isValidCnpj,
  isValidCpf,
  parseCnpj,
  parseDriverDocument,
  parsePlate,
} from './documents.js';

const withCode = (code: DomainErrorCode) => expect.objectContaining({ code });

describe('CPF (R12)', () => {
  it('aceita CPF com dígitos verificadores corretos', () => {
    expect(isValidCpf('52998224725')).toBe(true);
  });

  it.each([
    ['dígito verificador errado', '52998224724'],
    ['todos os dígitos iguais', '11111111111'],
    ['tamanho errado', '5299822472'],
    ['letras', '5299822472A'],
  ])('recusa CPF com %s', (_reason, cpf) => {
    expect(isValidCpf(cpf)).toBe(false);
  });
});

describe('CNPJ (R12)', () => {
  it('aceita CNPJ numérico válido', () => {
    expect(isValidCnpj('11222333000181')).toBe(true);
  });

  it('aceita CNPJ alfanumérico válido (IN RFB 2.229/2024)', () => {
    expect(isValidCnpj('12ABC34501DE35')).toBe(true);
  });

  it.each([
    ['dígito verificador errado', '11222333000182'],
    ['todos os dígitos iguais', '00000000000000'],
    ['letra no dígito verificador', '12ABC34501DE3A'],
    ['tamanho errado', '1122233300018'],
  ])('recusa CNPJ com %s', (_reason, cnpj) => {
    expect(isValidCnpj(cnpj)).toBe(false);
  });

  it('parseCnpj remove a máscara, passa para maiúsculas e devolve o valor a salvar', () => {
    expect(parseCnpj('11.222.333/0001-81')).toBe('11222333000181');
    expect(parseCnpj('12.abc.345/01de-35')).toBe('12ABC34501DE35');
  });

  it('parseCnpj lança INVALID_DOCUMENT para CNPJ inválido', () => {
    expect(() => parseCnpj('11.222.333/0001-82')).toThrow(withCode('INVALID_DOCUMENT'));
  });
});

describe('documento do motorista', () => {
  it('aceita CPF ou CNPJ e devolve sem máscara', () => {
    expect(parseDriverDocument('529.982.247-25')).toBe('52998224725');
    expect(parseDriverDocument('11.222.333/0001-81')).toBe('11222333000181');
  });

  it('não descarta caracteres fora da máscara', () => {
    expect(() => parseDriverDocument('529*982*247*25')).toThrow(withCode('INVALID_DOCUMENT'));
  });

  it('explica qual documento está inválido', () => {
    expect(() => parseDriverDocument('529.982.247-24')).toThrow(/^CPF inválido/);
    expect(() => parseDriverDocument('11.222.333/0001-82')).toThrow(/^CNPJ inválido/);
    expect(() => parseDriverDocument('123456789012')).toThrow(/informe um CPF/);
  });
});

describe('placa', () => {
  it('aceita o formato antigo e o Mercosul, normalizando', () => {
    expect(parsePlate('abc-1234')).toBe('ABC1234');
    expect(parsePlate('BRA2E19')).toBe('BRA2E19');
  });

  it.each(['AB12345', 'ABC12345', 'ABCD123', 'ABC1D2E'])('recusa %s', (plate) => {
    expect(() => parsePlate(plate)).toThrow(withCode('INVALID_DOCUMENT'));
  });
});
