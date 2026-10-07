import { stripMask } from '../domain/shared/documents.js';
import { addDays, startOfBusinessDay, type LocalDate } from '../domain/shared/local-date.js';
import { buildTripFacts } from '../domain/trip/facts.js';
import { getClientFreightCents } from '../domain/trip/freight.js';
import { calculateTripMargin, type Margin } from '../domain/trip/margin.js';
import { getPendingSteps, type PendingStep } from '../domain/trip/pending-steps.js';
import type { TripStatus } from '../domain/trip/types.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { UseCaseContext } from './context.js';

export interface ListTripsFilters {
  status?: TripStatus | undefined;
  clientId?: string | undefined;
  driverId?: string | undefined;
  /** Período inclusivo pela data de negócio da criação. */
  from?: LocalDate | undefined;
  to?: LocalDate | undefined;
  /** Busca em código, origem, destino, produto, cliente, motorista e placa. */
  q?: string | undefined;
}

export interface TripListItem {
  id: string;
  code: number;
  status: TripStatus;
  origin: string;
  destination: string;
  product: string;
  weightKg: number;
  client: { id: string; legalName: string };
  driver: { id: string; name: string; vehiclePlate: string };
  createdAt: Date;
  /** Valor do CT-e ou, sem CT-e, o frete cotado; null se nenhum dos dois. */
  clientFreightCents: number | null;
  driverFreightCents: number;
  pendingSteps: PendingStep[];
  margin: Margin | null;
}

/**
 * Lista de viagens, da mais recente para a mais antiga, com fretes, pendências e margem vindos
 * do domínio. O Prisma busca cada relação de todas as viagens de uma vez (sem N+1).
 */
export async function listTrips(
  context: UseCaseContext,
  filters: ListTripsFilters,
): Promise<TripListItem[]> {
  const trips = await context.prisma.trip.findMany({
    where: buildWhere(filters, context.businessTz),
    orderBy: { code: 'desc' },
    include: {
      client: { select: { id: true, legalName: true } },
      driver: { select: { id: true, name: true, vehiclePlate: true } },
      agreement: { select: { driverFreightCents: true } },
      cte: { select: { clientFreightCents: true } },
      events: { select: { type: true, occurredAt: true } },
      titles: { select: { kind: true, status: true, amountCents: true } },
    },
  });

  return trips.map(({ agreement, cte, events, titles, ...trip }) => {
    if (agreement === null) throw new Error(`Viagem ${trip.id} sem acordo de frete.`);
    return {
      id: trip.id,
      code: trip.code,
      status: trip.status,
      origin: trip.origin,
      destination: trip.destination,
      product: trip.product,
      weightKg: trip.weightKg,
      client: trip.client,
      driver: trip.driver,
      createdAt: trip.createdAt,
      clientFreightCents: getClientFreightCents({
        cteClientFreightCents: cte?.clientFreightCents ?? null,
        quotedClientFreightCents: trip.quotedClientFreightCents,
      }),
      driverFreightCents: agreement.driverFreightCents,
      pendingSteps: getPendingSteps(buildTripFacts(events, titles)),
      margin: calculateTripMargin({
        titles,
        quotedClientFreightCents: trip.quotedClientFreightCents,
        driverFreightCents: agreement.driverFreightCents,
        cancelled: trip.status === 'CANCELLED',
      }),
    };
  });
}

function buildWhere(filters: ListTripsFilters, businessTz: string): Prisma.TripWhereInput {
  const { status, clientId, driverId, from, to, q } = filters;
  return {
    status,
    clientId,
    driverId,
    createdAt: {
      gte: from === undefined ? undefined : startOfBusinessDay(from, businessTz),
      lt: to === undefined ? undefined : startOfBusinessDay(addDays(to, 1), businessTz),
    },
    OR: q === undefined ? undefined : buildSearch(q),
  };
}

const MAX_TRIP_CODE = 2_147_483_647;

function buildSearch(q: string): Prisma.TripWhereInput[] {
  const contains = { contains: q, mode: 'insensitive' } as const;
  const search: Prisma.TripWhereInput[] = [
    { origin: contains },
    { destination: contains },
    { product: contains },
    { client: { legalName: contains } },
    { driver: { name: contains } },
  ];

  // Código como exibido (VG-0012) ou só o número (12).
  const codeMatch = /^(?:VG-?)?(\d{1,10})$/i.exec(q);
  const code = codeMatch === null ? null : Number(codeMatch[1]);
  if (code !== null && code <= MAX_TRIP_CODE) search.push({ code });

  const plate = stripMask(q);
  if (plate !== '') search.push({ driver: { vehiclePlate: { contains: plate } } });
  return search;
}
