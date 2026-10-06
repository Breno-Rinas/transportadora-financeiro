import { DomainError } from '../errors.js';

/**
 * Data de calendário sem hora, no formato `YYYY-MM-DD` (vencimento, programação, pagamento).
 * Nunca é representada por `Date`: assim 12/03 não vira 11/03 por causa de fuso.
 * Por ser ISO com zeros à esquerda, a ordem alfabética coincide com a ordem cronológica.
 */
export type LocalDate = string;

/** Intervalo fechado de datas: `from` e `to` inclusos. */
export interface DateRange {
  from: LocalDate;
  to: LocalDate;
}

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// A aritmética de calendário usa internamente `Date` em meia-noite UTC, que não tem fuso nem
// horário de verão; para fora, só sai `LocalDate`.
function formatUtcDate(utcMidnight: Date): LocalDate {
  return utcMidnight.toISOString().slice(0, 10);
}

/** Meia-noite UTC da data, ou null se o texto não for uma data de calendário válida. */
function toUtcMidnight(value: string): Date | null {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (match === null) return null;

  const utcMidnight = new Date(0);
  utcMidnight.setUTCFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  // Datas inexistentes (ex.: 2026-02-30) transbordam para o mês seguinte; a volta denuncia.
  return formatUtcDate(utcMidnight) === value ? utcMidnight : null;
}

function parseLocalDate(value: string): Date {
  const utcMidnight = toUtcMidnight(value);
  if (utcMidnight === null) {
    throw new DomainError('INVALID_DATE', `Data inválida: "${value}". Use o formato AAAA-MM-DD.`, {
      value,
    });
  }
  return utcMidnight;
}

export function isValidLocalDate(value: string): boolean {
  return toUtcMidnight(value) !== null;
}

/** Lança INVALID_DATE se o texto não for uma data de calendário no formato `YYYY-MM-DD`. */
export function assertValidLocalDate(value: string): void {
  parseLocalDate(value);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const utcMidnight = parseLocalDate(date);
  utcMidnight.setUTCDate(utcMidnight.getUTCDate() + days);
  return formatUtcDate(utcMidnight);
}

/** Negativo se `a` vem antes de `b`, zero se iguais, positivo se depois. */
export function compareLocalDate(a: LocalDate, b: LocalDate): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function isWithinRange(date: LocalDate, range: DateRange): boolean {
  return compareLocalDate(date, range.from) >= 0 && compareLocalDate(date, range.to) <= 0;
}

/** Do primeiro ao último dia do mês da data informada. */
export function getMonthRange(date: LocalDate): DateRange {
  const firstDay = parseLocalDate(date);
  firstDay.setUTCDate(1);
  const lastDay = new Date(firstDay);
  // Dia 0 do mês seguinte é o último dia deste mês.
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0);
  return { from: formatUtcDate(firstDay), to: formatUtcDate(lastDay) };
}

/**
 * Data de negócio de um instante: o dia do calendário no fuso informado (em produção,
 * `America/Sao_Paulo`). Ex.: 2026-03-12T01:00Z ainda é 11/03 em São Paulo.
 */
export function toBusinessDate(instant: Date, timeZone: string): LocalDate {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
