// Formatos das respostas da API (contrato com o front: apps/web/src/api/types.ts).
// Datas sem hora saem como `YYYY-MM-DD`; instantes, como ISO 8601.

import type { DueBucket } from '../domain/title/agenda.js';
import type { TitleLocks } from '../domain/title/locks.js';
import type { TitleKind, TitleNature, TitleStatus } from '../domain/title/types.js';
import type { Margin } from '../domain/trip/margin.js';
import type { PendingStep } from '../domain/trip/pending-steps.js';
import type { TripEventType, TripStatus } from '../domain/trip/types.js';
import type { LocalDate } from '../domain/shared/local-date.js';

export type IsoDateTime = string;

export interface ClientDto {
  id: string;
  legalName: string;
  cnpj: string;
  paymentTermDays: number;
  createdAt: IsoDateTime;
}

export interface DriverDto {
  id: string;
  name: string;
  document: string;
  vehiclePlate: string;
  pixKey: string;
  createdAt: IsoDateTime;
}

export interface ClientRefDto {
  id: string;
  legalName: string;
}

export interface DriverRefDto {
  id: string;
  name: string;
  vehiclePlate: string;
}

export interface TripListItemDto {
  id: string;
  code: number;
  status: TripStatus;
  origin: string;
  destination: string;
  product: string;
  weightKg: number;
  client: ClientRefDto;
  driver: DriverRefDto;
  createdAt: IsoDateTime;
  /** Valor do CT-e ou, sem CT-e, o frete cotado; null se nenhum dos dois. */
  clientFreightCents: number | null;
  driverFreightCents: number;
  pendingSteps: PendingStep[];
  margin: Margin | null;
}

export interface TripDto {
  id: string;
  code: number;
  status: TripStatus;
  origin: string;
  destination: string;
  product: string;
  weightKg: number;
  quotedClientFreightCents: number | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface FreightAgreementDto {
  driverFreightCents: number;
  advancePercent: number;
  createdAt: IsoDateTime;
}

export interface CteDto {
  id: string;
  number: number;
  series: number;
  issuedAt: IsoDateTime;
  clientFreightCents: number;
  createdAt: IsoDateTime;
}

export interface AttachmentDto {
  id: string;
  kind: 'LOADING_PHOTO' | 'DELIVERY_RECEIPT';
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: IsoDateTime;
}

export type TimelineEntryDto =
  | {
      type: 'EVENT';
      id: string;
      at: IsoDateTime;
      eventType: TripEventType;
      recordedAt: IsoDateTime;
      note: string | null;
      cteId: string | null;
      attachmentId: string | null;
    }
  | {
      type: 'STATUS_CHANGE';
      id: string;
      at: IsoDateTime;
      fromStatus: TripStatus | null;
      toStatus: TripStatus;
      trigger: string;
    }
  | {
      type: 'PAYMENT';
      id: string;
      at: IsoDateTime;
      titleId: string;
      titleKind: TitleKind;
      paidOn: LocalDate;
      amountCents: number;
      note: string | null;
    };

export interface TitleDto {
  id: string;
  tripId: string;
  nature: TitleNature;
  kind: TitleKind;
  amountCents: number;
  dueDate: LocalDate | null;
  scheduledFor: LocalDate | null;
  effectiveDate: LocalDate | null;
  status: TitleStatus;
  payment: { paidOn: LocalDate; amountCents: number; note: string | null } | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface TitleWithLocksDto extends TitleDto {
  locks: TitleLocks;
}

export interface TitleListItemDto extends TitleWithLocksDto {
  bucket: DueBucket | null;
  trip: {
    id: string;
    code: number;
    origin: string;
    destination: string;
    status: TripStatus;
    client: ClientRefDto;
    driver: DriverRefDto;
  };
}

export interface TripDetailDto {
  trip: TripDto;
  client: ClientDto;
  driver: DriverDto;
  agreement: FreightAgreementDto;
  cte: CteDto | null;
  attachments: AttachmentDto[];
  timeline: TimelineEntryDto[];
  titles: TitleWithLocksDto[];
  margin: Margin | null;
  pendingSteps: PendingStep[];
}

export interface ScheduleResultDto {
  scheduled: TitleDto[];
  rejected: { titleId: string; code: string; message: string }[];
}

export interface TitleTotalsDto {
  count: number;
  totalCents: number;
}

export interface DashboardDto {
  today: LocalDate;
  period: { from: LocalDate; to: LocalDate };
  payableOverdue: TitleTotalsDto;
  payableDueToday: TitleTotalsDto;
  payableDueWeek: TitleTotalsDto;
  receivableOpen: TitleTotalsDto & { overdueCount: number };
  lockedBalances: TitleTotalsDto;
  margin: { amountCents: number; percent: number | null };
}
