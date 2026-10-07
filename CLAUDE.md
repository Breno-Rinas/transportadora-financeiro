# Módulo Financeiro de Transportadora — especificação do projeto

Fonte da verdade do projeto. **Agentes: leiam este arquivo inteiro antes de qualquer tarefa.** Não existe outro documento de requisitos. Se uma decisão daqui precisar mudar, atualize este arquivo na mesma tarefa.

## Contexto

Transportadora com frota terceirizada. Cada viagem tem dois valores: o frete a receber do cliente (tomador) e o frete a pagar ao motorista terceiro. O frete do motorista é pago em duas parcelas: o adiantamento (50% ou 70%) sai no carregamento e o saldo só depois da descarga **e** da chegada física do canhoto original do CT-e. O módulo responde: quanto pagar hoje, quanto receber, quais saldos estão travados e por quê, e qual a margem por viagem.

Fora do escopo: SEFAZ, banco/PIX/boleto/CNAB, login/perfis, multiempresa, conciliação, DRE, app mobile.

## Stack

- Monorepo com npm workspaces: `apps/api` e `apps/web`. Node 22 LTS (`engines: >=22.22.0`, o mínimo do React Router 8; o Prisma 7.10 exige 22.18). TypeScript `strict` nos dois.
- **API:** Fastify 5, Prisma 7 + PostgreSQL 16, Zod 4, Vitest 5, tsx (dev), `@fastify/multipart`, `@fastify/static`, `@fastify/cors`.
- **Web:** Vite 8 + React 19 + React Router 8 + TanStack Query v5 + Mantine 9 (core, dates, notifications, modals, form) + dayjs (`pt-br`) + Tabler icons.
- Docker Compose: `db` (postgres:16-alpine, porta **5433** no host), `api` (3333), `web` (5173).
- ESLint 10 (flat config na raiz, typescript-eslint + react-hooks no web) + Prettier com configuração mínima. TypeScript fica em 6.0.x porque o typescript-eslint ainda não suporta o 7.

### Notas da fundação (fase 1)

- **Dependências:** todas já estão instaladas e travadas no `package-lock.json`. Não rode `npm install` nem adicione pacotes sem combinar. O `postinstall` da API roda `prisma generate`. O `overrides` do `package.json` raiz força versões corrigidas de `shell-quote`, `mysql2` e `deepmerge-ts` (dependências transitivas do Prisma CLI e do concurrently com advisories; zera o `npm audit`, mas faz o `npm ls` acusar "invalid"). Prisma: fixe em `^7`, pois o dist-tag `latest` do CLI aponta para um RC do 8.
- **Prisma 7:** `apps/api/prisma.config.ts` (datasource e seed), client gerado em `apps/api/src/generated/prisma` (ignorado pelo git; regenerar com `npm run db:generate -w apps/api` depois de mexer no schema), driver adapter `pg`. Import: `../generated/prisma/client.js`. `src/infra/prisma.ts` exporta `prisma`, `createPrismaClient(url)` (testes E2E usam `TEST_DATABASE_URL`) e o tipo `PrismaTx`. Alterou o schema? `npm run db:migrate -w apps/api -- --name <nome>` e commite a migration.
- **API em ESM (NodeNext):** imports relativos levam extensão `.js` (`import { x } from './x.js'`), mesmo sendo arquivos `.ts`. O build (`npm run build -w apps/api`) compila para `dist/`.
- **Esqueleto HTTP:** `buildApp(options?)` em `http/app.ts` (aceita `prisma`, `clock`, `uploadDir`, `businessTz`, `logger`; sem logs quando `NODE_ENV=test`) já registra CORS, multipart (10 MB) e `/uploads/*`. Rotas novas entram em `http/routes/` e são registradas em `http/routes/index.ts` (prefixo `/api`; recebe as `AppDeps`). Em `app.inject` o multipart funciona com `FormData` nativo.
- **Erros:** `http/error-handler.ts` tem `statusByCode`, um `Record<DomainErrorCode, number>`: cada código novo em `domain/errors.ts` precisa entrar ali (o typecheck cobra). Código sem mapeamento vira 500 `INTERNAL_ERROR` e é logado. `ZodError` vira 400 `VALIDATION_ERROR` com `details: { path, message }[]`; mensagens do Zod em pt-BR (`z.locales.ptBR()`).
- **Env:** `src/infra/env.ts` (Zod) lê `DATABASE_URL`, `PORT`, `HOST`, `BUSINESS_TZ`, `UPLOAD_DIR`, `CORS_ORIGIN`; todos têm default de desenvolvimento, então não precisa de `.env`. Ver `.env.example`.
- **Mantine 9** (difere do 7/8): `Grid` usa `gap` (não `gutter`), `Text`/`Anchor` usam `c` (não `color`), `Collapse` usa `expanded` (não `in`), raio padrão `md`. Imports de CSS já estão em `src/main.tsx`.
- **Web:** `src/api/client.ts` expõe `api.get/post/postForm` (prefixo `/api` automático) e `ApiError` (`status`, `code`, `message`, `details`); falha de rede vira `NETWORK_ERROR` e corpo fora do formato vira `UNEXPECTED_RESPONSE`. O `QueryClient` está em `src/api/query-client.ts` (`refetchOnWindowFocus` ligado, sem retry em 4xx). As páginas de `src/pages/` são placeholders a substituir.
- **Tipos de CT-e:** `Cte.number` e `Cte.series` são `Int` (a unicidade `(series, number)` fica correta, sem zeros à esquerda).
- **`TripStatus.CANCELLED`** é o estado terminal do cancelamento (R13); a migration `trip_cancellation` acrescentou `TRIP_CANCELLED` em `TripEventType` e `ADVANCE_RECOVERY` em `TitleKind`.
- **Prisma e agentes:** o Prisma bloqueia `migrate reset` quando invocado por um agente de IA sem consentimento do usuário. `npm run db:reset` deve ser rodado pelo usuário; não contorne a trava.

## Comandos

| Comando | O que faz |
|---|---|
| `docker compose up --build` | Sobe tudo: banco, migrations, seed (se vazio), API (3333) e web em nginx (5173, com proxy de `/api` e `/uploads`) |
| `npm run dev` | Sobe o banco no Docker, aplica migrations + seed (se vazio) e roda API + web em modo dev (o Vite faz proxy de `/api` e `/uploads` para `:3333`) |
| `npm test` | Testes de todos os workspaces |
| `npm run typecheck` / `npm run lint` | Checagem de tipos / lint |
| `npm run db:reset` | Recria o banco, aplica migrations e roda o seed |
| `npm run db:deploy:test -w apps/api` | Aplica as migrations no banco `transportadora_test` (E2E) |
| `npm run build` | Build de produção da API (`dist/`) e do web |

## Arquitetura da API

```
apps/api/src/
  domain/       puro: sem Fastify, Prisma ou I/O. TODA regra de negócio vive aqui.
  application/  casos de uso: abrem transação, travam a viagem, carregam dados, chamam o domínio, persistem.
  infra/        prisma client, storage de arquivos em disco, clock.
  http/         Fastify: rotas, schemas Zod, serializers, error handler.
  main.ts
```

- `domain/` não importa nada de fora de `domain/`. Funções puras que recebem dados simples e devolvem decisões ou lançam `DomainError(code, message, details?)`.
- `application/` não decide regra: só orquestra I/O e chama o domínio. Prisma é usado direto aqui, sem camada de repositório (trade-off consciente, documentado no README).
- Rotas são finas: validam com Zod, chamam um caso de uso e serializam.
- Toda mutação de viagem ou título roda em `prisma.$transaction` e começa com `SELECT id FROM trips WHERE id = $1 FOR UPDATE` (helper `lockTrip(tx, tripId)`). Isso evita corrida entre CT-e e foto chegando ao mesmo tempo.
- Relógio injetável (`Clock`) para testes. Fuso de negócio `America/Sao_Paulo` (env `BUSINESS_TZ`); "hoje" é sempre calculado nesse fuso.

### Notas da API (fases 3 e 4)

- **application/:** um caso de uso por arquivo (`create-client`, `list-clients`, `create-driver`, `list-drivers`, `create-trip`, `list-trips`, `get-trip-detail`, `register-cte`, `attach-loading-photo`, `register-unloading`, `register-proofs`, `cancel-trip`, `schedule-title`, `schedule-titles`, `settle-title`, `list-titles`, `get-dashboard`), todos recebendo um `UseCaseContext` (`prisma`, `clock`, `businessTz`, `storage`). Apoio: `trip-state` (carrega a viagem e monta `TripFacts` e o fingerprint do R6), `trip-event` (esqueleto dos eventos: transação → `lockTrip` → estado → domínio decide → grava), `trip-progress` (gera os títulos e grava cada passo de `advanceLifecycle`), `title-view` (data efetiva, travas e `bucket`) e `conflicts` (P2002 → código de domínio pelo nome do índice: `clients_cnpj_key`/`drivers_document_key` → `DOCUMENT_ALREADY_EXISTS`, `ctes_series_number_key` → `CTE_NUMBER_IN_USE`, `trip_events_tripId_type_key`/`ctes_tripId_key`/`titles_tripId_kind_key` → `EVENT_ALREADY_REGISTERED`).
- **Uma consulta por vez dentro da transação:** a transação usa uma só conexão do pg, e um `include` com várias relações faz o Prisma buscá-las em paralelo nela (o pg 8 avisa "client.query() when the client is already executing a query"; o pg 9 vai recusar). Por isso `loadTripState` carrega a viagem e cada relação em consultas sequenciais. Dentro de `$transaction`: nada de `Promise.all` nem `include` com mais de uma relação; fora dela, tudo bem.
- **Instantes gravados vêm do `Clock`** (`createdAt`, `recordedAt`, `changedAt`, `updatedAt`), não do `now()` do banco: testes e seed controlam o tempo.
- **infra/:** `storage.ts` (tipo detectado pela assinatura do arquivo, não pelo mimetype declarado; nome `<uuid>.<ext>`; sha256), `trip-lock.ts` (`lockTrip`), `db-date.ts` (`LocalDate` ↔ `@db.Date` sempre por UTC) e `unique-violation.ts`. A foto só é gravada em disco quando o evento é novo e é apagada se a transação falhar.
- **Upload inválido** (vazio ou fora de JPEG/PNG/WEBP) → 400 `VALIDATION_ERROR` com `details: [{ path: 'file' }]`; acima de 10 MB o multipart responde 413 `PAYLOAD_TOO_LARGE`.
- **Linha do tempo:** ordenada por `at` (evento: `occurredAt`; baixa: `createdAt`; transição: `changedAt`). Em empate: evento → baixa → transição, e transições do mesmo instante na ordem do ciclo.
- **`POST /titles/schedule` responde sempre 200** (R11); a recusa vem em `rejected` com o código do domínio (ex.: `BALANCE_LOCKED`). **`POST /titles/:id/schedule`** é a programação individual: o mesmo passo transacional (`applySchedule`, em `schedule-title.ts`) que o lote roda para cada título, mas a recusa sai como erro HTTP (422 `BALANCE_LOCKED`, 422 `ONLY_PAYABLE_CAN_BE_SCHEDULED`, 409 `TITLE_ALREADY_PAID` etc.). Sucesso: 200 com o título com `locks` (mesmo formato da baixa).
- **`GET /titles/export.csv`:** mesmos filtros, validação e ordem de `GET /titles` (reaproveita `listTitles`); o CSV é montado em `http/titles-csv.ts`. Formato para o Excel pt-BR: BOM UTF-8, separador `;`, CRLF, valor `1234,56` (sem milhar, sem float), datas dd/mm/aaaa. Colunas: Viagem (`VG-0001`), Natureza, Espécie, Cliente/Motorista (cliente no frete do cliente; motorista no adiantamento, saldo e recuperação), Valor, Vencimento, Programado para, Status (a receber pago = "Recebido") e Motivo da trava (motivos separados por `; `). Células com `;`, aspas ou quebra de linha vão entre aspas; nome que começa com `= + - @` ganha `'` na frente (injeção de fórmula). `Content-Disposition: attachment; filename="titulos.csv"`.
- **`POST /trips/:id/cancel`** (`cancel-trip`) usa o esqueleto `registerTripEvent`: 201 no cancelamento novo, 200 no reenvio com o mesmo motivo (R6), detalhe da viagem na resposta. O motivo fica em `TripEvent.note`.
- **`GET /trips`:** cada item traz `clientFreightCents` (valor do CT-e ou, sem CT-e, o frete cotado; null se nenhum) e `driverFreightCents` (do acordo).
- **Filtros:** `from`/`to` de `/trips` usam a data de negócio do `createdAt` (`startOfBusinessDay`); `dueFrom`/`dueTo` de `/titles` usam a data efetiva; `locked=true` = algum motivo de trava (mesmo critério do painel). `bucket` é null em título pago ou cancelado. `POST /trips` com cliente ou motorista inexistente → 404.
- **E2E:** `test/acceptance.test.ts` aplica as migrations no `transportadora_test` (via `db:deploy:test`) e faz `TRUNCATE` no `beforeAll`; precisa do banco do Docker no ar.
- **Seed:** usa os casos de uso com o relógio posicionado em cada passo do roteiro; a foto é um PNG gerado em `prisma/seed-photo.ts`. No container roda compilado (`node dist/prisma/seed.js`). Para testá-lo sem mexer no banco de dev: `TRUNCATE` no `transportadora_test` e `DATABASE_URL=<url do teste> UPLOAD_DIR=<pasta temporária> npx tsx prisma/seed.ts`.

## Convenções

- Código em inglês. Textos de UI e mensagens de erro em pt-BR. Commits no padrão Conventional Commits com descrição em pt-BR.
- **Dinheiro:** sempre inteiro em centavos (`amountCents: number`, coluna `Int`). Nunca float. No front, a conversão entre texto e centavos é feita manipulando a string, sem `parseFloat`.
- **Datas sem hora** (vencimento, programação, data do pagamento): coluna `@db.Date`, string `YYYY-MM-DD` na API e no domínio (tipo `LocalDate`). Não use `Date` do JS para elas; isso evita o bug de fuso em que 12/03 vira 11/03.
- **Instantes** (eventos, emissão do CT-e): `timestamptz`, ISO 8601 na API.
- IDs são UUID. A viagem também tem `code` sequencial, exibido como `VG-0001`.
- CPF, CNPJ e placa ficam salvos só com dígitos/letras maiúsculas; a máscara é aplicada apenas na exibição.

## Glossário

| Domínio | Código |
|---|---|
| Cliente (tomador) | `Client` |
| Motorista terceiro | `Driver` |
| Viagem | `Trip` |
| Acordo de frete | `FreightAgreement` |
| CT-e | `Cte` |
| Comprovante (arquivo) | `Attachment` (`LOADING_PHOTO`, `DELIVERY_RECEIPT`) |
| Evento operacional | `TripEvent` |
| Título | `Title` — natureza `PAYABLE`/`RECEIVABLE`, espécie `ADVANCE`/`BALANCE`/`CLIENT_FREIGHT`/`ADVANCE_RECOVERY` |
| Recuperação de adiantamento | `ADVANCE_RECOVERY` (a receber do motorista, R13) |
| Cancelar viagem | `cancel` |
| Pagamento / baixa | `Payment` / `settle` |
| Programar pagamento | `schedule` |

## Modelo de dados (Prisma, tabelas em snake_case via `@@map`)

- **Client:** id, legalName, cnpj (14 dígitos, único), paymentTermDays (int ≥ 0), createdAt.
- **Driver:** id, name, document (CPF 11 ou CNPJ 14 dígitos, único), vehiclePlate (`AAA9999` ou Mercosul `AAA9A99`), pixKey, createdAt.
- **Trip:** id, code (autoincrement, único), clientId, driverId, origin, destination, product, weightKg (Int), quotedClientFreightCents (Int?, frete cotado, só para projeção e pré-preenchimento do CT-e), status (`TripStatus`), createdAt, updatedAt.
- **FreightAgreement:** id, tripId (único), driverFreightCents (Int > 0), advancePercent (Int: 50 ou 70), createdAt. Fica separado de Trip para permitir renegociação/histórico no futuro.
- **Cte:** id, tripId (único), number, series, issuedAt (timestamptz), clientFreightCents (Int > 0), createdAt. `@@unique([series, number])`.
- **Attachment:** id, tripId, kind, storagePath, originalName, mimeType, sizeBytes, sha256, createdAt.
- **TripEvent** (fato operacional): id, tripId, type (`TripEventType`), occurredAt (quando aconteceu, informado pelo usuário), recordedAt (default now), cteId?, attachmentId?, note?. **`@@unique([tripId, type])`**.
- **TripStatusChange** (histórico/auditoria das transições): id, tripId, fromStatus?, toStatus, trigger (string), changedAt.
- **Title:** id, tripId, nature, kind, amountCents, dueDate (`@db.Date`, nulo no saldo até os comprovantes chegarem), scheduledFor (`@db.Date`?), status (`OPEN`/`SCHEDULED`/`PAID`/`CANCELLED`), createdAt, updatedAt. **`@@unique([tripId, kind])`**.
- **Payment:** id, titleId, paidOn (`@db.Date`), amountCents, note?, createdAt. É uma entidade separada para suportar baixa parcial no futuro; hoje só baixa integral.

Enums:
- `TripStatus`: `CREATED`, `LOADED`, `ADVANCE_PAID`, `UNLOADED`, `PROOFS_RECEIVED`, `BALANCE_PAID` e `CANCELLED` (terminal, fora da sequência; R13).
- `TripEventType`: `CTE_ISSUED`, `LOADING_PHOTO_ATTACHED`, `UNLOADED`, `PROOFS_RECEIVED`, `TRIP_CANCELLED` (motivo em `note`).
- `TitleKind`: `ADVANCE`, `BALANCE`, `CLIENT_FREIGHT`, `ADVANCE_RECOVERY` (`RECEIVABLE`, só nasce no cancelamento com adiantamento pago).

## Regras de negócio (todas em `domain/`, cada uma com teste unitário)

**R1 — Gatilho.** Os títulos nascem quando a viagem tem os fatos `CTE_ISSUED` e `LOADING_PHOTO_ATTACHED`, em qualquer ordem. Com apenas um deles, nada é gerado. Geração dos 3 títulos, registro do evento e transição `CREATED → LOADED` acontecem na mesma transação.

**R2 — Divisão do frete do motorista.** `advance = floor((total * percent + 50) / 100)` (arredondamento half-up em aritmética inteira); `balance = total - advance`. O saldo absorve a diferença. Testes obrigatórios: 333333 a 70% → 233333 + 100000; 333333 a 50% → 166667 + 166666; 1 centavo; e o invariante `advance + balance === total` para vários valores.

**R3 — Títulos e vencimentos.**
- `CLIENT_FREIGHT` (RECEIVABLE): valor = `cte.clientFreightCents`; vencimento = data de negócio de `cte.issuedAt` + `client.paymentTermDays`.
- `ADVANCE` (PAYABLE): vencimento = data de negócio do carregamento (o mais tarde entre os `occurredAt` do CT-e e da foto).
- `BALANCE` (PAYABLE): nasce com `dueDate = null`. Quando `PROOFS_RECEIVED` é registrado, recebe `dueDate` = data de negócio desse evento.

**R4 — Trava do saldo.** A função `getTitleLocks(title, ctx)` devolve `{ canSchedule, canSettle, reasons: { code, message }[] }`. É a **única** fonte das travas: os guards do backend e a resposta da API usam essa mesma função. Motivos possíveis no saldo:
- `NOT_UNLOADED`: "Aguardando registro da descarga".
- `PROOFS_NOT_RECEIVED`: "Aguardando chegada do canhoto original do CT-e".
- `ADVANCE_NOT_PAID`: "O saldo só pode ser pago após a baixa do adiantamento". Este motivo bloqueia apenas a baixa; a programação continua permitida.

Programar ou pagar o saldo travado → 422 `BALANCE_LOCKED`, com a mensagem listando os motivos.

**R5 — Ordem de pagamento.** O saldo nunca é pago antes de o adiantamento estar `PAID` (422 `ADVANCE_NOT_PAID`).

**R6 — Idempotência.** `TripEvent` é único por (tripId, type), garantido por constraint no banco.
- Reenvio do mesmo evento **com os mesmos dados** → 200 com o estado atual, sem reprocessar nada.
- Mesmo tipo **com dados diferentes** → 409 `EVENT_ALREADY_REGISTERED`.
- Comparação: CT-e por (number, series, issuedAt, clientFreightCents); foto pelo sha256 do arquivo; descarga e comprovantes por occurredAt; cancelamento pelo motivo (sem espaços nas pontas), porque a data é opcional e, omitida, vale o momento do envio.
- `@@unique([tripId, kind])` em Title é a segunda barreira contra duplicação.

**R7 — Margem.** Calculada sempre no backend.
- Com títulos: realizada = `CLIENT_FREIGHT − (ADVANCE + BALANCE − ADVANCE_RECOVERY)`, ignorando títulos cancelados (a recuperação devolve o custo do motorista).
- Sem títulos, mas com frete cotado: projetada = `quotedClientFreightCents − driverFreightCents`.
- Caso contrário: `null`.
- O percentual é `margem / frete do cliente × 100`, arredondado em 2 casas; é number só para exibição, não é dinheiro.
- Formato na API: `margin: { kind: 'REALIZED' | 'PROJECTED', amountCents, percent, isNegative } | null`.

**R8 — Ciclo de vida (persistido, nunca calculado na leitura).** A cada fato ou pagamento, na mesma transação, `advanceLifecycle(status, facts)` avança pela sequência canônica enquanto a condição da próxima seta estiver satisfeita. Cada passo é gravado em `TripStatusChange`.

| De → Para | Condição |
|---|---|
| `CREATED → LOADED` | `CTE_ISSUED` e `LOADING_PHOTO_ATTACHED` registrados |
| `LOADED → ADVANCE_PAID` | `ADVANCE` pago |
| `ADVANCE_PAID → UNLOADED` | `UNLOADED` registrado |
| `UNLOADED → PROOFS_RECEIVED` | `PROOFS_RECEIVED` registrado |
| `PROOFS_RECEIVED → BALANCE_PAID` | `BALANCE` pago (viagem finalizada) |

Por quê: o roteiro de aceite registra descarga e comprovantes **antes** da baixa do adiantamento. Os fatos são aceitos quando acontecem; o estado nunca pula etapas da sequência.

**R9 — Pré-condições dos eventos.**
- CT-e e foto: aceitos em qualquer ordem enquanto a viagem não estiver cancelada.
- `UNLOADED`: exige viagem carregada; senão 409 `TRIP_NOT_LOADED` ("Registre o CT-e e a foto do carregamento antes da descarga").
- `PROOFS_RECEIVED`: exige descarga registrada; senão 409 `UNLOADING_NOT_REGISTERED`.
- `occurredAt` no futuro, ou anterior ao fato que o precede (descarga antes do carregamento, comprovante antes da descarga) → 422 `INVALID_EVENT_DATE`.

**R10 — Operações em títulos.**
- **Programar:** só `PAYABLE` (422 `ONLY_PAYABLE_CAN_BE_SCHEDULED`); status `OPEN` ou `SCHEDULED` (reprogramar é permitido); data ≥ hoje; precisa passar nas travas. Resultado: `SCHEDULED` com `scheduledFor` preenchido.
- **Baixa:** status `OPEN` ou `SCHEDULED`; `amountCents` igual ao valor do título (senão 422 `PARTIAL_PAYMENT_NOT_SUPPORTED`); `paidOn` ≤ hoje; precisa passar nas travas. Cria `Payment`, muda para `PAID` e roda R8.
- Título já `PAID` → 409 `TITLE_ALREADY_PAID`.
- **Data efetiva** na agenda e no painel = `scheduledFor ?? dueDate`.

**R11 — Programação em lote.** Cada título é processado em transação própria. A resposta é `{ scheduled: Title[], rejected: { titleId, code, message }[] }`, para o analista ver o que passou e por que o resto falhou.

**R12 — Documentos.** CPF e CNPJ validados pelos dígitos verificadores; placa no formato antigo ou Mercosul (`domain/shared`). Inválido → 422 `INVALID_DOCUMENT`.

**Próximos passos ("o que falta").** `getPendingSteps(ctx)` no domínio devolve `{ code, message }[]`. Exemplos: "Aguardando emissão do CT-e", "Aguardando foto do carregamento", "Aguardando baixa do adiantamento", "Aguardando descarga", "Aguardando canhoto original", "Saldo liberado — programar pagamento", "Aguardando pagamento do saldo". A API devolve a lista pronta; o front só exibe.

**R13 — Cancelamento da viagem (bônus).** `POST /trips/:id/cancel { reason, occurredAt? }`, numa única transação:
- Permitido em qualquer status, exceto `BALANCE_PAID` (409 `TRIP_ALREADY_FINISHED`) e `CANCELLED`.
- Grava o fato `TRIP_CANCELLED` com o motivo. O reenvio segue a R6.
- Títulos `OPEN` e `SCHEDULED` viram `CANCELLED`. Títulos `PAID` ficam como estão, porque são histórico.
- **Adiantamento já pago:** gera um título `RECEIVABLE` de espécie `ADVANCE_RECOVERY` ("Recuperação de adiantamento", a receber do motorista) com o mesmo valor e vencimento na data do cancelamento. A pendência vira "Recuperar adiantamento pago ao motorista".
- `occurredAt` não pode estar no futuro nem ser anterior ao último fato registrado (422 `INVALID_EVENT_DATE`); sem `occurredAt`, vale o momento do envio.
- Status → `CANCELLED`, um estado terminal fora da sequência, gravado em `TripStatusChange` com o gatilho `TRIP_CANCELLED`. Eventos posteriores → 409 `TRIP_CANCELLED`; operações nos títulos cancelados → 409 `TITLE_CANCELLED`. A recuperação pode ser baixada (`settle`), mas não programada (é a receber).
- Na margem, os títulos cancelados são ignorados. Com adiantamento pago e recuperado, a margem fica zerada.
- O cliente que já pagou (estorno ao cliente) fica fora do escopo e é documentado no README.

### Domínio implementado (API pública — use estas funções, não reimplemente)

- `shared/money.ts`: `splitDriverFreight`, `assertPositiveCents`, `isAdvancePercent`.
- `shared/local-date.ts`: `LocalDate`, `DateRange`, `toBusinessDate`, `addDays`, `compareLocalDate`, `isWithinRange`, `getMonthRange`, `assertValidLocalDate`, `startOfBusinessDay` (primeiro instante da data no fuso; filtros de período sobre instantes).
- `shared/documents.ts`: `parseCnpj`, `parseDriverDocument` e `parsePlate` removem a máscara, validam e devolvem o valor a salvar (lançam `INVALID_DOCUMENT`).
- `trip/facts.ts`: `TripFacts` (inclui `cancelledAt` e `advanceRecoveryStatus`), `buildTripFacts(events, titles)`, `isLoaded`, `getLoadedAt`.
- `trip/lifecycle.ts`: `advanceLifecycle`, `INITIAL_STATUS_CHANGE`. Gatilhos gravados em `TripStatusChange.trigger`: `TRIP_CREATED`, `CTE_AND_LOADING_PHOTO_REGISTERED`, `ADVANCE_SETTLED`, `UNLOADING_REGISTERED`, `PROOFS_REGISTERED`, `BALANCE_SETTLED`, `TRIP_CANCELLED`.
- `trip/cancellation.ts` (R13): `assertTripCanBeCancelled`, `selectTitlesToCancel`, `buildAdvanceRecovery`, `getCancellationStatusChange` e `planTripCancellation` (junta tudo, com a validação da data via `assertEventCanBeRegistered`).
- `trip/freight.ts`: `getClientFreightCents` (CT-e ?? cotado ?? null).
- `trip/event-rules.ts`: `decideEventRegistration` (`'NEW' | 'REPLAY'` ou 409) e `assertEventCanBeRegistered`.
- `trip/title-generation.ts`: `shouldGenerateTitles`, `buildLoadingTitles`, `getBalanceDueDate`.
- `trip/margin.ts`: `calculateTripMargin` (recebe `cancelled`), `sumTitleFreights`, `percentOf`.
- `trip/pending-steps.ts`: `getPendingSteps`.
- `title/locks.ts`: `getTitleLocks(title: { kind, status }, facts)`.
- `title/labels.ts`: `TITLE_NATURE_LABELS`, `TITLE_KIND_LABELS`, `getTitleStatusLabel`, `getTitleCounterparty` (rótulos pt-BR das saídas geradas pela API, como o CSV).
- `title/operations.ts`: `assertCanSchedule`, `assertCanSettle`.
- `title/agenda.ts`: `isOpenTitle`, `getEffectiveDate`, `classifyDueDate` (`OVERDUE | TODAY | WITHIN_WEEK | LATER | NO_DATE`).
- `dashboard/indicators.ts`: `buildDashboard`, `resolveDashboardPeriod`.

### Decisões do domínio

- **Códigos de erro:** existem também `TRIP_CANCELLED`, `TITLE_CANCELLED` e `TRIP_ALREADY_FINISHED` (409). Invariantes de entrada repetidas no domínio (valor ≤ 0, percentual diferente de 50/70, prazo negativo) usam `VALIDATION_ERROR` (400). A union `DomainErrorCode` fica em `errors.ts`, e o error handler mapeia com `Record<DomainErrorCode, number>`.
- **CNPJ alfanumérico:** aceito conforme a IN RFB 2.229/2024, além do só numérico. O `maskCnpj` do front precisa aceitar letras.
- **Ordem das checagens na baixa:** natureza → status → travas → valor → data. Se a única trava do saldo for o adiantamento não pago, o erro é `ADVANCE_NOT_PAID`; se houver também trava de descarga ou canhoto, o erro é `BALANCE_LOCKED`, listando todos os motivos.
- **Percentual da margem:** é `null` quando o frete do cliente é zero. No painel, o percentual é ponderado (margem total ÷ frete total), e o período considera a data de negócio da emissão do CT-e.
- **Pendências:** "Saldo liberado" depende do `canSchedule` das travas e pode aparecer junto com "Aguardando baixa do adiantamento". Na viagem cancelada, as pendências do fluxo somem: só fica `ADVANCE_RECOVERY_PENDING` enquanto a recuperação estiver em aberto (lista vazia depois de baixada ou sem recuperação).
- **Travas do título cancelado:** `getTitleLocks` devolve `{ canSchedule: false, canSettle: false, reasons: [] }`. Cancelado é terminal (nada permitido), e as travas do saldo deixam de fazer sentido (a viagem não vai mais descarregar), então não há motivo a exibir nem o título conta em `locked=true`. Título pago continua como antes. A recuperação não tem travas.
- **Margem da viagem cancelada:** sempre `REALIZED`, nunca projetada (o frete cotado não vai acontecer). Sem nada pago, ou com o adiantamento pago e recuperado, dá `amountCents: 0` e `percent: null` (frete do cliente zero). O cliente que já pagou continua contando (estorno fora do escopo). No painel, a recuperação em aberto entra em `receivableOpen` (é `RECEIVABLE`).
- **Viagem cancelada não gera títulos** (`shouldGenerateTitles`), embora nenhum evento novo seja aceito depois do cancelamento.

## Painel — `GET /api/dashboard?from&to`

Tudo em uma chamada. "Hoje" no fuso de negócio; o período padrão é o mês corrente. Itens abertos são os títulos `OPEN` ou `SCHEDULED`.

| Indicador | Definição | Formato |
|---|---|---|
| `payableOverdue` | PAYABLE abertos com data efetiva < hoje | `{ count, totalCents }` |
| `payableDueToday` | PAYABLE abertos com data efetiva = hoje | `{ count, totalCents }` |
| `payableDueWeek` | PAYABLE abertos com hoje ≤ data efetiva ≤ hoje + 6 | `{ count, totalCents }` |
| `receivableOpen` | RECEIVABLE abertos | `{ count, totalCents, overdueCount }` |
| `lockedBalances` | `BALANCE` abertos com algum motivo de trava | `{ count, totalCents }` |
| `margin` | soma das margens realizadas das viagens com CT-e emitido no período | `{ amountCents, percent }` |

## API HTTP (prefixo `/api`)

| Método | Rota | Descrição |
|---|---|---|
| GET/POST | `/clients` | Listar (`?q`) / criar |
| GET/POST | `/drivers` | Listar (`?q`) / criar |
| GET | `/trips` | Filtros: `?status&clientId&driverId&from&to&q`. O período usa `createdAt`; `q` busca em código, origem, destino, produto, cliente, motorista e placa. Cada item traz `clientFreightCents` (CT-e ?? cotado ?? null), `driverFreightCents`, `pendingSteps` e `margin`. |
| POST | `/trips` | Body: `{ clientId, driverId, origin, destination, product, weightKg, quotedClientFreightCents?, driverFreightCents, advancePercent }` |
| GET | `/trips/:id` | Detalhe: trip, client, driver, agreement, cte, attachments, `timeline` (eventos + transições + pagamentos em ordem cronológica), titles (cada um com `locks`), margin, pendingSteps |
| POST | `/trips/:id/cte` | Body: `{ number, series, issuedAt, clientFreightCents }` |
| POST | `/trips/:id/loading-photo` | Multipart: `file` (jpeg/png/webp, ≤ 10 MB) e `occurredAt` opcional |
| POST | `/trips/:id/unloading` | Body: `{ occurredAt }` |
| POST | `/trips/:id/proofs` | Body: `{ occurredAt, note? }` |
| POST | `/trips/:id/cancel` | Body: `{ reason, occurredAt? }` (R13). 201 novo / 200 reenvio com o mesmo motivo; 409 `TRIP_ALREADY_FINISHED`, `EVENT_ALREADY_REGISTERED` |
| GET | `/titles` | Filtros: `?nature&kind&status&dueFrom&dueTo&locked&tripId`. Ordenado por data efetiva ascendente (nulos por último); cada item traz a viagem resumida e os `locks` |
| GET | `/titles/export.csv` | Mesmos filtros e ordem de `/titles`, em CSV para o Excel pt-BR (ver Notas da API) |
| POST | `/titles/schedule` | Body: `{ titleIds, date }` (ver R11) |
| POST | `/titles/:id/schedule` | Body: `{ date }`. 200 com o título e `locks`, ou o erro de domínio (422 `BALANCE_LOCKED` etc.) |
| POST | `/titles/:id/settle` | Body: `{ paidOn, amountCents, note? }` |
| GET | `/dashboard` | Indicadores do painel |
| GET | `/uploads/*` | Arquivos enviados |

Rotas de evento devolvem o detalhe atualizado da viagem (mesmo formato do `GET /trips/:id`): **201** quando o evento é novo e **200** quando é um reenvio idempotente.

**Formato único de erro:** `{ "error": { "code": "BALANCE_LOCKED", "message": "Mensagem de negócio em pt-BR", "details"?: ... } }`

| Status | Quando |
|---|---|
| 400 `VALIDATION_ERROR` | Entrada inválida no Zod; `details` traz os campos com problema |
| 404 `NOT_FOUND` | Recurso inexistente |
| 409 | Conflito de estado ou duplicidade: `EVENT_ALREADY_REGISTERED`, `TRIP_NOT_LOADED`, `UNLOADING_NOT_REGISTERED`, `TITLE_ALREADY_PAID`, `DOCUMENT_ALREADY_EXISTS`, `CTE_NUMBER_IN_USE`, `TRIP_CANCELLED`, `TITLE_CANCELLED`, `TRIP_ALREADY_FINISHED` |
| 422 | Violação de regra: `BALANCE_LOCKED`, `ADVANCE_NOT_PAID`, `PARTIAL_PAYMENT_NOT_SUPPORTED`, `INVALID_EVENT_DATE`, `INVALID_DATE`, `ONLY_PAYABLE_CAN_BE_SCHEDULED`, `INVALID_DOCUMENT` |
| 500 | Só bug, sem vazar stack |

O mapeamento de `code` para status HTTP fica em `http/error-handler.ts`.

## Frontend (`apps/web`)

**Rotas:** `/` (Painel), `/viagens`, `/viagens/:id`, `/financeiro` (contas a pagar e a receber, filtros na querystring), `/clientes` e `/motoristas` (tabela + modal de criação; itens próprios no menu lateral, como no sistema real).

**Estrutura:**
- `src/api/`: cliente fetch tipado e tipos dos DTOs, espelhando a API sem regra. `ApiError` carrega o `code` e a `message` do backend.
- `src/lib/format.ts`, com testes:
  - `formatBRL(cents)` via `Intl` pt-BR.
  - `parseBRL("3.333,33") → 333333`, manipulando a string.
  - `formatDate("2026-03-12") → "12/03/2026"`, sem `Date`.
  - `formatDateTime(iso)`.
  - `maskCpfCnpj`, `maskCnpj`, `maskPlate`.
- `src/lib/labels.ts`: rótulos e cores dos enums. É apresentação, não regra.

**Dados (TanStack Query):**
- Chaves: `['dashboard']`, `['trips', filtros]`, `['trip', id]`, `['titles', filtros]`, `['clients']`, `['drivers']`.
- Toda mutação invalida dashboard, trips, trip e titles, para que o painel atualize sem recarregar a página.
- `refetchOnWindowFocus` ligado; o painel também tem `refetchInterval` de 30 s.

**Comportamento obrigatório:**
- Toda tela trata três estados: carregando (skeleton), erro (mensagem + "tentar de novo") e lista vazia com orientação do que fazer (ex.: "Nenhuma viagem ainda. Clique em Nova viagem para começar.").
- Toda ação dá retorno imediato por notificação. Em caso de erro, mostra o `message` do backend, nunca JSON cru.
- **Nenhuma regra de negócio no front:** margem, pendências, travas e totais vêm prontos da API.
- Títulos travados mostram o motivo de forma explícita, como badge na linha. O botão continua habilitado e o backend decide; a recusa aparece com o motivo vindo da API.
- Hierarquia visual que deixa óbvio o que exige ação hoje: vencidos e vencendo hoje em destaque; margem negativa em vermelho, com ícone na lista de viagens.
- Layout pensado para 1366 px: AppShell com navegação lateral compacta.

**Telas:**
- **Detalhe da viagem:**
  - Cabeçalho com código, status, cliente, motorista (documento e placa mascarados) e rota.
  - Destaque com os próximos passos.
  - Valores lado a lado: frete do cliente, frete do motorista (adiantamento/saldo) e margem em R$ e %.
  - Linha do tempo e foto do carregamento.
  - Ações: CT-e (com o frete cotado pré-preenchido), foto, descarga e comprovantes.
  - Títulos com programar e baixar na própria linha.
- **Financeiro:**
  - Abas A pagar / A receber, com filtros.
  - Agenda ordenada por data efetiva e agrupada em Vencidos / Hoje / Próximos 7 dias / Depois / Sem data.
  - Seleção múltipla com "Programar selecionados" (modal de data); mostra o que foi programado e o que foi recusado, com o motivo.
  - "Dar baixa" (modal com data = hoje e valor = valor do título).

## Design (referência: sistema real da empresa, "FretouBR")

O módulo tem que parecer uma tela nativa do sistema FretouBR. A referência é o quadro "Cargas" do sistema real. Imagem (não commitar): `/tmp/claude-1000/-home-brenorinas-transportadora-financeiro/f548df42-fd08-4a61-927a-ff164bc824a6/images/1.jpg`.

**Base**
- Fonte Inter (`@fontsource-variable/inter`). UI densa: textos de 11 a 13 px; títulos de card com 13 px e peso 500–600; título da página com 20 px e peso 700.
- Ícones `@tabler/icons-react` em traço fino, 16–18 px no menu e 12–14 px nos cards.
- Mantine com `primaryColor: 'indigo'`, raio de 8 px em cards e colunas e de 6 px em botões e inputs.

**Layout**
- **Sidebar** fixa de 215 px, fundo azul-marinho escuro `#1b2232`.
  - Marca no topo: quadrado indigo `#4c6ef5` com "F" branco + "FretouBR" em branco e negrito.
  - Seções com rótulo em maiúsculas, 10–11 px, cinza `#8b93a7` e espaçamento entre letras: **FINANCEIRO** (Painel, Contas a pagar e receber), **OPERACIONAL** (Viagens) e **CADASTROS** (Clientes, Motoristas).
  - Item: ícone + rótulo, 14 px, cor `#d0d5e0`. Item ativo com fundo `#2b3447`, texto branco em negrito e cantos arredondados.
- **Topbar** clara sem borda forte.
  - À esquerda, ícone de recolher a sidebar.
  - À direita, sino com badge vermelho e avatar redondo "A". O badge mostra a quantidade de títulos vencidos + vencendo hoje, vinda do dashboard.
- **Página:** fundo `#f6f7f9`. Cabeçalho com o título à esquerda e, à direita, input de busca com ícone de lupa (placeholder do tipo "Cliente, origem ou destino…") e select de filtro com ícone de funil ("Todos os clientes").

**Quadro (padrão das telas de lista)**
- Colunas lado a lado, com rolagem horizontal, largura ~240 px, fundo `#f1f2f5`, raio de 8 px.
- Cabeçalho da coluna: rótulo e contagem num pill cinza.
- **Coluna em destaque** ("Hoje"): fundo `#e4e9fb`, sobretítulo "HOJE" em maiúsculas pequenas, rótulo em indigo e contagem num círculo indigo cheio. Os vencidos usam a mesma estrutura em vermelho claro.
- **Coluna vazia:** caixa tracejada com ícone de cubo e texto cinza ("Sem títulos", "Sem viagens").

**Card**
- Fundo branco, borda `#e3e6ec`, **borda esquerda de 3 px** colorida (indigo claro `#a5b4fc` por padrão), sombra mínima e padding de ~12 px.
- Topo: nome (cliente/motorista) com 13 px e peso 500, à esquerda; badge de status em pill à direita, no estilo do "Prospectando" (variante light com borda, por exemplo violeta `#f3f0ff` / `#7048e8`). Abaixo do nome, o código cinza pequeno (`VG-0001`).
- Rota: ● verde `#40c057` + origem em negrito; ● vermelho `#fa5252` + destino em cinza.
- Linha de meta: ícone de relógio + data em cinza à esquerda e valor em negrito à direita. O valor sai **sempre** em `formatBRL` (R$ 6.500,00). A referência mostra "R$ 6500.00" errado; nós não repetimos esse erro.
- **Caixa de nota:** fundo `#f1f5fd`, borda `#dbe4ff`, ícone de documento e texto 11 px `#5c6f9a`, truncado. Aqui entram o próximo passo ("Aguardando foto do carregamento") e o motivo da trava (nas travas, variante âmbar/vermelha).
- Linha de botões pequenos (xs, light com borda):
  - "Histórico": cinza, ícone de relógio com seta.
  - Ação amarela (fundo `#fff9db`, texto `#e67700`): no lugar do "Editar".
  - "Detalhes": azul-indigo claro, ícone de olho.
- Botão largo outline com ícone (no estilo do "Atribuir Veículo"): a ação principal do card, como "Registrar CT-e", "Programar pagamento" ou "Dar baixa".
- Rodapé com links sutis (estilo de "Copiar oferta" cinza e "Cancelar" vermelho), usados só quando fizer sentido.

**Como aplicar nas telas**
- **Contas a pagar e receber** (`/financeiro`): quadro por data efetiva com as colunas Vencidos (destaque vermelho) → Hoje (destaque indigo) → Amanhã → um dia por coluna até +6 dias ("quarta, 07/10", com dayjs pt-br a partir da string `YYYY-MM-DD`) → Depois → Sem data.
  - A coluna do título vem de `bucket`, e dentro de WITHIN_WEEK o agrupamento é por `effectiveDate`. Agrupar por campo é apresentação; não é regra.
  - Abas A pagar / A receber no cabeçalho. Card com checkbox de seleção; com algo selecionado, aparece uma barra fixa "Programar selecionados (n)".
- **Viagens** (`/viagens`): quadro com uma coluna por status (Criada → Carregada → Adiantamento pago → Descarregada → Comprovantes recebidos → Finalizada). O card mostra o frete do cliente, o primeiro passo pendente na caixa de nota e o badge vermelho "Margem negativa" quando `margin.isNegative`. Filtros de busca, cliente, motorista e status no cabeçalho, refletidos na querystring.
- **Painel** e **Detalhe da viagem** usam a mesma linguagem: cards brancos com borda esquerda colorida, caixas de nota, badges em pill e botões pequenos.

## Seed (`apps/api/prisma/seed.ts`)

Usa os casos de uso, não insere direto no banco, para garantir consistência. As datas são relativas a hoje. Só popula se o banco estiver vazio. Cadastra 3 a 4 clientes e 5 a 6 motoristas com CPF/CNPJ válidos, e estas 13 viagens:

1. Criada, sem eventos.
2. Só CT-e, sem foto.
3. Só foto, sem CT-e (ordem invertida).
4. Carregada, com adiantamento vencendo hoje.
5. Carregada, com adiantamento vencido.
6. Adiantamento pago, aguardando descarga.
7. Descarregada sem comprovante (saldo travado).
8. Descarga e comprovantes registrados antes do adiantamento pago (fica em `LOADED`, com o saldo programável).
9. Comprovantes recebidos, saldo liberado e não programado.
10. Saldo programado para hoje.
11. Finalizada, com o a receber em aberto.
12. Margem negativa (frete do motorista maior que o do cliente).
13. Cancelada com o adiantamento pago (recuperação a receber do motorista; R13).

## Testes

- **Unitários (Vitest)** do domínio: divisão do frete, ciclo de vida, travas, próximos passos, margem, comparação de idempotência, documentos, datas e cancelamento (R13). Na API, também o serializador do CSV (`http/titles-csv.test.ts`).
- **E2E da API** em `apps/api/test/acceptance.test.ts`: usa `app.inject` contra o banco `transportadora_test` e percorre os critérios de aceite em sequência.
  1. Viagem com frete do cliente R$ 5.000,00 e frete do motorista R$ 3.333,33 a 70%.
  2. CT-e sem foto não gera títulos.
  3. Foto gera adiantamento de 2.333,33 e saldo de 1.000,00.
  4. O a receber vence conforme o prazo do cliente.
  5. Programar o saldo antes da descarga dá 422 (`POST /titles/:id/schedule`); no lote, a recusa vem em `rejected`.
  6. Descarga sem comprovante mantém o saldo travado.
  7. Comprovante libera o saldo.
  8. Baixa do adiantamento e depois do saldo leva a `BALANCE_PAID`.
  9. Reenviar o CT-e não duplica títulos.
  10. Margem negativa aparece sinalizada.
  - Bônus: exportação CSV; cancelamento com o adiantamento em aberto (tudo cancelado, sem recuperação) e com o adiantamento pago (recuperação criada, margem zerada, eventos posteriores → 409).
- **Front:** só `format.ts`.

## Definição de pronto (toda tarefa)

- `npm run typecheck`, `npm run lint` e `npm test` passando.
- Sem `any` explícito, sem `console.log` esquecido e sem código morto.
- Não commitar: quem commita é o orquestrador.

## Premissas (vão para o README)

- A descarga e os comprovantes são aceitos antes da baixa do adiantamento; o estado avança na sequência (R8).
- O saldo vence na data de chegada dos comprovantes.
- A baixa é sempre integral.
- O filtro de período da lista de viagens usa a data de criação.
