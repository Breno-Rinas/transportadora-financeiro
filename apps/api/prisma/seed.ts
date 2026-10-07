import { resolve } from 'node:path';
import { attachLoadingPhoto } from '../src/application/attach-loading-photo.js';
import { cancelTrip } from '../src/application/cancel-trip.js';
import type { UseCaseContext } from '../src/application/context.js';
import { createClient } from '../src/application/create-client.js';
import { createDriver } from '../src/application/create-driver.js';
import { createTrip } from '../src/application/create-trip.js';
import { getTripDetail } from '../src/application/get-trip-detail.js';
import { registerCte } from '../src/application/register-cte.js';
import { registerProofs } from '../src/application/register-proofs.js';
import { registerUnloading } from '../src/application/register-unloading.js';
import { scheduleTitles } from '../src/application/schedule-titles.js';
import { settleTitle } from '../src/application/settle-title.js';
import { addDays, startOfBusinessDay, toBusinessDate } from '../src/domain/shared/local-date.js';
import type { TitleKind } from '../src/domain/title/types.js';
import { env } from '../src/infra/env.js';
import { prisma } from '../src/infra/prisma.js';
import { createDiskStorage } from '../src/infra/storage.js';
import { createLoadingPhoto } from './seed-photo.js';

// Seed de demonstração (CLAUDE.md, seção "Seed"). Passa pelos casos de uso, como o HTTP, para
// que títulos, travas e status sejam os que as regras produzem. As datas são relativas a hoje:
// o relógio dos casos de uso é posicionado no instante de cada passo do roteiro.

const businessTz = env.BUSINESS_TZ;
const realNow = new Date();
const today = toBusinessDate(realNow, businessTz);

let clockNow = realNow;
const context: UseCaseContext = {
  prisma,
  clock: { now: () => clockNow },
  businessTz,
  storage: createDiskStorage(resolve(env.UPLOAD_DIR)),
};

/**
 * Instante `hora:minuto` (fuso de negócio) do dia `hoje + dayOffset`. Para hoje, nunca passa do
 * agora real, porque eventos no futuro são recusados (R9).
 */
function at(dayOffset: number, hour: number, minute = 0): Date {
  const dayStart = startOfBusinessDay(addDays(today, dayOffset), businessTz);
  const instant = new Date(dayStart.getTime() + (hour * 60 + minute) * 60_000);
  return instant.getTime() > realNow.getTime() ? realNow : instant;
}

const CLIENTS = [
  { legalName: 'Agro Cerrado Comércio de Grãos Ltda', cnpj: '11222333000181', paymentTermDays: 30 },
  {
    legalName: 'Cooperativa Agroindustrial Vale do Ivaí',
    cnpj: '45371892000175',
    paymentTermDays: 21,
  },
  { legalName: 'Moinho Bandeirantes S.A.', cnpj: '07654321000159', paymentTermDays: 15 },
  {
    legalName: 'Usina Santa Helena Açúcar e Etanol Ltda',
    cnpj: '33445566000186',
    paymentTermDays: 45,
  },
] as const;

const DRIVERS = [
  {
    name: 'João Batista Ferreira',
    document: '52998224725',
    vehiclePlate: 'BRA2E19',
    pixKey: 'joao.ferreira@email.com',
  },
  {
    name: 'Carlos Eduardo Lima',
    document: '12345678909',
    vehiclePlate: 'HKT4821',
    pixKey: '+5564999112233',
  },
  {
    name: 'Marcos Antônio Souza',
    document: '98765432100',
    vehiclePlate: 'QWE1F23',
    pixKey: '98765432100',
  },
  {
    name: 'Ricardo Gomes Transportes ME',
    document: '98765432000198',
    vehiclePlate: 'PLM7J45',
    pixKey: '98765432000198',
  },
  {
    name: 'Antônio Carlos Pereira',
    document: '36187450957',
    vehiclePlate: 'GHI3456',
    pixKey: 'antonio.pereira@email.com',
  },
  {
    name: 'Sebastião Rocha',
    document: '70219384622',
    vehiclePlate: 'RTY8K90',
    pixKey: 'sebastiao.rocha@email.com',
  },
] as const;

/** Um passo do roteiro de uma viagem, no instante em que acontece. */
type Step =
  | { at: Date; kind: 'cte'; number: number; clientFreightCents: number }
  | { at: Date; kind: 'photo' }
  | { at: Date; kind: 'unloading' }
  | { at: Date; kind: 'proofs' }
  | { at: Date; kind: 'settle'; title: 'ADVANCE' | 'BALANCE' }
  | { at: Date; kind: 'scheduleForToday'; title: 'BALANCE' }
  | { at: Date; kind: 'cancel'; reason: string };

interface TripScript {
  /** O que a viagem demonstra (CLAUDE.md, lista do seed). */
  label: string;
  client: number;
  driver: number;
  origin: string;
  destination: string;
  product: string;
  weightKg: number;
  quotedClientFreightCents: number;
  driverFreightCents: number;
  advancePercent: 50 | 70;
  createdAt: Date;
  steps: Step[];
  photoColor: readonly [number, number, number];
}

const TRIPS: TripScript[] = [
  {
    label: 'Criada, sem eventos',
    client: 0,
    driver: 0,
    origin: 'Rio Verde/GO',
    destination: 'Santos/SP',
    product: 'Soja em grãos',
    weightKg: 37000,
    quotedClientFreightCents: 1250000,
    driverFreightCents: 850000,
    advancePercent: 70,
    createdAt: at(0, 7, 30),
    steps: [],
    photoColor: [64, 192, 87],
  },
  {
    label: 'Só CT-e, sem foto',
    client: 1,
    driver: 1,
    origin: 'Maringá/PR',
    destination: 'Paranaguá/PR',
    product: 'Milho',
    weightKg: 35000,
    quotedClientFreightCents: 520000,
    driverFreightCents: 360000,
    advancePercent: 50,
    createdAt: at(-1, 9),
    steps: [{ at: at(-1, 15), kind: 'cte', number: 4101, clientFreightCents: 520000 }],
    photoColor: [250, 176, 5],
  },
  {
    label: 'Só foto, sem CT-e (ordem invertida)',
    client: 2,
    driver: 2,
    origin: 'Cascavel/PR',
    destination: 'São Paulo/SP',
    product: 'Trigo',
    weightKg: 32000,
    quotedClientFreightCents: 780000,
    driverFreightCents: 540000,
    advancePercent: 70,
    createdAt: at(-1, 10),
    steps: [{ at: at(-1, 16), kind: 'photo' }],
    photoColor: [230, 119, 0],
  },
  {
    label: 'Carregada, adiantamento vencendo hoje',
    client: 3,
    driver: 3,
    origin: 'Ribeirão Preto/SP',
    destination: 'Santos/SP',
    product: 'Açúcar VHP',
    weightKg: 40000,
    quotedClientFreightCents: 610000,
    driverFreightCents: 420000,
    advancePercent: 70,
    createdAt: at(-1, 14),
    steps: [
      { at: at(0, 6, 30), kind: 'cte', number: 4102, clientFreightCents: 610000 },
      { at: at(0, 7), kind: 'photo' },
    ],
    photoColor: [76, 110, 245],
  },
  {
    label: 'Carregada, adiantamento vencido',
    client: 0,
    driver: 4,
    origin: 'Jataí/GO',
    destination: 'Uberlândia/MG',
    product: 'Farelo de soja',
    weightKg: 36000,
    quotedClientFreightCents: 480000,
    driverFreightCents: 330000,
    advancePercent: 50,
    createdAt: at(-4, 16),
    steps: [
      { at: at(-3, 10), kind: 'cte', number: 4103, clientFreightCents: 480000 },
      { at: at(-3, 11), kind: 'photo' },
    ],
    photoColor: [250, 82, 82],
  },
  {
    label: 'Adiantamento pago, aguardando descarga',
    client: 1,
    driver: 5,
    origin: 'Londrina/PR',
    destination: 'Ponta Grossa/PR',
    product: 'Soja em grãos',
    weightKg: 34000,
    quotedClientFreightCents: 390000,
    driverFreightCents: 270000,
    advancePercent: 70,
    createdAt: at(-3, 15),
    steps: [
      { at: at(-2, 8), kind: 'cte', number: 4104, clientFreightCents: 390000 },
      { at: at(-2, 9), kind: 'photo' },
      { at: at(-2, 14), kind: 'settle', title: 'ADVANCE' },
    ],
    photoColor: [21, 170, 191],
  },
  {
    label: 'Descarregada sem comprovante (saldo travado)',
    client: 2,
    driver: 0,
    origin: 'Campo Mourão/PR',
    destination: 'Curitiba/PR',
    product: 'Trigo',
    weightKg: 30000,
    quotedClientFreightCents: 450000,
    driverFreightCents: 310000,
    advancePercent: 70,
    createdAt: at(-6, 11),
    steps: [
      { at: at(-5, 8), kind: 'cte', number: 4105, clientFreightCents: 450000 },
      { at: at(-5, 9), kind: 'photo' },
      { at: at(-5, 15), kind: 'settle', title: 'ADVANCE' },
      { at: at(-2, 10), kind: 'unloading' },
    ],
    photoColor: [121, 80, 242],
  },
  {
    label: 'Descarga e comprovantes antes do adiantamento pago (LOADED, saldo programável)',
    client: 3,
    driver: 1,
    origin: 'Sertãozinho/SP',
    destination: 'Santos/SP',
    product: 'Açúcar cristal',
    weightKg: 38000,
    quotedClientFreightCents: 560000,
    driverFreightCents: 390000,
    advancePercent: 50,
    createdAt: at(-6, 15),
    steps: [
      { at: at(-5, 10), kind: 'cte', number: 4106, clientFreightCents: 560000 },
      { at: at(-5, 11), kind: 'photo' },
      { at: at(-3, 14), kind: 'unloading' },
      { at: at(-1, 10), kind: 'proofs' },
    ],
    photoColor: [253, 126, 20],
  },
  {
    label: 'Comprovantes recebidos, saldo liberado e não programado',
    client: 0,
    driver: 2,
    origin: 'Sorriso/MT',
    destination: 'Rondonópolis/MT',
    product: 'Milho',
    weightKg: 37000,
    quotedClientFreightCents: 690000,
    driverFreightCents: 480000,
    advancePercent: 70,
    createdAt: at(-10, 9),
    steps: [
      { at: at(-9, 8), kind: 'cte', number: 4107, clientFreightCents: 690000 },
      { at: at(-9, 9), kind: 'photo' },
      { at: at(-9, 16), kind: 'settle', title: 'ADVANCE' },
      { at: at(-6, 10), kind: 'unloading' },
      { at: at(0, 7, 15), kind: 'proofs' },
    ],
    photoColor: [55, 178, 77],
  },
  {
    label: 'Saldo programado para hoje',
    client: 1,
    driver: 4,
    origin: 'Toledo/PR',
    destination: 'Paranaguá/PR',
    product: 'Soja em grãos',
    weightKg: 36000,
    quotedClientFreightCents: 470000,
    driverFreightCents: 330000,
    advancePercent: 70,
    createdAt: at(-14, 10),
    steps: [
      { at: at(-13, 8), kind: 'cte', number: 4108, clientFreightCents: 470000 },
      { at: at(-13, 9), kind: 'photo' },
      { at: at(-12, 10), kind: 'settle', title: 'ADVANCE' },
      { at: at(-9, 15), kind: 'unloading' },
      { at: at(-7, 10), kind: 'proofs' },
      { at: realNow, kind: 'scheduleForToday', title: 'BALANCE' },
    ],
    photoColor: [34, 139, 230],
  },
  {
    label: 'Finalizada, com o a receber em aberto',
    client: 3,
    driver: 5,
    origin: 'Araraquara/SP',
    destination: 'Santos/SP',
    product: 'Açúcar VHP',
    weightKg: 39000,
    quotedClientFreightCents: 590000,
    driverFreightCents: 400000,
    advancePercent: 70,
    createdAt: at(-25, 9),
    steps: [
      { at: at(-24, 8), kind: 'cte', number: 4109, clientFreightCents: 590000 },
      { at: at(-24, 9), kind: 'photo' },
      { at: at(-23, 10), kind: 'settle', title: 'ADVANCE' },
      { at: at(-20, 14), kind: 'unloading' },
      { at: at(-18, 10), kind: 'proofs' },
      { at: at(-17, 11), kind: 'settle', title: 'BALANCE' },
    ],
    photoColor: [190, 75, 219],
  },
  {
    label: 'Margem negativa (frete do motorista maior que o do cliente)',
    client: 2,
    driver: 3,
    origin: 'Chapecó/SC',
    destination: 'Porto Alegre/RS',
    product: 'Farelo de trigo',
    weightKg: 28000,
    quotedClientFreightCents: 380000,
    driverFreightCents: 420000,
    advancePercent: 50,
    createdAt: at(-3, 10),
    steps: [
      { at: at(-2, 10), kind: 'cte', number: 4110, clientFreightCents: 380000 },
      { at: at(-2, 11), kind: 'photo' },
      { at: at(-1, 9), kind: 'settle', title: 'ADVANCE' },
    ],
    photoColor: [224, 49, 49],
  },
  {
    label: 'Cancelada com o adiantamento pago (recuperação a receber do motorista)',
    client: 1,
    driver: 2,
    origin: 'Guarapuava/PR',
    destination: 'Ponta Grossa/PR',
    product: 'Cevada',
    weightKg: 31000,
    quotedClientFreightCents: 420000,
    driverFreightCents: 290000,
    advancePercent: 70,
    createdAt: at(-5, 9),
    steps: [
      { at: at(-4, 8), kind: 'cte', number: 4111, clientFreightCents: 420000 },
      { at: at(-4, 9), kind: 'photo' },
      { at: at(-4, 15), kind: 'settle', title: 'ADVANCE' },
      { at: at(-2, 16), kind: 'cancel', reason: 'Carga recusada pelo destinatário na portaria.' },
    ],
    photoColor: [134, 142, 150],
  },
];

async function findTitle(
  tripId: string,
  kind: TitleKind,
): Promise<{ id: string; amountCents: number }> {
  const detail = await getTripDetail(context, tripId);
  const title = detail.titles.find((candidate) => candidate.kind === kind);
  if (title === undefined) throw new Error(`Seed: viagem ${tripId} sem título ${kind}.`);
  return title;
}

async function runStep(tripId: string, step: Step, script: TripScript): Promise<void> {
  clockNow = step.at;
  switch (step.kind) {
    case 'cte':
      await registerCte(context, tripId, {
        number: step.number,
        series: 1,
        issuedAt: step.at,
        clientFreightCents: step.clientFreightCents,
      });
      return;
    case 'photo':
      await attachLoadingPhoto(context, tripId, {
        file: { buffer: createLoadingPhoto(script.photoColor), originalName: 'carregamento.png' },
        occurredAt: step.at,
      });
      return;
    case 'unloading':
      await registerUnloading(context, tripId, { occurredAt: step.at });
      return;
    case 'proofs':
      await registerProofs(context, tripId, {
        occurredAt: step.at,
        note: 'Canhoto original recebido pelo correio.',
      });
      return;
    case 'settle': {
      const title = await findTitle(tripId, step.title);
      await settleTitle(context, title.id, {
        paidOn: toBusinessDate(step.at, businessTz),
        amountCents: title.amountCents,
        note: 'PIX para o motorista',
      });
      return;
    }
    case 'scheduleForToday': {
      const result = await scheduleTitles(context, {
        titleIds: [(await findTitle(tripId, step.title)).id],
        date: today,
      });
      if (result.rejected.length > 0) {
        throw new Error(`Seed: programação recusada: ${result.rejected[0]?.message}`);
      }
      return;
    }
    case 'cancel':
      await cancelTrip(context, tripId, { reason: step.reason, occurredAt: step.at });
      return;
  }
}

async function main(): Promise<void> {
  const [clients, drivers, trips] = await Promise.all([
    prisma.client.count(),
    prisma.driver.count(),
    prisma.trip.count(),
  ]);
  if (clients + drivers + trips > 0) {
    console.info('Seed ignorado: o banco já tem dados.');
    return;
  }

  clockNow = at(-30, 8);
  const clientIds: string[] = [];
  for (const client of CLIENTS) clientIds.push((await createClient(context, client)).id);
  const driverIds: string[] = [];
  for (const driver of DRIVERS) driverIds.push((await createDriver(context, driver)).id);

  for (const script of TRIPS) {
    clockNow = script.createdAt;
    const { trip } = await createTrip(context, {
      clientId: clientIds[script.client]!,
      driverId: driverIds[script.driver]!,
      origin: script.origin,
      destination: script.destination,
      product: script.product,
      weightKg: script.weightKg,
      quotedClientFreightCents: script.quotedClientFreightCents,
      driverFreightCents: script.driverFreightCents,
      advancePercent: script.advancePercent,
    });
    for (const step of script.steps) await runStep(trip.id, step, script);

    const { status } = (await getTripDetail(context, trip.id)).trip;
    const code = `VG-${String(trip.code).padStart(4, '0')}`;
    console.info(`${code}  ${status.padEnd(15)}  ${script.label}`);
  }

  console.info(
    `Seed concluído: ${CLIENTS.length} clientes, ${DRIVERS.length} motoristas e ${TRIPS.length} viagens (hoje = ${today}).`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
