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
const CNPJ_LENGTH = 14;

/** `12345678000195` -> `12.345.678/0001-95`. */
export function maskCnpj(value: string): string {
  return applyMask(onlyDigits(value).slice(0, CNPJ_LENGTH), CNPJ_PATTERN);
}

/** Até 11 dígitos usa a máscara de CPF (`123.456.789-09`); acima disso, a de CNPJ. */
export function maskCpfCnpj(value: string): string {
  const digits = onlyDigits(value).slice(0, CNPJ_LENGTH);
  return applyMask(digits, digits.length <= CPF_LENGTH ? CPF_PATTERN : CNPJ_PATTERN);
}

/** `ABC1D23` -> `ABC-1D23` (formato antigo e Mercosul). */
export function maskPlate(value: string): string {
  return applyMask(normalizePlate(value), '###-####');
}
