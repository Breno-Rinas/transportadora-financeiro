/**
 * Contrato da API HTTP (prefixo `/api`). Este arquivo é a fonte do formato das respostas e dos
 * bodies: o backend serializa exatamente estes tipos e o front só os exibe (sem regra de negócio).
 * Referência das regras: CLAUDE.md (seções "API HTTP", R4, R7, R11 e "Painel").
 *
 * Convenções do formato:
 * - Dinheiro: sempre inteiro em centavos, campos `...Cents: number`. Nunca float.
 * - Data sem hora (vencimento, programação, data do pagamento): string `YYYY-MM-DD` (`LocalDate`).
 * - Instante (eventos, emissão do CT-e, createdAt): string ISO 8601 (`IsoDateTime`).
 * - IDs são UUID; a viagem também tem `code` sequencial (exibido como `VG-0001`).
 * - CPF, CNPJ e placa chegam só com dígitos/letras maiúsculas; a máscara é só de exibição.
 * - Listas (`GET /clients`, `/drivers`, `/trips`, `/titles`) devolvem o array direto, sem paginação.
 * - Erro: `ApiErrorBody` (status 4xx/5xx), com `message` de negócio em pt-BR.
 *
 * Rotas e respostas:
 *
 * | Rota                              | Body / query                | Resposta (status)                     |
 * |-----------------------------------|-----------------------------|---------------------------------------|
 * | GET  /clients                     | `?q`                        | `Client[]`                            |
 * | POST /clients                     | `CreateClientInput`         | `Client` (201)                        |
 * | GET  /drivers                     | `?q`                        | `Driver[]`                            |
 * | POST /drivers                     | `CreateDriverInput`         | `Driver` (201)                        |
 * | GET  /trips                       | `TripFilters`               | `TripListItem[]`                      |
 * | POST /trips                       | `CreateTripInput`           | `TripDetail` (201)                    |
 * | GET  /trips/:id                   |                             | `TripDetail`                          |
 * | POST /trips/:id/cte               | `RegisterCteInput`          | `TripDetail` (201 novo, 200 reenvio)  |
 * | POST /trips/:id/loading-photo     | multipart `file`,`occurredAt?` | `TripDetail` (201 novo, 200 reenvio) |
 * | POST /trips/:id/unloading         | `RegisterUnloadingInput`    | `TripDetail` (201 novo, 200 reenvio)  |
 * | POST /trips/:id/proofs            | `RegisterProofsInput`       | `TripDetail` (201 novo, 200 reenvio)  |
 * | GET  /titles                      | `TitleFilters`              | `TitleListItem[]`                     |
 * | POST /titles/schedule             | `ScheduleTitlesInput`       | `ScheduleResult` (200)                |
 * | POST /titles/:id/settle           | `SettleTitleInput`          | `TitleWithLocks` (200)                |
 * | GET  /dashboard                   | `DashboardQuery`            | `Dashboard`                           |
 */

// ---------------------------------------------------------------------------
// Escalares e enums
// ---------------------------------------------------------------------------

/** Data sem hora, `YYYY-MM-DD`. */
export type LocalDate = string;

/** Instante em ISO 8601 (ex.: `2026-10-06T14:30:00.000Z`). */
export type IsoDateTime = string;

export type TripStatus =
  | 'CREATED'
  | 'LOADED'
  | 'ADVANCE_PAID'
  | 'UNLOADED'
  | 'PROOFS_RECEIVED'
  | 'BALANCE_PAID'
  /** Reservado: nenhuma regra leva a este estado ainda. */
  | 'CANCELLED';

export type TripEventType =
  'CTE_ISSUED' | 'LOADING_PHOTO_ATTACHED' | 'UNLOADED' | 'PROOFS_RECEIVED';

export type AttachmentKind = 'LOADING_PHOTO' | 'DELIVERY_RECEIPT';

export type TitleNature = 'PAYABLE' | 'RECEIVABLE';

/** `ADVANCE` e `BALANCE` são pagos ao motorista; `CLIENT_FREIGHT` é recebido do cliente. */
export type TitleKind = 'ADVANCE' | 'BALANCE' | 'CLIENT_FREIGHT';

/** `OPEN` e `SCHEDULED` são os títulos em aberto. */
export type TitleStatus = 'OPEN' | 'SCHEDULED' | 'PAID' | 'CANCELLED';

/** Percentual do adiantamento do frete do motorista. */
export type AdvancePercent = 50 | 70;

export type MarginKind = 'REALIZED' | 'PROJECTED';

/** Motivos de trava do saldo (R4). */
export type LockReasonCode = 'NOT_UNLOADED' | 'PROOFS_NOT_RECEIVED' | 'ADVANCE_NOT_PAID';

export type PendingStepCode =
  | 'CTE_PENDING'
  | 'LOADING_PHOTO_PENDING'
  | 'ADVANCE_PAYMENT_PENDING'
  | 'UNLOADING_PENDING'
  | 'PROOFS_PENDING'
  | 'BALANCE_READY_TO_SCHEDULE'
  | 'BALANCE_PAYMENT_PENDING';

/**
 * Faixa da data efetiva do título em relação a "hoje" (fuso de negócio). `TODAY` e
 * `WITHIN_WEEK` juntos formam a janela de 7 dias do painel (hoje até hoje + 6).
 */
export type DueBucket = 'OVERDUE' | 'TODAY' | 'WITHIN_WEEK' | 'LATER' | 'NO_DATE';

// ---------------------------------------------------------------------------
// Cadastros
// ---------------------------------------------------------------------------

export interface Client {
  id: string;
  legalName: string;
  /** 14 dígitos, sem máscara. */
  cnpj: string;
  paymentTermDays: number;
  createdAt: IsoDateTime;
}

export interface Driver {
  id: string;
  name: string;
  /** CPF (11) ou CNPJ (14), só dígitos. */
  document: string;
  /** `AAA9999` ou Mercosul `AAA9A99`, maiúscula e sem máscara. */
  vehiclePlate: string;
  pixKey: string;
  createdAt: IsoDateTime;
}

/** Cliente resumido, embutido em viagens e títulos. */
export interface ClientRef {
  id: string;
  legalName: string;
}

/** Motorista resumido, embutido em viagens e títulos. */
export interface DriverRef {
  id: string;
  name: string;
  vehiclePlate: string;
}

// ---------------------------------------------------------------------------
// Blocos calculados pelo backend (o front só exibe)
// ---------------------------------------------------------------------------

/** Margem da viagem (R7). `null` quando não há títulos nem frete cotado. */
export interface Margin {
  kind: MarginKind;
  amountCents: number;
  /** Margem sobre o frete do cliente, 2 casas; só para exibição. `null` sem frete do cliente. */
  percent: number | null;
  isNegative: boolean;
}

/** "O que falta" na viagem, na ordem do fluxo. Lista vazia: nada pendente. */
export interface PendingStep {
  code: PendingStepCode;
  message: string;
}

export interface LockReason {
  code: LockReasonCode;
  message: string;
}

/**
 * Travas do título (R4). Só o saldo tem travas. `ADVANCE_NOT_PAID` bloqueia apenas a baixa:
 * a programação continua permitida. O botão da UI fica habilitado e o backend decide.
 */
export interface TitleLocks {
  canSchedule: boolean;
  canSettle: boolean;
  reasons: LockReason[];
}

// ---------------------------------------------------------------------------
// Viagens
// ---------------------------------------------------------------------------

/** Item de `GET /trips`. */
export interface TripListItem {
  id: string;
  /** Sequencial; a UI exibe como `VG-0001`. */
  code: number;
  status: TripStatus;
  origin: string;
  destination: string;
  product: string;
  weightKg: number;
  client: ClientRef;
  driver: DriverRef;
  createdAt: IsoDateTime;
  /**
   * Frete a receber do cliente: o valor do CT-e ou, sem CT-e, o frete cotado; `null` se nenhum
   * dos dois existe.
   */
  clientFreightCents: number | null;
  /** Frete total a pagar ao motorista (do acordo de frete). */
  driverFreightCents: number;
  /** O primeiro item é o passo que a UI destaca. */
  pendingSteps: PendingStep[];
  margin: Margin | null;
}

/** Dados da viagem em `TripDetail.trip`. */
export interface Trip {
  id: string;
  code: number;
  status: TripStatus;
  origin: string;
  destination: string;
  product: string;
  weightKg: number;
  /** Frete cotado: só para projeção da margem e pré-preenchimento do CT-e. */
  quotedClientFreightCents: number | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** Acordo de frete com o motorista. */
export interface FreightAgreement {
  /** Frete total a pagar ao motorista. */
  driverFreightCents: number;
  advancePercent: AdvancePercent;
  createdAt: IsoDateTime;
}

export interface Cte {
  id: string;
  number: number;
  series: number;
  issuedAt: IsoDateTime;
  /** Frete a receber do cliente. */
  clientFreightCents: number;
  createdAt: IsoDateTime;
}

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  /** Caminho servido pela API, ex.: `/uploads/2026/10/abc.jpg` (usar direto em `<img src>`). */
  url: string;
  createdAt: IsoDateTime;
}

/** Fato operacional (R6). `at` é o `occurredAt`. */
export interface TimelineEventEntry {
  type: 'EVENT';
  id: string;
  /** Quando aconteceu (informado pelo usuário); é a chave de ordenação da linha do tempo. */
  at: IsoDateTime;
  eventType: TripEventType;
  /** Quando foi registrado no sistema. */
  recordedAt: IsoDateTime;
  note: string | null;
  cteId: string | null;
  attachmentId: string | null;
}

/** Transição de status (R8). `at` é o `changedAt`. */
export interface TimelineStatusChangeEntry {
  type: 'STATUS_CHANGE';
  id: string;
  at: IsoDateTime;
  fromStatus: TripStatus | null;
  toStatus: TripStatus;
  /** Origem da transição (ex.: `CTE_ISSUED`, `ADVANCE_PAID`); texto técnico. */
  trigger: string;
}

/** Baixa de título. `at` é o instante do registro; `paidOn` é a data do pagamento. */
export interface TimelinePaymentEntry {
  type: 'PAYMENT';
  id: string;
  at: IsoDateTime;
  titleId: string;
  titleKind: TitleKind;
  paidOn: LocalDate;
  amountCents: number;
  note: string | null;
}

/** Eventos + transições + pagamentos em ordem cronológica (mais antigo primeiro). */
export type TimelineEntry = TimelineEventEntry | TimelineStatusChangeEntry | TimelinePaymentEntry;

/** Resposta de `GET /trips/:id` e de todas as rotas que alteram a viagem. */
export interface TripDetail {
  trip: Trip;
  client: Client;
  driver: Driver;
  agreement: FreightAgreement;
  cte: Cte | null;
  attachments: Attachment[];
  timeline: TimelineEntry[];
  titles: TitleWithLocks[];
  margin: Margin | null;
  pendingSteps: PendingStep[];
}

// ---------------------------------------------------------------------------
// Títulos
// ---------------------------------------------------------------------------

/** Baixa registrada no título (integral, R10). */
export interface TitlePayment {
  paidOn: LocalDate;
  amountCents: number;
  note: string | null;
}

export interface Title {
  id: string;
  tripId: string;
  nature: TitleNature;
  kind: TitleKind;
  amountCents: number;
  /** Nulo no saldo até os comprovantes chegarem (R3). */
  dueDate: LocalDate | null;
  scheduledFor: LocalDate | null;
  /** `scheduledFor ?? dueDate` (R10): a data usada na agenda e no painel. */
  effectiveDate: LocalDate | null;
  status: TitleStatus;
  payment: TitlePayment | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface TitleWithLocks extends Title {
  locks: TitleLocks;
}

/** Viagem resumida embutida em `TitleListItem`. */
export interface TitleTripSummary {
  id: string;
  code: number;
  origin: string;
  destination: string;
  status: TripStatus;
  client: ClientRef;
  driver: DriverRef;
}

/** Item de `GET /titles`, ordenado por data efetiva ascendente (sem data por último). */
export interface TitleListItem extends TitleWithLocks {
  /** Faixa da data efetiva para a agenda; `null` quando o título não está em aberto. */
  bucket: DueBucket | null;
  trip: TitleTripSummary;
}

/** Resposta de `POST /titles/schedule` (R11): cada título é processado em transação própria. */
export interface ScheduleResult {
  scheduled: Title[];
  rejected: ScheduleRejection[];
}

export interface ScheduleRejection {
  titleId: string;
  /** Ex.: `BALANCE_LOCKED`, `ONLY_PAYABLE_CAN_BE_SCHEDULED`, `TITLE_ALREADY_PAID`. */
  code: string;
  /** Mensagem de negócio em pt-BR, pronta para exibir. */
  message: string;
}

// ---------------------------------------------------------------------------
// Painel
// ---------------------------------------------------------------------------

export interface TitleTotals {
  count: number;
  totalCents: number;
}

export interface DashboardPeriod {
  from: LocalDate;
  to: LocalDate;
}

/**
 * Resposta de `GET /dashboard`. "Hoje" é calculado no fuso de negócio; itens abertos são os
 * títulos `OPEN` ou `SCHEDULED`; o período padrão é o mês corrente.
 */
export interface Dashboard {
  /** "Hoje" no fuso de negócio, usado nos indicadores. */
  today: LocalDate;
  /** Período considerado em `margin`. */
  period: DashboardPeriod;
  /** PAYABLE abertos com data efetiva < hoje. */
  payableOverdue: TitleTotals;
  /** PAYABLE abertos com data efetiva = hoje. */
  payableDueToday: TitleTotals;
  /** PAYABLE abertos com hoje ≤ data efetiva ≤ hoje + 6 (inclui os de hoje). */
  payableDueWeek: TitleTotals;
  /** RECEIVABLE abertos; `overdueCount` são os vencidos. */
  receivableOpen: TitleTotals & { overdueCount: number };
  /** `BALANCE` abertos com algum motivo de trava. */
  lockedBalances: TitleTotals;
  /** Soma das margens realizadas das viagens com CT-e emitido no período. */
  margin: { amountCents: number; percent: number | null };
}

// ---------------------------------------------------------------------------
// Filtros (querystring dos GETs)
// ---------------------------------------------------------------------------

export interface TripFilters {
  status?: TripStatus;
  clientId?: string;
  driverId?: string;
  /** Período por `createdAt`. */
  from?: LocalDate;
  to?: LocalDate;
  /** Busca em código, origem, destino, produto, cliente, motorista e placa. */
  q?: string;
}

export interface TitleFilters {
  nature?: TitleNature;
  kind?: TitleKind;
  status?: TitleStatus;
  /** Intervalo da data efetiva (`scheduledFor ?? dueDate`). */
  dueFrom?: LocalDate;
  dueTo?: LocalDate;
  /** `true`: só títulos com algum motivo de trava. */
  locked?: boolean;
  tripId?: string;
}

export interface DashboardQuery {
  from?: LocalDate;
  to?: LocalDate;
}

// ---------------------------------------------------------------------------
// Inputs dos POSTs
// ---------------------------------------------------------------------------

export interface CreateClientInput {
  legalName: string;
  /** 14 dígitos, sem máscara. */
  cnpj: string;
  paymentTermDays: number;
}

export interface CreateDriverInput {
  name: string;
  /** CPF (11) ou CNPJ (14), só dígitos. */
  document: string;
  /** Sem máscara, maiúscula. */
  vehiclePlate: string;
  pixKey: string;
}

export interface CreateTripInput {
  clientId: string;
  driverId: string;
  origin: string;
  destination: string;
  product: string;
  weightKg: number;
  quotedClientFreightCents?: number;
  driverFreightCents: number;
  advancePercent: AdvancePercent;
}

export interface RegisterCteInput {
  number: number;
  series: number;
  issuedAt: IsoDateTime;
  clientFreightCents: number;
}

/** Enviado como multipart: `file` (jpeg/png/webp, ≤ 10 MB) e `occurredAt` opcional. */
export interface UploadLoadingPhotoInput {
  file: File;
  occurredAt?: IsoDateTime;
}

export interface RegisterUnloadingInput {
  occurredAt: IsoDateTime;
}

export interface RegisterProofsInput {
  occurredAt: IsoDateTime;
  note?: string;
}

export interface ScheduleTitlesInput {
  titleIds: string[];
  /** Data da programação; precisa ser ≥ hoje (R10). */
  date: LocalDate;
}

export interface SettleTitleInput {
  paidOn: LocalDate;
  /** Precisa ser igual ao valor do título (baixa integral, R10). */
  amountCents: number;
  note?: string;
}

// ---------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------

/** Item de `details` quando `code` é `VALIDATION_ERROR` (400): `path` com pontos (`a.b.0`). */
export interface ValidationErrorDetail {
  path: string;
  message: string;
}

/**
 * Formato único de erro da API. Códigos: 400 `VALIDATION_ERROR`; 404 `NOT_FOUND`;
 * 409 `EVENT_ALREADY_REGISTERED`, `TRIP_NOT_LOADED`, `UNLOADING_NOT_REGISTERED`,
 * `TITLE_ALREADY_PAID`, `DOCUMENT_ALREADY_EXISTS`, `CTE_NUMBER_IN_USE`; 422 `BALANCE_LOCKED`,
 * `ADVANCE_NOT_PAID`, `PARTIAL_PAYMENT_NOT_SUPPORTED`, `INVALID_EVENT_DATE`, `INVALID_DATE`,
 * `ONLY_PAYABLE_CAN_BE_SCHEDULED`, `INVALID_DOCUMENT`; 500 `INTERNAL_ERROR`.
 */
export interface ApiErrorBody {
  error: {
    code: string;
    /** Mensagem de negócio em pt-BR, pronta para exibir. */
    message: string;
    details?: unknown;
  };
}
