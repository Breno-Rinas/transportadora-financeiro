// E2E dos critérios de aceite (CLAUDE.md, seção "Testes"): app.inject contra o banco
// transportadora_test, com relógio fixo. Os passos rodam em sequência e compartilham estado.

import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/http/app.js';
import type {
  DashboardDto,
  ScheduleResultDto,
  TitleListItemDto,
  TitleWithLocksDto,
  TripDetailDto,
  TripListItemDto,
} from '../src/http/dto.js';
import { createPrismaClient, type PrismaClient } from '../src/infra/prisma.js';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5433/transportadora_test';

/** Todos os passos acontecem em 20/03/2026 (São Paulo, -03:00): "hoje" é 2026-03-20. */
const TODAY = '2026-03-20';
/** Relógio fixo, adiantado à mão entre os passos para a linha do tempo ter instantes distintos. */
let now = new Date('2026-03-20T10:00:00.000Z');

function setClock(instant: string): void {
  now = new Date(instant);
}

// Duas imagens PNG 1x1 diferentes (o sha256 distingue o reenvio da foto de outra foto).
const PHOTO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const OTHER_PHOTO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

let prisma: PrismaClient;
let app: FastifyInstance;
let uploadDir: string;

async function post(url: string, payload: object): Promise<LightMyRequestResponse> {
  return app.inject({ method: 'POST', url, payload });
}

async function get(url: string): Promise<LightMyRequestResponse> {
  return app.inject({ method: 'GET', url });
}

async function uploadPhoto(
  tripId: string,
  file: Buffer,
  occurredAt?: string,
): Promise<LightMyRequestResponse> {
  const form = new FormData();
  if (occurredAt !== undefined) form.append('occurredAt', occurredAt);
  form.append('file', new Blob([new Uint8Array(file)], { type: 'image/png' }), 'carregamento.png');
  return app.inject({ method: 'POST', url: `/api/trips/${tripId}/loading-photo`, body: form });
}

function errorCode(res: LightMyRequestResponse): string {
  return res.json<{ error: { code: string } }>().error.code;
}

function titleOf(detail: TripDetailDto, kind: string): TitleWithLocksDto {
  const title = detail.titles.find((candidate) => candidate.kind === kind);
  if (title === undefined) throw new Error(`Título ${kind} não encontrado`);
  return title;
}

beforeAll(async () => {
  // Garante as migrations no banco de teste (mesmo que `npm run db:deploy:test -w apps/api`).
  execFileSync('npm', ['run', 'db:deploy:test'], {
    cwd: resolve(import.meta.dirname, '..'),
    env: { ...process.env, TEST_DATABASE_URL },
    stdio: 'pipe',
  });

  prisma = createPrismaClient(TEST_DATABASE_URL);
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE payments, titles, trip_status_changes, trip_events, attachments, ctes,
       freight_agreements, trips, drivers, clients RESTART IDENTITY CASCADE`,
  );
  uploadDir = mkdtempSync(join(tmpdir(), 'transportadora-e2e-'));
  app = buildApp({
    prisma,
    clock: { now: () => now },
    uploadDir,
    businessTz: 'America/Sao_Paulo',
    logger: false,
  });
}, 60_000);

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
  rmSync(uploadDir, { recursive: true, force: true });
});

describe('critérios de aceite', () => {
  let clientId: string;
  let driverId: string;
  let tripId: string;
  let advanceId: string;
  let balanceId: string;
  let receivableId: string;

  it('cadastros: normaliza documentos, recusa inválidos e duplicados', async () => {
    const client = await post('/api/clients', {
      legalName: 'Agro Cerrado Ltda',
      cnpj: '11.222.333/0001-81',
      paymentTermDays: 30,
    });
    expect(client.statusCode).toBe(201);
    expect(client.json()).toMatchObject({ cnpj: '11222333000181', paymentTermDays: 30 });
    clientId = client.json<{ id: string }>().id;

    const driver = await post('/api/drivers', {
      name: 'João da Silva',
      document: '529.982.247-25',
      vehiclePlate: 'abc-1d23',
      pixKey: 'joao@exemplo.com',
    });
    expect(driver.statusCode).toBe(201);
    expect(driver.json()).toMatchObject({ document: '52998224725', vehiclePlate: 'ABC1D23' });
    driverId = driver.json<{ id: string }>().id;

    const invalid = await post('/api/clients', {
      legalName: 'X',
      cnpj: '11.222.333/0001-82',
      paymentTermDays: 0,
    });
    expect(invalid.statusCode).toBe(422);
    expect(errorCode(invalid)).toBe('INVALID_DOCUMENT');

    const missingFields = await post('/api/drivers', { name: '' });
    expect(missingFields.statusCode).toBe(400);
    expect(errorCode(missingFields)).toBe('VALIDATION_ERROR');

    const duplicate = await post('/api/clients', {
      legalName: 'Outro nome',
      cnpj: '11222333000181',
      paymentTermDays: 10,
    });
    expect(duplicate.statusCode).toBe(409);
    expect(errorCode(duplicate)).toBe('DOCUMENT_ALREADY_EXISTS');

    // Concorrência: a checagem prévia pode passar nas duas; o índice único segura a segunda.
    const racing = await Promise.all(
      [1, 2].map((n) =>
        post('/api/drivers', {
          name: `Motorista ${n}`,
          document: '12345678909',
          vehiclePlate: 'XYZ9876',
          pixKey: `pix-${n}`,
        }),
      ),
    );
    expect(racing.map((res) => res.statusCode).sort()).toEqual([201, 409]);
    expect(errorCode(racing.find((res) => res.statusCode === 409)!)).toBe(
      'DOCUMENT_ALREADY_EXISTS',
    );

    const search = await get('/api/clients?q=cerrado');
    expect(search.json<unknown[]>()).toHaveLength(1);
  });

  it('1. cria a viagem: frete do cliente R$ 5.000,00 e do motorista R$ 3.333,33 a 70%', async () => {
    const res = await post('/api/trips', {
      clientId,
      driverId,
      origin: 'Rio Verde/GO',
      destination: 'Santos/SP',
      product: 'Soja em grãos',
      weightKg: 37000,
      quotedClientFreightCents: 500000,
      driverFreightCents: 333333,
      advancePercent: 70,
    });
    expect(res.statusCode).toBe(201);
    const detail = res.json<TripDetailDto>();
    tripId = detail.trip.id;

    expect(detail.trip).toMatchObject({ code: 1, status: 'CREATED' });
    expect(detail.agreement).toMatchObject({ driverFreightCents: 333333, advancePercent: 70 });
    expect(detail.titles).toEqual([]);
    expect(detail.margin).toEqual({
      kind: 'PROJECTED',
      amountCents: 166667,
      percent: 33.33,
      isNegative: false,
    });
    expect(detail.pendingSteps.map((step) => step.code)).toEqual([
      'CTE_PENDING',
      'LOADING_PHOTO_PENDING',
    ]);
    expect(detail.timeline).toEqual([
      expect.objectContaining({
        type: 'STATUS_CHANGE',
        fromStatus: null,
        toStatus: 'CREATED',
        trigger: 'TRIP_CREATED',
        at: '2026-03-20T10:00:00.000Z',
      }),
    ]);

    // Sem CT-e, a lista mostra o frete cotado.
    const [item] = (await get('/api/trips')).json<TripListItemDto[]>();
    expect(item).toMatchObject({
      id: tripId,
      clientFreightCents: 500000,
      driverFreightCents: 333333,
    });
  });

  it('descarga antes do carregamento dá 409 TRIP_NOT_LOADED', async () => {
    const res = await post(`/api/trips/${tripId}/unloading`, {
      occurredAt: '2026-03-20T14:00:00Z',
    });
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('TRIP_NOT_LOADED');
  });

  it('2. CT-e sem foto não gera títulos', async () => {
    setClock('2026-03-20T10:30:00Z');
    // 22:30 de 19/03 em São Paulo (já é 20/03 em UTC): a data de negócio da emissão é 19/03.
    const res = await post(`/api/trips/${tripId}/cte`, {
      number: 1001,
      series: 1,
      issuedAt: '2026-03-20T01:30:00Z',
      clientFreightCents: 500000,
    });
    expect(res.statusCode).toBe(201);
    const detail = res.json<TripDetailDto>();
    expect(detail.titles).toEqual([]);
    expect(detail.trip.status).toBe('CREATED');
    expect(detail.cte).toMatchObject({ number: 1001, series: 1, clientFreightCents: 500000 });
    expect(detail.pendingSteps.map((step) => step.code)).toEqual(['LOADING_PHOTO_PENDING']);
  });

  it('3. a foto gera adiantamento de R$ 2.333,33 e saldo de R$ 1.000,00', async () => {
    setClock('2026-03-20T13:05:00Z');
    const res = await uploadPhoto(tripId, PHOTO, '2026-03-20T13:00:00Z');
    expect(res.statusCode).toBe(201);
    const detail = res.json<TripDetailDto>();

    expect(detail.trip.status).toBe('LOADED');
    const advance = titleOf(detail, 'ADVANCE');
    const balance = titleOf(detail, 'BALANCE');
    const receivable = titleOf(detail, 'CLIENT_FREIGHT');
    advanceId = advance.id;
    balanceId = balance.id;
    receivableId = receivable.id;

    expect(advance).toMatchObject({
      nature: 'PAYABLE',
      amountCents: 233333,
      dueDate: TODAY,
      effectiveDate: TODAY,
      status: 'OPEN',
      payment: null,
    });
    expect(balance).toMatchObject({ nature: 'PAYABLE', amountCents: 100000, dueDate: null });
    expect(balance.locks).toEqual({
      canSchedule: false,
      canSettle: false,
      reasons: [
        { code: 'NOT_UNLOADED', message: 'Aguardando registro da descarga' },
        { code: 'PROOFS_NOT_RECEIVED', message: 'Aguardando chegada do canhoto original do CT-e' },
        {
          code: 'ADVANCE_NOT_PAID',
          message: 'O saldo só pode ser pago após a baixa do adiantamento',
        },
      ],
    });
    expect(detail.margin).toMatchObject({ kind: 'REALIZED', amountCents: 166667 });

    const [attachment] = detail.attachments;
    expect(attachment).toMatchObject({ kind: 'LOADING_PHOTO', mimeType: 'image/png' });
    expect(attachment?.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
    const served = await get(attachment!.url);
    expect(served.statusCode).toBe(200);
    expect(served.rawPayload.equals(PHOTO)).toBe(true);
  });

  it('reenvio da mesma foto dá 200 sem gravar nada; foto diferente dá 409', async () => {
    setClock('2026-03-20T13:10:00Z');
    const before = await get(`/api/trips/${tripId}`);

    const replay = await uploadPhoto(tripId, PHOTO);
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual(before.json());
    expect(await prisma.attachment.count({ where: { tripId } })).toBe(1);

    const other = await uploadPhoto(tripId, OTHER_PHOTO);
    expect(other.statusCode).toBe(409);
    expect(errorCode(other)).toBe('EVENT_ALREADY_REGISTERED');
    expect(await prisma.attachment.count({ where: { tripId } })).toBe(1);

    const notAnImage = new FormData();
    notAnImage.append('file', new Blob(['texto qualquer'], { type: 'image/png' }), 'falso.png');
    const invalid = await app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/loading-photo`,
      body: notAnImage,
    });
    expect(invalid.statusCode).toBe(400);
    expect(errorCode(invalid)).toBe('VALIDATION_ERROR');
  });

  it('4. o a receber vence conforme o prazo do cliente', async () => {
    const detail = (await get(`/api/trips/${tripId}`)).json<TripDetailDto>();
    // Emissão em 19/03 (data de negócio) + 30 dias.
    expect(titleOf(detail, 'CLIENT_FREIGHT')).toMatchObject({
      nature: 'RECEIVABLE',
      amountCents: 500000,
      dueDate: '2026-04-18',
    });
  });

  it('5. programar o saldo antes da descarga é recusado (BALANCE_LOCKED, 422); o lote segue', async () => {
    const single = await post(`/api/titles/${balanceId}/schedule`, { date: '2026-03-25' });
    expect(single.statusCode).toBe(422);
    expect(single.json()).toEqual({
      error: {
        code: 'BALANCE_LOCKED',
        message: expect.stringContaining('Aguardando registro da descarga'),
        details: {
          reasons: expect.arrayContaining([expect.objectContaining({ code: 'NOT_UNLOADED' })]),
        },
      },
    });
    const untouched = (await get(`/api/trips/${tripId}`)).json<TripDetailDto>();
    expect(titleOf(untouched, 'BALANCE')).toMatchObject({ status: 'OPEN', scheduledFor: null });

    const res = await post('/api/titles/schedule', {
      titleIds: [advanceId, balanceId],
      date: '2026-03-25',
    });
    expect(res.statusCode).toBe(200);
    const result = res.json<ScheduleResultDto>();

    expect(result.scheduled).toHaveLength(1);
    expect(result.scheduled[0]).toMatchObject({
      id: advanceId,
      status: 'SCHEDULED',
      scheduledFor: '2026-03-25',
      effectiveDate: '2026-03-25',
    });
    expect(result.rejected).toEqual([
      { titleId: balanceId, code: 'BALANCE_LOCKED', message: expect.stringContaining('descarga') },
    ]);

    const settle = await post(`/api/titles/${balanceId}/settle`, {
      paidOn: TODAY,
      amountCents: 100000,
    });
    expect(settle.statusCode).toBe(422);
    expect(errorCode(settle)).toBe('BALANCE_LOCKED');

    const receivable = await post('/api/titles/schedule', {
      titleIds: [receivableId],
      date: '2026-03-25',
    });
    expect(receivable.json<ScheduleResultDto>().rejected[0]?.code).toBe(
      'ONLY_PAYABLE_CAN_BE_SCHEDULED',
    );

    const receivableSingle = await post(`/api/titles/${receivableId}/schedule`, {
      date: '2026-03-25',
    });
    expect(receivableSingle.statusCode).toBe(422);
    expect(errorCode(receivableSingle)).toBe('ONLY_PAYABLE_CAN_BE_SCHEDULED');
  });

  it('6. descarga sem comprovante mantém o saldo travado', async () => {
    setClock('2026-03-20T14:05:00Z');
    const beforeLoading = await post(`/api/trips/${tripId}/unloading`, {
      occurredAt: '2026-03-20T12:30:00Z',
    });
    expect(beforeLoading.statusCode).toBe(422);
    expect(errorCode(beforeLoading)).toBe('INVALID_EVENT_DATE');

    const future = await post(`/api/trips/${tripId}/unloading`, {
      occurredAt: '2026-03-20T16:00:00Z',
    });
    expect(future.statusCode).toBe(422);
    expect(errorCode(future)).toBe('INVALID_EVENT_DATE');

    const proofsFirst = await post(`/api/trips/${tripId}/proofs`, {
      occurredAt: '2026-03-20T14:30:00Z',
    });
    expect(proofsFirst.statusCode).toBe(409);
    expect(errorCode(proofsFirst)).toBe('UNLOADING_NOT_REGISTERED');

    const res = await post(`/api/trips/${tripId}/unloading`, {
      occurredAt: '2026-03-20T14:00:00Z',
    });
    expect(res.statusCode).toBe(201);
    const detail = res.json<TripDetailDto>();
    // O adiantamento ainda não foi pago: o status não pula etapas (R8).
    expect(detail.trip.status).toBe('LOADED');
    const balance = titleOf(detail, 'BALANCE');
    expect(balance.locks.canSchedule).toBe(false);
    expect(balance.locks.reasons.map((reason) => reason.code)).toEqual([
      'PROOFS_NOT_RECEIVED',
      'ADVANCE_NOT_PAID',
    ]);

    const replay = await post(`/api/trips/${tripId}/unloading`, {
      occurredAt: '2026-03-20T14:00:00.000Z',
    });
    expect(replay.statusCode).toBe(200);

    const locked = await get('/api/titles?locked=true&kind=BALANCE');
    expect(locked.json<TitleListItemDto[]>().map((title) => title.id)).toEqual([balanceId]);
  });

  it('7. o comprovante libera o saldo', async () => {
    setClock('2026-03-20T14:35:00Z');
    const res = await post(`/api/trips/${tripId}/proofs`, {
      occurredAt: '2026-03-20T14:30:00Z',
      note: 'Canhoto original recebido',
    });
    expect(res.statusCode).toBe(201);
    const detail = res.json<TripDetailDto>();
    expect(detail.trip.status).toBe('LOADED');

    const balance = titleOf(detail, 'BALANCE');
    expect(balance.dueDate).toBe(TODAY);
    expect(balance.locks).toEqual({
      canSchedule: true,
      canSettle: false,
      reasons: [
        {
          code: 'ADVANCE_NOT_PAID',
          message: 'O saldo só pode ser pago após a baixa do adiantamento',
        },
      ],
    });
    expect(detail.pendingSteps.map((step) => step.code)).toEqual([
      'ADVANCE_PAYMENT_PENDING',
      'BALANCE_READY_TO_SCHEDULE',
    ]);

    const schedule = await post('/api/titles/schedule', {
      titleIds: [balanceId],
      date: '2026-03-26',
    });
    expect(schedule.json<ScheduleResultDto>()).toMatchObject({
      scheduled: [{ id: balanceId, status: 'SCHEDULED', scheduledFor: '2026-03-26' }],
      rejected: [],
    });

    // Reprogramação individual: 200 com o título e as travas.
    const reschedule = await post(`/api/titles/${balanceId}/schedule`, { date: '2026-03-27' });
    expect(reschedule.statusCode).toBe(200);
    expect(reschedule.json<TitleWithLocksDto>()).toMatchObject({
      id: balanceId,
      status: 'SCHEDULED',
      scheduledFor: '2026-03-27',
      effectiveDate: '2026-03-27',
      locks: { canSchedule: true, canSettle: false },
    });
    const past = await post(`/api/titles/${balanceId}/schedule`, { date: '2026-03-19' });
    expect(past.statusCode).toBe(422);
    expect(errorCode(past)).toBe('INVALID_DATE');

    const settleBeforeAdvance = await post(`/api/titles/${balanceId}/settle`, {
      paidOn: TODAY,
      amountCents: 100000,
    });
    expect(settleBeforeAdvance.statusCode).toBe(422);
    expect(errorCode(settleBeforeAdvance)).toBe('ADVANCE_NOT_PAID');
  });

  it('agenda: ordenada pela data efetiva e filtrável por ela', async () => {
    const payables = (await get('/api/titles?nature=PAYABLE')).json<TitleListItemDto[]>();
    expect(payables.map((title) => [title.kind, title.effectiveDate, title.bucket])).toEqual([
      ['ADVANCE', '2026-03-25', 'WITHIN_WEEK'],
      ['BALANCE', '2026-03-27', 'LATER'],
    ]);
    expect(payables[0]?.trip).toMatchObject({
      code: 1,
      client: { legalName: 'Agro Cerrado Ltda' },
      driver: { vehiclePlate: 'ABC1D23' },
    });

    const window = await get('/api/titles?dueFrom=2026-03-26&dueTo=2026-03-31');
    expect(window.json<TitleListItemDto[]>().map((title) => title.id)).toEqual([balanceId]);
  });

  it('exportação CSV: mesmos filtros e ordem da agenda, no formato do Excel pt-BR', async () => {
    const res = await get('/api/titles/export.csv?nature=PAYABLE');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toBe('attachment; filename="titulos.csv"');
    expect(res.rawPayload.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(res.body.slice(1).split('\r\n')).toEqual([
      'Viagem;Natureza;Espécie;Cliente/Motorista;Valor;Vencimento;Programado para;Status;Motivo da trava',
      'VG-0001;A pagar;Adiantamento;João da Silva;2333,33;20/03/2026;25/03/2026;Programado;',
      'VG-0001;A pagar;Saldo;João da Silva;1000,00;20/03/2026;27/03/2026;Programado;' +
        'O saldo só pode ser pago após a baixa do adiantamento',
      '',
    ]);

    const receivables = await get('/api/titles/export.csv?nature=RECEIVABLE');
    expect(receivables.body).toContain(
      'VG-0001;A receber;Frete do cliente;Agro Cerrado Ltda;5000,00;18/04/2026;;Em aberto;',
    );

    const invalid = await get('/api/titles/export.csv?nature=TUDO');
    expect(invalid.statusCode).toBe(400);
  });

  it('8. baixa do adiantamento e depois do saldo leva a BALANCE_PAID', async () => {
    setClock('2026-03-20T15:00:00Z');
    const future = await post(`/api/titles/${advanceId}/settle`, {
      paidOn: '2026-03-21',
      amountCents: 233333,
    });
    expect(future.statusCode).toBe(422);
    expect(errorCode(future)).toBe('INVALID_DATE');

    const advance = await post(`/api/titles/${advanceId}/settle`, {
      paidOn: TODAY,
      amountCents: 233333,
      note: 'PIX',
    });
    expect(advance.statusCode).toBe(200);
    expect(advance.json<TitleWithLocksDto>()).toMatchObject({
      status: 'PAID',
      payment: { paidOn: TODAY, amountCents: 233333, note: 'PIX' },
    });

    let detail = (await get(`/api/trips/${tripId}`)).json<TripDetailDto>();
    // Com o adiantamento pago, o status percorre as etapas já satisfeitas, uma a uma.
    expect(detail.trip.status).toBe('PROOFS_RECEIVED');

    const partial = await post(`/api/titles/${balanceId}/settle`, {
      paidOn: TODAY,
      amountCents: 99999,
    });
    expect(partial.statusCode).toBe(422);
    expect(errorCode(partial)).toBe('PARTIAL_PAYMENT_NOT_SUPPORTED');

    setClock('2026-03-20T15:10:00Z');

    const balance = await post(`/api/titles/${balanceId}/settle`, {
      paidOn: TODAY,
      amountCents: 100000,
    });
    expect(balance.statusCode).toBe(200);
    expect(balance.json<TitleWithLocksDto>().locks).toEqual({
      canSchedule: true,
      canSettle: true,
      reasons: [],
    });

    detail = (await get(`/api/trips/${tripId}`)).json<TripDetailDto>();
    expect(detail.trip.status).toBe('BALANCE_PAID');
    expect(detail.pendingSteps).toEqual([]);
    expect(
      detail.timeline
        .filter((entry) => entry.type === 'STATUS_CHANGE')
        .map((entry) => [entry.toStatus, entry.trigger]),
    ).toEqual([
      ['CREATED', 'TRIP_CREATED'],
      ['LOADED', 'CTE_AND_LOADING_PHOTO_REGISTERED'],
      ['ADVANCE_PAID', 'ADVANCE_SETTLED'],
      ['UNLOADED', 'UNLOADING_REGISTERED'],
      ['PROOFS_RECEIVED', 'PROOFS_REGISTERED'],
      ['BALANCE_PAID', 'BALANCE_SETTLED'],
    ]);
    // Fatos pelo instante em que aconteceram; a baixa antes das transições que ela provocou.
    expect(
      detail.timeline.map((entry) =>
        entry.type === 'EVENT' ? entry.eventType : `${entry.type} ${entry.at.slice(11, 16)}`,
      ),
    ).toEqual([
      'CTE_ISSUED',
      'STATUS_CHANGE 10:00',
      'LOADING_PHOTO_ATTACHED',
      'STATUS_CHANGE 13:05',
      'UNLOADED',
      'PROOFS_RECEIVED',
      'PAYMENT 15:00',
      'STATUS_CHANGE 15:00',
      'STATUS_CHANGE 15:00',
      'STATUS_CHANGE 15:00',
      'PAYMENT 15:10',
      'STATUS_CHANGE 15:10',
    ]);

    const again = await post(`/api/titles/${balanceId}/settle`, {
      paidOn: TODAY,
      amountCents: 100000,
    });
    expect(again.statusCode).toBe(409);
    expect(errorCode(again)).toBe('TITLE_ALREADY_PAID');
  });

  it('9. reenviar o CT-e não duplica títulos', async () => {
    setClock('2026-03-20T15:30:00Z');
    const cte = {
      number: 1001,
      series: 1,
      issuedAt: '2026-03-19T22:30:00-03:00',
      clientFreightCents: 500000,
    };
    const replay = await post(`/api/trips/${tripId}/cte`, cte);
    expect(replay.statusCode).toBe(200);
    expect(replay.json<TripDetailDto>().titles).toHaveLength(3);
    expect(await prisma.title.count({ where: { tripId } })).toBe(3);
    expect(await prisma.cte.count({ where: { tripId } })).toBe(1);

    const changed = await post(`/api/trips/${tripId}/cte`, { ...cte, clientFreightCents: 510000 });
    expect(changed.statusCode).toBe(409);
    expect(errorCode(changed)).toBe('EVENT_ALREADY_REGISTERED');

    const createOther = async (): Promise<string> => {
      const res = await post('/api/trips', {
        clientId,
        driverId,
        origin: 'Sorriso/MT',
        destination: 'Paranaguá/PR',
        product: 'Milho',
        weightKg: 35000,
        driverFreightCents: 400000,
        advancePercent: 50,
      });
      return res.json<TripDetailDto>().trip.id;
    };
    const otherTripId = await createOther();
    const numberInUse = await post(`/api/trips/${otherTripId}/cte`, cte);
    expect(numberInUse.statusCode).toBe(409);
    expect(errorCode(numberInUse)).toBe('CTE_NUMBER_IN_USE');

    // Concorrência entre viagens diferentes (travas distintas): o índice único segura a segunda.
    const thirdTripId = await createOther();
    const racing = await Promise.all(
      [otherTripId, thirdTripId].map((id) =>
        post(`/api/trips/${id}/cte`, { ...cte, number: 2002 }),
      ),
    );
    expect(racing.map((res) => res.statusCode).sort()).toEqual([201, 409]);
    expect(errorCode(racing.find((res) => res.statusCode === 409)!)).toBe('CTE_NUMBER_IN_USE');
  });

  it('10. margem negativa aparece sinalizada', async () => {
    const created = await post('/api/trips', {
      clientId,
      driverId,
      origin: 'Uberlândia/MG',
      destination: 'Vitória/ES',
      product: 'Café',
      weightKg: 30000,
      quotedClientFreightCents: 450000,
      driverFreightCents: 600000,
      advancePercent: 50,
    });
    const negativeTripId = created.json<TripDetailDto>().trip.id;
    expect(created.json<TripDetailDto>().margin).toMatchObject({
      kind: 'PROJECTED',
      amountCents: -150000,
      isNegative: true,
    });

    await post(`/api/trips/${negativeTripId}/cte`, {
      number: 3003,
      series: 1,
      issuedAt: '2026-03-20T11:00:00Z',
      clientFreightCents: 450000,
    });
    const loaded = await uploadPhoto(negativeTripId, OTHER_PHOTO, '2026-03-20T11:30:00Z');
    expect(loaded.statusCode).toBe(201);
    expect(loaded.json<TripDetailDto>().margin).toEqual({
      kind: 'REALIZED',
      amountCents: -150000,
      percent: -33.33,
      isNegative: true,
    });

    const list = (await get('/api/trips')).json<TripListItemDto[]>();
    const item = list.find((trip) => trip.id === negativeTripId);
    expect(item).toMatchObject({
      status: 'LOADED',
      client: { id: clientId, legalName: 'Agro Cerrado Ltda' },
      driver: { id: driverId, name: 'João da Silva', vehiclePlate: 'ABC1D23' },
      margin: { kind: 'REALIZED', isNegative: true },
    });
    expect(item?.pendingSteps.map((step) => step.code)).toEqual([
      'ADVANCE_PAYMENT_PENDING',
      'UNLOADING_PENDING',
    ]);
  });

  it('lista de viagens: filtros e busca', async () => {
    const byCode = (await get('/api/trips?q=VG-0001')).json<TripListItemDto[]>();
    expect(byCode.map((trip) => trip.code)).toEqual([1]);

    const byPlate = (await get('/api/trips?q=abc-1d23')).json<TripListItemDto[]>();
    expect(byPlate).toHaveLength(4);

    const finished = (await get('/api/trips?status=BALANCE_PAID')).json<TripListItemDto[]>();
    expect(finished.map((trip) => trip.id)).toEqual([tripId]);

    expect((await get(`/api/trips?from=${TODAY}&to=${TODAY}`)).json<unknown[]>()).toHaveLength(4);
    expect((await get('/api/trips?from=2026-03-21')).json<unknown[]>()).toHaveLength(0);

    const invalid = await get('/api/trips?status=VOANDO');
    expect(invalid.statusCode).toBe(400);

    // Sem cotação: a viagem que ficou com o CT-e mostra o valor dele; a outra, null.
    const withoutQuote = (await get('/api/trips?q=Sorriso')).json<TripListItemDto[]>();
    expect(withoutQuote.map((trip) => trip.clientFreightCents)).toHaveLength(2);
    expect(withoutQuote.map((trip) => trip.clientFreightCents)).toEqual(
      expect.arrayContaining([500000, null]),
    );
    expect(withoutQuote.every((trip) => trip.driverFreightCents === 400000)).toBe(true);
  });

  it('painel: indicadores coerentes com os títulos', async () => {
    const dashboard = (await get('/api/dashboard')).json<DashboardDto>();
    expect(dashboard).toEqual({
      today: TODAY,
      period: { from: '2026-03-01', to: '2026-03-31' },
      payableOverdue: { count: 0, totalCents: 0 },
      // Adiantamento da viagem de margem negativa (50% de R$ 6.000,00), vencendo hoje.
      payableDueToday: { count: 1, totalCents: 300000 },
      payableDueWeek: { count: 1, totalCents: 300000 },
      receivableOpen: { count: 2, totalCents: 950000, overdueCount: 0 },
      lockedBalances: { count: 1, totalCents: 300000 },
      // 166.667 - 150.000 = 16.667 sobre 950.000 de frete.
      margin: { amountCents: 16667, percent: 1.75 },
    });
  });

  it('recurso inexistente dá 404 e id malformado dá 400', async () => {
    const missing = await get(`/api/trips/${randomUUID()}`);
    expect(missing.statusCode).toBe(404);
    expect(errorCode(missing)).toBe('NOT_FOUND');

    const missingTitle = await post(`/api/titles/${randomUUID()}/settle`, {
      paidOn: TODAY,
      amountCents: 1,
    });
    expect(missingTitle.statusCode).toBe(404);

    const missingSchedule = await post(`/api/titles/${randomUUID()}/schedule`, { date: TODAY });
    expect(missingSchedule.statusCode).toBe(404);

    const missingCancel = await post(`/api/trips/${randomUUID()}/cancel`, { reason: 'Teste' });
    expect(missingCancel.statusCode).toBe(404);

    const malformed = await post('/api/trips/123/cte', {});
    expect(malformed.statusCode).toBe(400);
  });
});

describe('cancelamento da viagem (R13)', () => {
  let clientId: string;
  let driverId: string;

  async function createLoadedTrip(cteNumber: number): Promise<TripDetailDto> {
    const created = await post('/api/trips', {
      clientId,
      driverId,
      origin: 'Cascavel/PR',
      destination: 'Paranaguá/PR',
      product: 'Trigo',
      weightKg: 32000,
      quotedClientFreightCents: 400000,
      driverFreightCents: 300000,
      advancePercent: 70,
    });
    const id = created.json<TripDetailDto>().trip.id;
    await post(`/api/trips/${id}/cte`, {
      number: cteNumber,
      series: 1,
      issuedAt: '2026-03-20T16:00:00Z',
      clientFreightCents: 400000,
    });
    const loaded = await uploadPhoto(id, PHOTO, '2026-03-20T16:10:00Z');
    expect(loaded.statusCode).toBe(201);
    return loaded.json<TripDetailDto>();
  }

  beforeAll(async () => {
    setClock('2026-03-20T16:30:00Z');
    const client = await post('/api/clients', {
      legalName: 'Cooperativa Vale do Ivaí',
      cnpj: '45.371.892/0001-75',
      paymentTermDays: 21,
    });
    clientId = client.json<{ id: string }>().id;
    const driver = await post('/api/drivers', {
      name: 'Marcos Souza',
      document: '987.654.321-00',
      vehiclePlate: 'QWE1F23',
      pixKey: 'marcos@exemplo.com',
    });
    driverId = driver.json<{ id: string }>().id;
  });

  it('com o adiantamento em aberto: cancela todos os títulos e não gera recuperação', async () => {
    const loaded = await createLoadedTrip(5005);
    const id = loaded.trip.id;
    // Um título programado também é cancelado.
    const scheduled = await post(`/api/titles/${titleOf(loaded, 'ADVANCE').id}/schedule`, {
      date: '2026-03-23',
    });
    expect(scheduled.statusCode).toBe(200);

    setClock('2026-03-20T17:00:00Z');
    const res = await post(`/api/trips/${id}/cancel`, { reason: ' Cliente desistiu da carga ' });
    expect(res.statusCode).toBe(201);
    const detail = res.json<TripDetailDto>();

    expect(detail.trip.status).toBe('CANCELLED');
    expect(detail.titles.map((title) => [title.kind, title.status])).toEqual([
      ['ADVANCE', 'CANCELLED'],
      ['BALANCE', 'CANCELLED'],
      ['CLIENT_FREIGHT', 'CANCELLED'],
    ]);
    expect(titleOf(detail, 'BALANCE').locks).toEqual({
      canSchedule: false,
      canSettle: false,
      reasons: [],
    });
    expect(detail.pendingSteps).toEqual([]);
    expect(detail.margin).toEqual({
      kind: 'REALIZED',
      amountCents: 0,
      percent: null,
      isNegative: false,
    });
    expect(detail.timeline.at(-2)).toMatchObject({
      type: 'EVENT',
      eventType: 'TRIP_CANCELLED',
      note: 'Cliente desistiu da carga',
      at: '2026-03-20T17:00:00.000Z',
    });
    expect(detail.timeline.at(-1)).toMatchObject({
      type: 'STATUS_CHANGE',
      fromStatus: 'LOADED',
      toStatus: 'CANCELLED',
      trigger: 'TRIP_CANCELLED',
    });

    // R6: mesmo motivo é reenvio (200, nada muda); outro motivo é conflito.
    setClock('2026-03-20T17:05:00Z');
    const replay = await post(`/api/trips/${id}/cancel`, { reason: 'Cliente desistiu da carga' });
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual((await get(`/api/trips/${id}`)).json());
    const other = await post(`/api/trips/${id}/cancel`, { reason: 'Outro motivo' });
    expect(other.statusCode).toBe(409);
    expect(errorCode(other)).toBe('EVENT_ALREADY_REGISTERED');

    const empty = await post(`/api/trips/${id}/cancel`, { reason: '  ' });
    expect(empty.statusCode).toBe(400);
  });

  it('com o adiantamento pago: gera a recuperação, zera a margem e recusa eventos posteriores', async () => {
    setClock('2026-03-20T18:00:00Z');
    const loaded = await createLoadedTrip(6006);
    const id = loaded.trip.id;
    const advance = titleOf(loaded, 'ADVANCE');
    await post(`/api/titles/${advance.id}/settle`, { paidOn: TODAY, amountCents: 210000 });
    await post(`/api/trips/${id}/unloading`, { occurredAt: '2026-03-20T17:30:00Z' });

    const beforeUnloading = await post(`/api/trips/${id}/cancel`, {
      reason: 'Carga avariada',
      occurredAt: '2026-03-20T17:00:00Z',
    });
    expect(beforeUnloading.statusCode).toBe(422);
    expect(errorCode(beforeUnloading)).toBe('INVALID_EVENT_DATE');

    // 23h30 de 20/03 em São Paulo: a recuperação vence nessa data de negócio.
    setClock('2026-03-21T02:40:00Z');
    const res = await post(`/api/trips/${id}/cancel`, {
      reason: 'Carga avariada',
      occurredAt: '2026-03-21T02:30:00Z',
    });
    expect(res.statusCode).toBe(201);
    const detail = res.json<TripDetailDto>();

    expect(detail.trip.status).toBe('CANCELLED');
    expect(detail.titles.map((title) => [title.kind, title.status])).toEqual([
      ['ADVANCE', 'PAID'],
      ['BALANCE', 'CANCELLED'],
      ['CLIENT_FREIGHT', 'CANCELLED'],
      ['ADVANCE_RECOVERY', 'OPEN'],
    ]);
    const recovery = titleOf(detail, 'ADVANCE_RECOVERY');
    expect(recovery).toMatchObject({
      nature: 'RECEIVABLE',
      amountCents: 210000,
      dueDate: '2026-03-20',
      locks: { canSchedule: true, canSettle: true, reasons: [] },
    });
    expect(detail.margin).toEqual({
      kind: 'REALIZED',
      amountCents: 0,
      percent: null,
      isNegative: false,
    });
    expect(detail.pendingSteps).toEqual([
      { code: 'ADVANCE_RECOVERY_PENDING', message: 'Recuperar adiantamento pago ao motorista' },
    ]);

    const listed = (await get('/api/trips?status=CANCELLED')).json<TripListItemDto[]>();
    expect(listed.find((trip) => trip.id === id)).toMatchObject({
      clientFreightCents: 400000,
      driverFreightCents: 300000,
      margin: { kind: 'REALIZED', amountCents: 0 },
      pendingSteps: [{ code: 'ADVANCE_RECOVERY_PENDING' }],
    });

    // Eventos posteriores: 409.
    const proofs = await post(`/api/trips/${id}/proofs`, { occurredAt: '2026-03-21T02:35:00Z' });
    expect(proofs.statusCode).toBe(409);
    expect(errorCode(proofs)).toBe('TRIP_CANCELLED');
    const settleBalance = await post(`/api/titles/${titleOf(detail, 'BALANCE').id}/settle`, {
      paidOn: TODAY,
      amountCents: 90000,
    });
    expect(settleBalance.statusCode).toBe(409);
    expect(errorCode(settleBalance)).toBe('TITLE_CANCELLED');
    const scheduleRecovery = await post(`/api/titles/${recovery.id}/schedule`, {
      date: '2026-03-23',
    });
    expect(scheduleRecovery.statusCode).toBe(422);
    expect(errorCode(scheduleRecovery)).toBe('ONLY_PAYABLE_CAN_BE_SCHEDULED');

    // A recuperação entra na agenda a receber e no CSV, com o nome do motorista.
    const receivables = (await get(`/api/titles?nature=RECEIVABLE&tripId=${id}`)).json<
      TitleListItemDto[]
    >();
    expect(receivables.map((title) => [title.kind, title.bucket])).toEqual([
      ['ADVANCE_RECOVERY', 'TODAY'],
      ['CLIENT_FREIGHT', null],
    ]);
    const csv = await get(`/api/titles/export.csv?kind=ADVANCE_RECOVERY`);
    expect(csv.body).toContain(
      ';A receber;Recuperação de adiantamento;Marcos Souza;2100,00;20/03/2026;;Em aberto;',
    );

    // Receber o adiantamento de volta zera a pendência; a viagem continua cancelada.
    const recovered = await post(`/api/titles/${recovery.id}/settle`, {
      paidOn: '2026-03-20',
      amountCents: 210000,
    });
    expect(recovered.statusCode).toBe(200);
    const after = (await get(`/api/trips/${id}`)).json<TripDetailDto>();
    expect(after.trip.status).toBe('CANCELLED');
    expect(after.pendingSteps).toEqual([]);
    expect(after.margin).toMatchObject({ amountCents: 0 });
  });

  it('viagem finalizada (saldo pago) não pode ser cancelada', async () => {
    const [finished] = (await get('/api/trips?status=BALANCE_PAID')).json<TripListItemDto[]>();
    const res = await post(`/api/trips/${finished!.id}/cancel`, { reason: 'Engano' });
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('TRIP_ALREADY_FINISHED');
  });
});
