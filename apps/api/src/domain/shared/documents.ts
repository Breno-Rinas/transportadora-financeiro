import { DomainError } from '../errors.js';

// R12 — CPF, CNPJ e placa são salvos sem máscara, só com dígitos e letras maiúsculas.

const CPF_PATTERN = /^\d{11}$/;
// CNPJ alfanumérico (IN RFB 2.229/2024, emitido desde julho de 2026): 12 caracteres [0-9A-Z]
// seguidos de 2 dígitos verificadores numéricos. O CNPJ só com dígitos continua válido.
const CNPJ_PATTERN = /^[0-9A-Z]{12}\d{2}$/;
// Antiga AAA9999 ou Mercosul AAA9A99: diferem só no 5º caractere.
const PLATE_PATTERN = /^[A-Z]{3}\d[A-Z0-9]\d{2}$/;

/**
 * Remove só a pontuação de máscara (ponto, barra, hífen e espaços) e passa para maiúsculas.
 * Qualquer outro caractere permanece e faz a validação falhar, em vez de ser descartado.
 */
export function stripMask(value: string): string {
  return value.replace(/[\s./-]/g, '').toUpperCase();
}

/**
 * Dígito verificador módulo 11: pesos 2, 3, 4... da direita para a esquerda, voltando a 2 depois
 * de `maxWeight`. Cada caractere vale seu código ASCII menos 48, então '0'..'9' valem 0..9 e,
 * no CNPJ alfanumérico, 'A'..'Z' valem 17..42, como define a Receita Federal.
 */
function mod11CheckDigit(base: string, maxWeight: number): number {
  let sum = 0;
  let weight = 2;
  for (let index = base.length - 1; index >= 0; index -= 1) {
    sum += (base.charCodeAt(index) - 48) * weight;
    weight = weight === maxWeight ? 2 : weight + 1;
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/** Recalcula os dois últimos dígitos: o segundo considera o primeiro já anexado à base. */
function hasValidCheckDigits(document: string, maxWeight: number): boolean {
  const base = document.slice(0, -2);
  const first = mod11CheckDigit(base, maxWeight);
  const second = mod11CheckDigit(`${base}${first}`, maxWeight);
  return document.endsWith(`${first}${second}`);
}

/** Sequências como 111.111.111-11 passam no cálculo, mas não são documentos emitidos. */
function isRepeatedSequence(document: string): boolean {
  return /^(.)\1*$/.test(document);
}

/** Recebe o CPF sem máscara. Pesos de 2 a 11, sem reinício. */
export function isValidCpf(cpf: string): boolean {
  return CPF_PATTERN.test(cpf) && !isRepeatedSequence(cpf) && hasValidCheckDigits(cpf, 11);
}

/** Recebe o CNPJ sem máscara. Pesos de 2 a 9, reiniciando em 2. */
export function isValidCnpj(cnpj: string): boolean {
  return CNPJ_PATTERN.test(cnpj) && !isRepeatedSequence(cnpj) && hasValidCheckDigits(cnpj, 9);
}

/** Recebe a placa sem máscara. */
export function isValidPlate(plate: string): boolean {
  return PLATE_PATTERN.test(plate);
}

function invalidDocument(message: string, value: string): DomainError {
  return new DomainError('INVALID_DOCUMENT', message, { value });
}

/** Normaliza e valida o CNPJ do cliente; devolve o valor a salvar. */
export function parseCnpj(value: string): string {
  const cnpj = stripMask(value);
  if (!isValidCnpj(cnpj)) {
    throw invalidDocument('CNPJ inválido: confira os dígitos verificadores.', value);
  }
  return cnpj;
}

/** Normaliza e valida o documento do motorista (CPF ou CNPJ); devolve o valor a salvar. */
export function parseDriverDocument(value: string): string {
  const document = stripMask(value);
  if (isValidCpf(document) || isValidCnpj(document)) return document;

  if (document.length === 11) {
    throw invalidDocument('CPF inválido: confira os dígitos verificadores.', value);
  }
  if (document.length === 14) {
    throw invalidDocument('CNPJ inválido: confira os dígitos verificadores.', value);
  }
  throw invalidDocument(
    'Documento inválido: informe um CPF (11 dígitos) ou um CNPJ (14 caracteres).',
    value,
  );
}

/** Normaliza e valida a placa do veículo; devolve o valor a salvar. */
export function parsePlate(value: string): string {
  const plate = stripMask(value);
  if (!isValidPlate(plate)) {
    throw invalidDocument(
      'Placa inválida: use o formato antigo (AAA9999) ou o Mercosul (AAA9A99).',
      value,
    );
  }
  return plate;
}
