import dayjs from 'dayjs';
import type { DueBucket, TitleListItem } from '../../api/types';
import type { BoardColumnTone } from '../../components';
import { DUE_BUCKET_LABEL } from '../../lib/labels';

/** Dias à frente de hoje que ganham coluna própria (a faixa `WITHIN_WEEK` vai até hoje + 6). */
const DAYS_AHEAD = 6;
const LOCAL_DATE_FORMAT = 'YYYY-MM-DD';

export interface FinanceColumn {
  /** Chave estável; serve de âncora da coluna. */
  key: string;
  /** Faixa da API a que a coluna pertence (para destacar pelo `?bucket=`). */
  bucket: DueBucket;
  label: string;
  eyebrow?: string;
  tone: BoardColumnTone;
  items: TitleListItem[];
}

/** `2026-10-07` -> `quarta, 07/10` (dayjs pt-br; o dia da semana sem o "-feira"). */
function dayLabel(date: string): string {
  return dayjs(date).format('dddd, DD/MM').replace('-feira', '');
}

function addDays(date: string, days: number): string {
  return dayjs(date).add(days, 'day').format(LOCAL_DATE_FORMAT);
}

/**
 * Colunas do quadro: Vencidos, Hoje, Amanhã, um dia por coluna ("quarta, 07/10") até hoje + 6,
 * Depois e Sem data.
 * A coluna do título vem de `bucket`; dentro de `WITHIN_WEEK` o agrupamento é pela data efetiva
 * (apresentação, não regra). `today` é o "hoje" do fuso de negócio.
 */
export function buildFinanceColumns(
  items: readonly TitleListItem[],
  today: string,
): FinanceColumn[] {
  const inBucket = (bucket: DueBucket) => items.filter((item) => item.bucket === bucket);
  const week = inBucket('WITHIN_WEEK');

  const days = new Set<string>();
  for (let offset = 1; offset <= DAYS_AHEAD; offset += 1) days.add(addDays(today, offset));
  // Uma data fora da janela esperada (relógios desencontrados) ganha coluna em vez de sumir.
  for (const item of week) if (item.effectiveDate) days.add(item.effectiveDate);
  const tomorrow = addDays(today, 1);

  const dayColumns = [...days].sort().map<FinanceColumn>((date) => ({
    key: date,
    bucket: 'WITHIN_WEEK',
    label: date === tomorrow ? 'Amanhã' : dayLabel(date),
    tone: 'default',
    items: week.filter((item) => item.effectiveDate === date),
  }));

  return [
    {
      key: 'OVERDUE',
      bucket: 'OVERDUE',
      label: DUE_BUCKET_LABEL.OVERDUE,
      eyebrow: 'Atenção',
      tone: 'red',
      items: inBucket('OVERDUE'),
    },
    {
      key: 'TODAY',
      bucket: 'TODAY',
      label: DUE_BUCKET_LABEL.TODAY,
      eyebrow: 'Hoje',
      tone: 'indigo',
      items: inBucket('TODAY'),
    },
    ...dayColumns,
    {
      key: 'LATER',
      bucket: 'LATER',
      label: DUE_BUCKET_LABEL.LATER,
      tone: 'default',
      items: inBucket('LATER'),
    },
    {
      key: 'NO_DATE',
      bucket: 'NO_DATE',
      label: DUE_BUCKET_LABEL.NO_DATE,
      tone: 'default',
      items: inBucket('NO_DATE'),
    },
  ];
}
