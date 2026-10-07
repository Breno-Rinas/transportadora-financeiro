/**
 * Formatação e parsing de exibição. Dinheiro é sempre inteiro em centavos; datas sem hora são
 * strings `YYYY-MM-DD` manipuladas como texto (sem `Date`, para o dia não mudar com o fuso).
 */

const EMPTY = '—';

/** Fuso de negócio: instantes são exibidos nele, igual ao "hoje" calculado pelo backend. */
export const BUSINESS_TIME_ZONE = 'America/Sao_Paulo';

// ---------------------------------------------------------------------------
// Dinheiro
// ---------------------------------------------------------------------------

const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const decimalFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `333333` -> `R$ 3.333,33` (o espaço após o símbolo é o NBSP do Intl). */
export function formatBRL(cents: number): string {
  return brlFormatter.format(cents / 100);
}

/** `333333` -> `3.333,33`, sem o símbolo: valor inicial e formato de saída de campos de dinheiro. */
export function formatBRLNumber(cents: number): string {
  return decimalFormatter.format(cents / 100);
}

/**
 * `"3.333,33"` -> `333333`. Opera na string, sem `parseFloat`. Aceita `R$`, espaços, sinal `-`,
 * pontos de milhar bem formados (grupos de 3) e até 2 casas depois da vírgula (`"3333,5"` ->
 * `333350`, `"3333"` e `"3333,"` -> `333300`). Devolve `null` para qualquer outra forma (por exemplo `"3.33"`,
 * ambíguo entre milhar e decimal) e para valores além do inteiro seguro.
 */
export function parseBRL(text: string): number | null {
  const cleaned = text.replace(/R\$/g, '').replace(/[\s\u00a0]/g, '');
  const match = /^(-)?(\d{1,3}(?:\.\d{3})+|\d+)?(?:,(\d{0,2}))?$/.exec(cleaned);
  if (!match) return null;

  const [, sign, integerPart, decimalPart] = match;
  if (integerPart === undefined && !decimalPart) return null;

  const integerDigits = (integerPart ?? '0').replaceAll('.', '');
  const cents = Number(integerDigits + (decimalPart ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) return null;
  return sign && cents !== 0 ? -cents : cents;
}

/** Percentual de exibição (margem): `12.5` -> `12,50%`. `null` vira traço. */
export function formatPercent(percent: number | null | undefined): string {
  if (percent === null || percent === undefined) return EMPTY;
  return `${decimalFormatter.format(percent)}%`;
}

// ---------------------------------------------------------------------------
// Números e códigos
// ---------------------------------------------------------------------------

const integerFormatter = new Intl.NumberFormat('pt-BR');

/** `28000` -> `28.000 kg`. */
export function formatWeightKg(kg: number): string {
  return `${integerFormatter.format(kg)} kg`;
}

/** Código sequencial da viagem: `1` -> `VG-0001`. */
export function formatTripCode(code: number): string {
  return `VG-${String(code).padStart(4, '0')}`;
}

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `"2026-03-12"` -> `"12/03/2026"`, sem `Date`. Vazio vira traço; texto fora do padrão passa direto. */
export function formatDate(date: string | null | undefined): string {
  if (!date) return EMPTY;
  const match = LOCAL_DATE_PATTERN.exec(date);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : date;
}

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Instante ISO -> `12/03/2026 14:30`, no fuso de negócio. Vazio vira traço. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return EMPTY;
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return iso;

  const parts: Record<string, string> = {};
  for (const { type, value } of dateTimeFormatter.formatToParts(instant)) parts[type] = value;
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

/** Instante ISO -> `12/03/2026`, o dia no fuso de negócio (sem a hora). Vazio vira traço. */
export function formatInstantDate(iso: string | null | undefined): string {
  const dateTime = formatDateTime(iso);
  return dateTime.length > 10 && dateTime.charAt(10) === ' ' ? dateTime.slice(0, 10) : dateTime;
}

// ---------------------------------------------------------------------------
// Data e hora de negócio nos formulários: o "agora" e o "hoje" do usuário são sempre os do fuso
// de negócio (o mesmo do backend), e o texto digitado volta como instante ISO para a API.
// ---------------------------------------------------------------------------

const wallClockFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const WALL_CLOCK_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;

function wallClockUtcMs(instant: Date): number {
  const parts: Record<string, string> = {};
  for (const { type, value } of wallClockFormatter.formatToParts(instant)) parts[type] = value;
  return Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
}

/** Agora no fuso de negócio, como `YYYY-MM-DD HH:mm:ss` (formato dos seletores de data e hora). */
export function nowDateTime(now: Date = new Date()): string {
  const wall = new Date(wallClockUtcMs(now)).toISOString();
  return `${wall.slice(0, 10)} ${wall.slice(11, 19)}`;
}

/** Hoje no fuso de negócio, como `YYYY-MM-DD`. */
export function todayLocalDate(now: Date = new Date()): string {
  return nowDateTime(now).slice(0, 10);
}

/** Instante ISO do agora, para os campos de data e hora deixados em branco ("padrão agora"). */
export function nowIso(now: Date = new Date()): string {
  return now.toISOString();
}

/**
 * `"2026-10-06 14:30:00"` (hora de parede no fuso de negócio) -> `"2026-10-06T17:30:00.000Z"`.
 * Aceita `T` no lugar do espaço e segundos opcionais; devolve `null` para texto fora do padrão.
 */
export function businessDateTimeToIso(value: string): string | null {
  const match = WALL_CLOCK_PATTERN.exec(value);
  if (!match) return null;

  const [, year, month, day, hour, minute, second = '0'] = match;
  const wallMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  // O deslocamento do fuso depende do instante: aproxima e corrige uma vez (vale em horário de verão).
  let instant = new Date(wallMs - (wallClockUtcMs(new Date(wallMs)) - wallMs));
  instant = new Date(wallMs - (wallClockUtcMs(instant) - instant.getTime()));
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}

// ---------------------------------------------------------------------------
// Documentos e placa: salvos sem máscara; a máscara é só de exibição.
// As máscaras funcionam com entrada parcial, então servem para campos de digitação.
// ---------------------------------------------------------------------------

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Placa para salvar: maiúscula, só letras e números, no máximo 7 caracteres. */
export function normalizePlate(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 7);
}

/** Aplica `pattern` (`#` = próximo caractere) sem escrever literais além do que foi digitado. */
function applyMask(chars: string, pattern: string): string {
  let result = '';
  let next = 0;
  for (const part of pattern) {
    if (next >= chars.length) break;
    result += part === '#' ? chars[next++] : part;
  }
  return result;
}

const CPF_PATTERN = '###.###.###-##';
const CNPJ_PATTERN = '##.###.###/####-##';
const CPF_LENGTH = 11;
/** O CNPJ alfanumérico (IN RFB 2.229/2024) tem 12 caracteres [0-9A-Z] e 2 dígitos verificadores. */
const CNPJ_BASE_LENGTH = 12;
const CNPJ_CHECK_DIGITS = 2;

function alphanumericUpper(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * CNPJ para salvar: maiúsculas, letras e números, no máximo 14 caracteres. Os 2 últimos (dígitos
 * verificadores) só aceitam número, então uma letra nessa posição é descartada.
 */
export function normalizeCnpj(value: string): string {
  const chars = alphanumericUpper(value);
  return (
    chars.slice(0, CNPJ_BASE_LENGTH) +
    onlyDigits(chars.slice(CNPJ_BASE_LENGTH)).slice(0, CNPJ_CHECK_DIGITS)
  );
}

/** Até 11 dígitos (sem letras) é CPF; com letra ou acima disso, CNPJ (alfanumérico). */
function isCpfLike(chars: string): boolean {
  return chars.length <= CPF_LENGTH && /^\d*$/.test(chars);
}

/** CPF/CNPJ para salvar, sem máscara. */
export function normalizeDocument(value: string): string {
  const chars = alphanumericUpper(value);
  return isCpfLike(chars) ? chars : normalizeCnpj(chars);
}

/** `12345678000195` -> `12.345.678/0001-95`; aceita o CNPJ alfanumérico (`12ABC34501DE35`). */
export function maskCnpj(value: string): string {
  return applyMask(normalizeCnpj(value), CNPJ_PATTERN);
}

/** Até 11 dígitos usa a máscara de CPF (`123.456.789-09`); acima disso ou com letra, a de CNPJ. */
export function maskCpfCnpj(value: string): string {
  const normalized = normalizeDocument(value);
  return applyMask(normalized, isCpfLike(normalized) ? CPF_PATTERN : CNPJ_PATTERN);
}

/** `ABC1D23` -> `ABC-1D23` (formato antigo e Mercosul). */
export function maskPlate(value: string): string {
  return applyMask(normalizePlate(value), '###-####');
}
