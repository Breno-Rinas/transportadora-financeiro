import { z } from 'zod';
import { TitleKind, TitleNature, TitleStatus, TripStatus } from '../generated/prisma/client.js';

// Schemas Zod das entradas (body, params e query). Validam forma e tipos; as regras de negócio
// (documentos, datas permitidas, travas) ficam no domínio.

const MAX_CENTS = 2_147_483_647; // coluna Int

const requiredText = z.string().trim().min(1).max(200);
const optionalNote = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .transform((value) => (value === '' ? undefined : value));
const positiveCents = z.int().positive().max(MAX_CENTS);

/** Data sem hora, `YYYY-MM-DD`. */
const localDate = z.iso.date();
/** Instante ISO 8601 com fuso (`Z` ou `-03:00`). */
const instant = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

/** Query opcional: string vazia conta como ausente. */
const optionalQueryText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === '' ? undefined : value));

const tripStatus = z.enum(TripStatus);
const titleNature = z.enum(TitleNature);
const titleKind = z.enum(TitleKind);
const titleStatus = z.enum(TitleStatus);

export const idParamsSchema = z.object({ id: z.uuid() });

export const searchQuerySchema = z.object({ q: optionalQueryText });

export const createClientSchema = z.object({
  legalName: requiredText,
  cnpj: z.string().trim().min(1).max(30),
  paymentTermDays: z.int().min(0).max(999),
});

export const createDriverSchema = z.object({
  name: requiredText,
  document: z.string().trim().min(1).max(30),
  vehiclePlate: z.string().trim().min(1).max(10),
  pixKey: requiredText,
});

export const listTripsQuerySchema = z.object({
  status: tripStatus.optional(),
  clientId: z.uuid().optional(),
  driverId: z.uuid().optional(),
  from: localDate.optional(),
  to: localDate.optional(),
  q: optionalQueryText,
});

export const createTripSchema = z.object({
  clientId: z.uuid(),
  driverId: z.uuid(),
  origin: requiredText,
  destination: requiredText,
  product: requiredText,
  weightKg: z.int().positive().max(1_000_000),
  quotedClientFreightCents: positiveCents.nullish(),
  driverFreightCents: positiveCents,
  advancePercent: z.union([z.literal(50), z.literal(70)]),
});

export const registerCteSchema = z.object({
  number: z.int().min(1).max(999_999_999),
  series: z.int().min(0).max(999),
  issuedAt: instant,
  clientFreightCents: positiveCents,
});

/** Campos do multipart da foto, já lidos do stream. */
export const loadingPhotoFormSchema = z.object({
  file: z.object(
    { buffer: z.instanceof(Buffer), filename: z.string() },
    { error: 'Envie a foto do carregamento no campo "file".' },
  ),
  occurredAt: instant.optional(),
});

export const registerUnloadingSchema = z.object({ occurredAt: instant });

export const registerProofsSchema = z.object({ occurredAt: instant, note: optionalNote });

export const cancelTripSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
  occurredAt: instant.optional(),
});

export const listTitlesQuerySchema = z.object({
  nature: titleNature.optional(),
  kind: titleKind.optional(),
  status: titleStatus.optional(),
  dueFrom: localDate.optional(),
  dueTo: localDate.optional(),
  locked: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  tripId: z.uuid().optional(),
});

export const scheduleTitleSchema = z.object({ date: localDate });

export const scheduleTitlesSchema = z.object({
  titleIds: z.array(z.uuid()).min(1).max(500),
  date: localDate,
});

export const settleTitleSchema = z.object({
  paidOn: localDate,
  amountCents: positiveCents,
  note: optionalNote,
});

export const dashboardQuerySchema = z.object({
  from: localDate.optional(),
  to: localDate.optional(),
});
