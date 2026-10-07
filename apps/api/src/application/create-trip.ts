import { DomainError } from '../domain/errors.js';
import { assertPositiveCents, splitDriverFreight } from '../domain/shared/money.js';
import { INITIAL_STATUS_CHANGE } from '../domain/trip/lifecycle.js';
import type { UseCaseContext } from './context.js';
import { getTripDetail, type TripDetail } from './get-trip-detail.js';

export interface CreateTripInput {
  clientId: string;
  driverId: string;
  origin: string;
  destination: string;
  product: string;
  weightKg: number;
  quotedClientFreightCents?: number | null | undefined;
  driverFreightCents: number;
  advancePercent: number;
}

/** Cria a viagem com o acordo de frete e grava a primeira linha do histórico (TRIP_CREATED). */
export async function createTrip(
  context: UseCaseContext,
  input: CreateTripInput,
): Promise<TripDetail> {
  // Valida o acordo como o R2 o usa: frete positivo e adiantamento de 50% ou 70%.
  splitDriverFreight(input.driverFreightCents, input.advancePercent);
  const quotedClientFreightCents = input.quotedClientFreightCents ?? null;
  if (quotedClientFreightCents !== null) {
    assertPositiveCents(quotedClientFreightCents, 'Frete cotado');
  }
  const now = context.clock.now();

  const tripId = await context.prisma.$transaction(async (tx) => {
    const client = await tx.client.findUnique({
      where: { id: input.clientId },
      select: { id: true },
    });
    if (client === null) {
      throw new DomainError('NOT_FOUND', 'Cliente não encontrado.', { clientId: input.clientId });
    }
    const driver = await tx.driver.findUnique({
      where: { id: input.driverId },
      select: { id: true },
    });
    if (driver === null) {
      throw new DomainError('NOT_FOUND', 'Motorista não encontrado.', {
        driverId: input.driverId,
      });
    }

    const trip = await tx.trip.create({
      data: {
        clientId: client.id,
        driverId: driver.id,
        origin: input.origin,
        destination: input.destination,
        product: input.product,
        weightKg: input.weightKg,
        quotedClientFreightCents,
        status: INITIAL_STATUS_CHANGE.to,
        createdAt: now,
        updatedAt: now,
        agreement: {
          create: {
            driverFreightCents: input.driverFreightCents,
            advancePercent: input.advancePercent,
            createdAt: now,
          },
        },
        statusChanges: {
          create: {
            fromStatus: INITIAL_STATUS_CHANGE.from,
            toStatus: INITIAL_STATUS_CHANGE.to,
            trigger: INITIAL_STATUS_CHANGE.trigger,
            changedAt: now,
          },
        },
      },
      select: { id: true },
    });
    return trip.id;
  });

  return getTripDetail(context, tripId);
}
