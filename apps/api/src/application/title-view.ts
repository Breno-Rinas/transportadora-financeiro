import type { LocalDate } from '../domain/shared/local-date.js';
import {
  classifyDueDate,
  getEffectiveDate,
  isOpenTitle,
  type DueBucket,
} from '../domain/title/agenda.js';
import { getTitleLocks, type TitleLocks } from '../domain/title/locks.js';
import type { TitleKind, TitleNature, TitleStatus } from '../domain/title/types.js';
import { buildTripFacts, type TripFacts } from '../domain/trip/facts.js';
import type { TripStatus } from '../domain/trip/types.js';
import type { Payment, Prisma, Title } from '../generated/prisma/client.js';
import { fromDbDate, fromNullableDbDate } from '../infra/db-date.js';
import type { PrismaClient } from '../infra/prisma.js';

export interface TitlePaymentView {
  paidOn: LocalDate;
  amountCents: number;
  note: string | null;
}

/** Título com datas sem hora já em `LocalDate`, data efetiva e travas (R4) calculadas. */
export interface TitleView {
  id: string;
  tripId: string;
  nature: TitleNature;
  kind: TitleKind;
  amountCents: number;
  dueDate: LocalDate | null;
  scheduledFor: LocalDate | null;
  effectiveDate: LocalDate | null;
  status: TitleStatus;
  payment: TitlePaymentView | null;
  createdAt: Date;
  updatedAt: Date;
  locks: TitleLocks;
}

export interface TitleTripSummaryView {
  id: string;
  code: number;
  origin: string;
  destination: string;
  status: TripStatus;
  client: { id: string; legalName: string };
  driver: { id: string; name: string; vehiclePlate: string };
}

/** Item da agenda: o título, a faixa da data efetiva e a viagem resumida. */
export interface TitleListView extends TitleView {
  /** Só para títulos em aberto; null nos pagos e cancelados. */
  bucket: DueBucket | null;
  trip: TitleTripSummaryView;
}

export function toTitleView(title: Title & { payments: Payment[] }, facts: TripFacts): TitleView {
  const dueDate = fromNullableDbDate(title.dueDate);
  const scheduledFor = fromNullableDbDate(title.scheduledFor);
  // A baixa é integral (R10): há no máximo um pagamento por título.
  const payment = title.payments.at(-1);
  return {
    id: title.id,
    tripId: title.tripId,
    nature: title.nature,
    kind: title.kind,
    amountCents: title.amountCents,
    dueDate,
    scheduledFor,
    effectiveDate: getEffectiveDate({ dueDate, scheduledFor }),
    status: title.status,
    payment:
      payment === undefined
        ? null
        : {
            paidOn: fromDbDate(payment.paidOn),
            amountCents: payment.amountCents,
            note: payment.note,
          },
    createdAt: title.createdAt,
    updatedAt: title.updatedAt,
    locks: getTitleLocks(title, facts),
  };
}

const titleListInclude = {
  payments: { orderBy: { createdAt: 'asc' } },
  trip: {
    select: {
      id: true,
      code: true,
      origin: true,
      destination: true,
      status: true,
      client: { select: { id: true, legalName: true } },
      driver: { select: { id: true, name: true, vehiclePlate: true } },
      events: { select: { type: true, occurredAt: true } },
      titles: { select: { kind: true, status: true } },
    },
  },
} satisfies Prisma.TitleInclude;

/**
 * Títulos com a viagem resumida e os fatos dela (para as travas), em poucas consultas: o Prisma
 * busca cada relação de todos os títulos de uma vez, sem N+1.
 */
export async function findTitleListViews(
  prisma: PrismaClient,
  where: Prisma.TitleWhereInput,
  today: LocalDate,
): Promise<TitleListView[]> {
  const titles = await prisma.title.findMany({ where, include: titleListInclude });

  return titles.map((title) => {
    const { events, titles: tripTitles, ...trip } = title.trip;
    const view = toTitleView(title, buildTripFacts(events, tripTitles));
    return {
      ...view,
      bucket: isOpenTitle(view.status) ? classifyDueDate(view.effectiveDate, today) : null,
      trip,
    };
  });
}
