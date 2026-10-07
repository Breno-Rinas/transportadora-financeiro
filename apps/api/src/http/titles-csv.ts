import type { TitleListView } from '../application/title-view.js';
import type { LocalDate } from '../domain/shared/local-date.js';
import {
  getTitleCounterparty,
  getTitleStatusLabel,
  TITLE_KIND_LABELS,
  TITLE_NATURE_LABELS,
} from '../domain/title/labels.js';

// Exportação da agenda de títulos em CSV para o Excel pt-BR: separador `;`, vírgula decimal,
// datas dd/mm/aaaa, CRLF entre linhas e BOM UTF-8 (sem ele, o Excel lê os acentos como ANSI).

const SEPARATOR = ';';
const LINE_BREAK = '\r\n';
const UTF8_BOM = '﻿';

const HEADER = [
  'Viagem',
  'Natureza',
  'Espécie',
  'Cliente/Motorista',
  'Valor',
  'Vencimento',
  'Programado para',
  'Status',
  'Motivo da trava',
];

/** Centavos em "1234,56": vírgula decimal e sem separador de milhar, para o Excel ler número. */
export function formatCsvAmount(cents: number): string {
  const absolute = Math.abs(cents);
  const reais = (absolute - (absolute % 100)) / 100;
  const centavos = String(absolute % 100).padStart(2, '0');
  return `${cents < 0 ? '-' : ''}${reais},${centavos}`;
}

/** `YYYY-MM-DD` em dd/mm/aaaa, manipulando a string (sem `Date`); sem data, célula vazia. */
export function formatCsvDate(date: LocalDate | null): string {
  if (date === null) return '';
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

/** Aspas quando o valor tem separador, aspas ou quebra de linha; aspas internas são dobradas. */
function escapeCell(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Texto digitado pelo usuário que o Excel executaria como fórmula ganha um apóstrofo na frente. */
function neutralizeFormula(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function formatTripCode(code: number): string {
  return `VG-${String(code).padStart(4, '0')}`;
}

function toRow(title: TitleListView): string[] {
  const { trip } = title;
  const counterparty =
    getTitleCounterparty(title.kind) === 'CLIENT' ? trip.client.legalName : trip.driver.name;
  return [
    formatTripCode(trip.code),
    TITLE_NATURE_LABELS[title.nature],
    TITLE_KIND_LABELS[title.kind],
    neutralizeFormula(counterparty),
    formatCsvAmount(title.amountCents),
    formatCsvDate(title.dueDate),
    formatCsvDate(title.scheduledFor),
    getTitleStatusLabel(title.status, title.nature),
    title.locks.reasons.map((reason) => reason.message).join('; '),
  ];
}

/** CSV da agenda, na ordem recebida, com cabeçalho e BOM. */
export function serializeTitlesCsv(titles: readonly TitleListView[]): string {
  const lines = [HEADER, ...titles.map(toRow)].map((cells) =>
    cells.map(escapeCell).join(SEPARATOR),
  );
  return `${UTF8_BOM}${lines.join(LINE_BREAK)}${LINE_BREAK}`;
}
