import type { LocalDate } from '../domain/shared/local-date.js';
import type { TitleKind } from '../domain/title/types.js';
import { buildTripFacts } from '../domain/trip/facts.js';
import { calculateTripMargin, type Margin } from '../domain/trip/margin.js';
import { getPendingSteps, type PendingStep } from '../domain/trip/pending-steps.js';
import type { TripEventType, TripStatus } from '../domain/trip/types.js';
import type {
  Attachment,
  Client,
  Cte,
  Driver,
  FreightAgreement,
  Prisma,
  Trip,
} from '../generated/prisma/client.js';
import { fromDbDate } from '../infra/db-date.js';
import type { UseCaseContext } from './context.js';
import { toTitleView, type TitleView } from './title-view.js';
import { tripNotFound } from './trip-state.js';

export type TimelineEntry =
  | {
      type: 'EVENT';
      id: string;
      /** `occurredAt`: quando o fato aconteceu. */
      at: Date;
      eventType: TripEventType;
      recordedAt: Date;
      note: string | null;
      cteId: string | null;
      attachmentId: string | null;
    }
  | {
      type: 'PAYMENT';
      id: string;
      /** Instante do registro da baixa. */
      at: Date;
      titleId: string;
      titleKind: TitleKind;
      paidOn: LocalDate;
      amountCents: number;
      note: string | null;
    }
  | {
      type: 'STATUS_CHANGE';
      id: string;
      at: Date;
      fromStatus: TripStatus | null;
      toStatus: TripStatus;
      trigger: string;
    };

export interface TripDetail {
  trip: Trip;
  client: Client;
  driver: Driver;
  agreement: FreightAgreement;
  cte: Cte | null;
  attachments: Attachment[];
  /** Eventos, baixas e transições, do mais antigo para o mais recente. */
  timeline: TimelineEntry[];
  titles: TitleView[];
  margin: Margin | null;
  pendingSteps: PendingStep[];
}

const tripDetailInclude = {
  client: true,
  driver: true,
  agreement: true,
  cte: true,
  attachments: { orderBy: { createdAt: 'asc' } },
  events: { orderBy: { occurredAt: 'asc' } },
  // Transições gravadas no mesmo instante saem na ordem do ciclo (ordem do enum no Postgres).
  statusChanges: { orderBy: [{ changedAt: 'asc' }, { toStatus: 'asc' }] },
  titles: { orderBy: { kind: 'asc' }, include: { payments: { orderBy: { createdAt: 'asc' } } } },
} satisfies Prisma.TripInclude;

type TripDetailRecord = Prisma.TripGetPayload<{ include: typeof tripDetailInclude }>;

/** Detalhe da viagem: dados, linha do tempo, títulos com travas, margem (R7) e pendências. */
export async function getTripDetail(context: UseCaseContext, tripId: string): Promise<TripDetail> {
  const record = await context.prisma.trip.findUnique({
    where: { id: tripId },
    include: tripDetailInclude,
  });
  if (record === null) throw tripNotFound(tripId);
  const { client, driver, agreement, cte, attachments, events, statusChanges, titles, ...trip } =
    record;
  if (agreement === null) throw new Error(`Viagem ${tripId} sem acordo de frete.`);

  const facts = buildTripFacts(events, titles);

  return {
    trip,
    client,
    driver,
    agreement,
    cte,
    attachments,
    timeline: buildTimeline({ events, statusChanges, titles }),
    titles: titles.map((title) => toTitleView(title, facts)),
    margin: calculateTripMargin({
      titles,
      quotedClientFreightCents: trip.quotedClientFreightCents,
      driverFreightCents: agreement.driverFreightCents,
      cancelled: trip.status === 'CANCELLED',
    }),
    pendingSteps: getPendingSteps(facts),
  };
}

/**
 * Junta eventos, baixas e transições e ordena por instante. Em empate, o fato vem antes da baixa
 * e a baixa antes da transição que ela provocou (a ordenação é estável).
 */
function buildTimeline({
  events,
  statusChanges,
  titles,
}: Pick<TripDetailRecord, 'events' | 'statusChanges' | 'titles'>): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...events.map((event) => ({
      type: 'EVENT' as const,
      id: event.id,
      at: event.occurredAt,
      eventType: event.type,
      recordedAt: event.recordedAt,
      note: event.note,
      cteId: event.cteId,
      attachmentId: event.attachmentId,
    })),
    ...titles.flatMap((title) =>
      title.payments.map((payment) => ({
        type: 'PAYMENT' as const,
        id: payment.id,
        at: payment.createdAt,
        titleId: title.id,
        titleKind: title.kind,
        paidOn: fromDbDate(payment.paidOn),
        amountCents: payment.amountCents,
        note: payment.note,
      })),
    ),
    ...statusChanges.map((change) => ({
      type: 'STATUS_CHANGE' as const,
      id: change.id,
      at: change.changedAt,
      fromStatus: change.fromStatus,
      toStatus: change.toStatus,
      trigger: change.trigger,
    })),
  ];
  return entries.sort((a, b) => a.at.getTime() - b.at.getTime());
}
