import { DomainError } from '../domain/errors.js';
import { getViolatedUniqueIndex } from '../infra/unique-violation.js';

// Erros de duplicidade. A checagem explícita nos casos de uso é a primeira barreira; os índices
// únicos do banco são a segunda, e o P2002 vira o mesmo código de domínio.

export function clientCnpjInUse(): DomainError {
  return new DomainError(
    'DOCUMENT_ALREADY_EXISTS',
    'Já existe um cliente cadastrado com este CNPJ.',
  );
}

export function driverDocumentInUse(): DomainError {
  return new DomainError(
    'DOCUMENT_ALREADY_EXISTS',
    'Já existe um motorista cadastrado com este documento.',
  );
}

export function cteNumberInUse(): DomainError {
  return new DomainError(
    'CTE_NUMBER_IN_USE',
    'Este número de CT-e, nesta série, já está registrado em outra viagem.',
  );
}

function eventAlreadyRegistered(): DomainError {
  return new DomainError(
    'EVENT_ALREADY_REGISTERED',
    'Este evento já foi registrado nesta viagem por outra requisição.',
  );
}

const DOMAIN_ERROR_BY_UNIQUE_INDEX = new Map<string, () => DomainError>([
  ['clients_cnpj_key', clientCnpjInUse],
  ['drivers_document_key', driverDocumentInUse],
  ['ctes_series_number_key', cteNumberInUse],
  ['ctes_tripId_key', eventAlreadyRegistered],
  ['trip_events_tripId_type_key', eventAlreadyRegistered],
  ['titles_tripId_kind_key', eventAlreadyRegistered],
]);

/** Executa a operação traduzindo violação de índice único (P2002) para o erro de domínio. */
export async function withUniqueViolationsAsDomainErrors<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const index = getViolatedUniqueIndex(error);
    const toDomainError = index === null ? undefined : DOMAIN_ERROR_BY_UNIQUE_INDEX.get(index);
    throw toDomainError === undefined ? error : toDomainError();
  }
}
