import type { MantineColor } from '@mantine/core';
import type {
  AdvancePercent,
  AttachmentKind,
  DueBucket,
  MarginKind,
  TitleKind,
  TitleNature,
  TitleStatus,
  TripEventType,
  TripStatus,
} from '../api/types';

/**
 * Rótulos e cores dos enums. É apresentação, não regra. As cores são nomes da paleta do Mantine
 * (provisórias até o design das telas): vermelho fica reservado para o que exige ação ou é
 * negativo (vencido, margem negativa) e laranja para travas.
 */

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  CREATED: 'Criada',
  LOADED: 'Carregada',
  ADVANCE_PAID: 'Adiantamento pago',
  UNLOADED: 'Descarregada',
  PROOFS_RECEIVED: 'Comprovantes recebidos',
  BALANCE_PAID: 'Finalizada',
  CANCELLED: 'Cancelada',
};

export const TRIP_STATUS_COLOR: Record<TripStatus, MantineColor> = {
  CREATED: 'gray',
  LOADED: 'blue',
  ADVANCE_PAID: 'cyan',
  UNLOADED: 'grape',
  PROOFS_RECEIVED: 'teal',
  BALANCE_PAID: 'green',
  CANCELLED: 'dark',
};

/** Estados oferecidos como filtro, na ordem do ciclo de vida (sem `CANCELLED`, ainda reservado). */
export const TRIP_STATUS_FILTER_ORDER: readonly TripStatus[] = [
  'CREATED',
  'LOADED',
  'ADVANCE_PAID',
  'UNLOADED',
  'PROOFS_RECEIVED',
  'BALANCE_PAID',
];

/** Todos os estados válidos de viagem, para validar valores vindos da querystring. */
export const TRIP_STATUSES = Object.keys(TRIP_STATUS_LABEL) as TripStatus[];

export const TITLE_STATUS_LABEL: Record<TitleStatus, string> = {
  OPEN: 'Em aberto',
  SCHEDULED: 'Programado',
  PAID: 'Pago',
  CANCELLED: 'Cancelado',
};

/** Título a receber já baixado é "Recebido", não "Pago". */
export function titleStatusLabel(status: TitleStatus, nature?: TitleNature): string {
  return status === 'PAID' && nature === 'RECEIVABLE' ? 'Recebido' : TITLE_STATUS_LABEL[status];
}

export const TITLE_STATUS_COLOR: Record<TitleStatus, MantineColor> = {
  OPEN: 'yellow',
  SCHEDULED: 'indigo',
  PAID: 'green',
  CANCELLED: 'gray',
};

export const TITLE_NATURE_LABEL: Record<TitleNature, string> = {
  PAYABLE: 'A pagar',
  RECEIVABLE: 'A receber',
};

export const TITLE_KIND_LABEL: Record<TitleKind, string> = {
  ADVANCE: 'Adiantamento',
  BALANCE: 'Saldo',
  CLIENT_FREIGHT: 'Frete do cliente',
};

/** Faixas da agenda do Financeiro, na ordem de exibição. */
export const DUE_BUCKET_ORDER: readonly DueBucket[] = [
  'OVERDUE',
  'TODAY',
  'WITHIN_WEEK',
  'LATER',
  'NO_DATE',
];

export const DUE_BUCKET_LABEL: Record<DueBucket, string> = {
  OVERDUE: 'Vencidos',
  TODAY: 'Hoje',
  WITHIN_WEEK: 'Próximos 7 dias',
  LATER: 'Depois',
  NO_DATE: 'Sem data',
};

export const DUE_BUCKET_COLOR: Record<DueBucket, MantineColor> = {
  OVERDUE: 'red',
  TODAY: 'orange',
  WITHIN_WEEK: 'yellow',
  LATER: 'gray',
  NO_DATE: 'gray',
};

export const TRIP_EVENT_LABEL: Record<TripEventType, string> = {
  CTE_ISSUED: 'CT-e emitido',
  LOADING_PHOTO_ATTACHED: 'Foto do carregamento anexada',
  UNLOADED: 'Descarga registrada',
  PROOFS_RECEIVED: 'Canhoto original recebido',
};

export const ATTACHMENT_KIND_LABEL: Record<AttachmentKind, string> = {
  LOADING_PHOTO: 'Foto do carregamento',
  DELIVERY_RECEIPT: 'Comprovante de entrega',
};

export const MARGIN_KIND_LABEL: Record<MarginKind, string> = {
  REALIZED: 'Realizada',
  PROJECTED: 'Projetada',
};

/** Opções do adiantamento (50/70) para o seletor segmentado. */
export const ADVANCE_PERCENT_OPTIONS: readonly { value: AdvancePercent; label: string }[] = [
  { value: 50, label: '50%' },
  { value: 70, label: '70%' },
];

/** Cores semânticas compartilhadas pelos componentes. */
export const SEMANTIC_COLOR = {
  /** Valor negativo, margem negativa, vencido. */
  danger: 'red',
  /** Trava de saldo e vencendo hoje. */
  warning: 'orange',
  /** Concluído, sem pendência. */
  success: 'green',
} as const satisfies Record<string, MantineColor>;
