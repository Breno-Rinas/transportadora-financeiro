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

/** Data e hora de parede de um instante no fuso informado, com zeros à esquerda. */
function getWallClock(instant: Date, timeZone: string): Record<string, string> {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return Object.fromEntries(
    formatter.formatToParts(instant).map(({ type, value }) => [type, value]),
  );
}

/**
 * Data de negócio de um instante: o dia do calendário no fuso informado (em produção,
 * `America/Sao_Paulo`). Ex.: 2026-03-12T01:00Z ainda é 11/03 em São Paulo.
 */
export function toBusinessDate(instant: Date, timeZone: string): LocalDate {
  const wallClock = getWallClock(instant, timeZone);
  return `${wallClock.year}-${wallClock.month}-${wallClock.day}`;
}

/** Quanto o relógio de parede do fuso está à frente do UTC no instante, em ms (-3h em SP). */
function getUtcOffsetMs(instant: number, timeZone: string): number {
  const wallClock = getWallClock(new Date(instant), timeZone);
  const wallClockAsUtc = Date.UTC(
    Number(wallClock.year),
    Number(wallClock.month) - 1,
    Number(wallClock.day),
    Number(wallClock.hour),
    Number(wallClock.minute),
    Number(wallClock.second),
  );
  return wallClockAsUtc - (instant - (instant % 1000));
}

/**
 * Primeiro instante da data de negócio no fuso informado; o inverso de `toBusinessDate`. Serve
 * para filtrar instantes por período de datas: [início de `from`, início de `to` + 1 dia).
 * Ex.: 12/03/2026 em São Paulo começa em 2026-03-12T03:00Z.
 */
export function startOfBusinessDay(date: LocalDate, timeZone: string): Date {
  const utcMidnight = parseLocalDate(date).getTime();
  // O deslocamento depende do instante (horário de verão): corrige uma vez com o do candidato.
  const first = utcMidnight - getUtcOffsetMs(utcMidnight, timeZone);
  const second = utcMidnight - getUtcOffsetMs(first, timeZone);
  // Num dia em que a meia-noite não existe (o relógio pula para 01:00), só um dos candidatos
  // cai na data: o dia começa nele.
  const [earliest, latest] = first <= second ? [first, second] : [second, first];
  return new Date(toBusinessDate(new Date(earliest), timeZone) === date ? earliest : latest);
}
