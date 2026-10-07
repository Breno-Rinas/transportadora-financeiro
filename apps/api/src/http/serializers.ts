import type { DashboardView } from '../application/get-dashboard.js';
import type { TimelineEntry, TripDetail } from '../application/get-trip-detail.js';
import type { TripListItem } from '../application/list-trips.js';
import type { ScheduleTitlesResult } from '../application/schedule-titles.js';
import type { TitleListView, TitleView } from '../application/title-view.js';
import type { Attachment, Client, Driver } from '../generated/prisma/client.js';
import type {
  AttachmentDto,
  ClientDto,
  DashboardDto,
  DriverDto,
  ScheduleResultDto,
  TimelineEntryDto,
  TitleDto,
  TitleListItemDto,
  TitleWithLocksDto,
  TripDetailDto,
  TripListItemDto,
} from './dto.js';

// Os serializers escolhem campo a campo o que sai (nada de modelo do Prisma vazando) e convertem
// instantes para ISO. Datas sem hora já chegam da application como `YYYY-MM-DD`.

/** Prefixo em que `@fastify/static` serve a pasta de uploads. */
const UPLOADS_PREFIX = '/uploads/';

const iso = (instant: Date): string => instant.toISOString();

export function serializeClient(client: Client): ClientDto {
  return {
    id: client.id,
    legalName: client.legalName,
    cnpj: client.cnpj,
    paymentTermDays: client.paymentTermDays,
    createdAt: iso(client.createdAt),
  };
}

export function serializeDriver(driver: Driver): DriverDto {
  return {
    id: driver.id,
    name: driver.name,
    document: driver.document,
    vehiclePlate: driver.vehiclePlate,
    pixKey: driver.pixKey,
    createdAt: iso(driver.createdAt),
  };
}

export function serializeTripListItem(item: TripListItem): TripListItemDto {
  return {
    id: item.id,
    code: item.code,
    status: item.status,
    origin: item.origin,
    destination: item.destination,
    product: item.product,
    weightKg: item.weightKg,
    client: { id: item.client.id, legalName: item.client.legalName },
    driver: { id: item.driver.id, name: item.driver.name, vehiclePlate: item.driver.vehiclePlate },
    createdAt: iso(item.createdAt),
    pendingSteps: item.pendingSteps,
    margin: item.margin,
  };
}

function serializeAttachment(attachment: Attachment): AttachmentDto {
  return {
    id: attachment.id,
    kind: attachment.kind,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    url: `${UPLOADS_PREFIX}${attachment.storagePath}`,
    createdAt: iso(attachment.createdAt),
  };
}

function serializeTimelineEntry(entry: TimelineEntry): TimelineEntryDto {
  switch (entry.type) {
    case 'EVENT':
      return { ...entry, at: iso(entry.at), recordedAt: iso(entry.recordedAt) };
    case 'PAYMENT':
    case 'STATUS_CHANGE':
      return { ...entry, at: iso(entry.at) };
  }
}

export function serializeTripDetail(detail: TripDetail): TripDetailDto {
  const { trip, agreement, cte } = detail;
  return {
    trip: {
      id: trip.id,
      code: trip.code,
      status: trip.status,
      origin: trip.origin,
      destination: trip.destination,
      product: trip.product,
      weightKg: trip.weightKg,
      quotedClientFreightCents: trip.quotedClientFreightCents,
      createdAt: iso(trip.createdAt),
      updatedAt: iso(trip.updatedAt),
    },
    client: serializeClient(detail.client),
    driver: serializeDriver(detail.driver),
    agreement: {
      driverFreightCents: agreement.driverFreightCents,
      advancePercent: agreement.advancePercent,
      createdAt: iso(agreement.createdAt),
    },
    cte:
      cte === null
        ? null
        : {
            id: cte.id,
            number: cte.number,
            series: cte.series,
            issuedAt: iso(cte.issuedAt),
            clientFreightCents: cte.clientFreightCents,
            createdAt: iso(cte.createdAt),
          },
    attachments: detail.attachments.map(serializeAttachment),
    timeline: detail.timeline.map(serializeTimelineEntry),
    titles: detail.titles.map(serializeTitleWithLocks),
    margin: detail.margin,
    pendingSteps: detail.pendingSteps,
  };
}

export function serializeTitle(title: TitleView): TitleDto {
  return {
    id: title.id,
    tripId: title.tripId,
    nature: title.nature,
    kind: title.kind,
    amountCents: title.amountCents,
    dueDate: title.dueDate,
    scheduledFor: title.scheduledFor,
    effectiveDate: title.effectiveDate,
    status: title.status,
    payment: title.payment,
    createdAt: iso(title.createdAt),
    updatedAt: iso(title.updatedAt),
  };
}

export function serializeTitleWithLocks(title: TitleView): TitleWithLocksDto {
  return { ...serializeTitle(title), locks: title.locks };
}

export function serializeTitleListItem(title: TitleListView): TitleListItemDto {
  const { trip } = title;
  return {
    ...serializeTitleWithLocks(title),
    bucket: title.bucket,
    trip: {
      id: trip.id,
      code: trip.code,
      origin: trip.origin,
      destination: trip.destination,
      status: trip.status,
      client: { id: trip.client.id, legalName: trip.client.legalName },
      driver: {
        id: trip.driver.id,
        name: trip.driver.name,
        vehiclePlate: trip.driver.vehiclePlate,
      },
    },
  };
}

export function serializeScheduleResult(result: ScheduleTitlesResult): ScheduleResultDto {
  return {
    scheduled: result.scheduled.map(serializeTitle),
    rejected: result.rejected.map(({ titleId, code, message }) => ({ titleId, code, message })),
  };
}

export function serializeDashboard(dashboard: DashboardView): DashboardDto {
  return {
    today: dashboard.today,
    period: { from: dashboard.period.from, to: dashboard.period.to },
    payableOverdue: dashboard.payableOverdue,
    payableDueToday: dashboard.payableDueToday,
    payableDueWeek: dashboard.payableDueWeek,
    receivableOpen: dashboard.receivableOpen,
    lockedBalances: dashboard.lockedBalances,
    margin: dashboard.margin,
  };
}
