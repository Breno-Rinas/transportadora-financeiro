import { assertValidLocalDate, type LocalDate } from '../domain/shared/local-date.js';

// Colunas `@db.Date` chegam do Prisma como `Date` à meia-noite UTC e são gravadas a partir de um
// `Date` à meia-noite UTC. Converter sempre por UTC (nunca pelo fuso do processo ou da sessão do
// banco) evita o bug em que 12/03 vira 11/03.

/** `LocalDate` -> valor da coluna `@db.Date`. */
export function toDbDate(date: LocalDate): Date {
  assertValidLocalDate(date);
  return new Date(`${date}T00:00:00.000Z`);
}

/** Valor da coluna `@db.Date` -> `LocalDate`. */
export function fromDbDate(value: Date): LocalDate {
  return value.toISOString().slice(0, 10);
}

export function toNullableDbDate(date: LocalDate | null): Date | null {
  return date === null ? null : toDbDate(date);
}

export function fromNullableDbDate(value: Date | null): LocalDate | null {
  return value === null ? null : fromDbDate(value);
}
