# Módulo Financeiro de Transportadora

Transportadora com frota terceirizada: cada viagem tem um frete a receber do cliente e um frete a pagar ao motorista, pago em duas parcelas (adiantamento no carregamento; saldo só depois da descarga **e** da chegada física do canhoto original do CT-e).
O módulo responde: quanto pagar hoje, quanto receber, quais saldos estão travados e por quê, e qual a margem de cada viagem.

A especificação completa, com todas as regras (R1 a R13) e decisões, está em [`CLAUDE.md`](./CLAUDE.md). Este README resume o que importa para avaliar e registra os trade-offs e limites.

## Como rodar em menos de 5 minutos

**Pré-requisitos:** Docker com Compose. Node 22.22+ só para o modo dev e para rodar os testes fora de container (mínimo exigido pelo React Router 8; o Prisma 7.10 exige 22.18). O `.nvmrc` aponta para a 22.

```bash
docker compose up --build
```

| Serviço | URL |
|---|---|
| Web (nginx, com proxy de `/api` e `/uploads`) | http://localhost:5173 |
| API | http://localhost:3333/api |
| PostgreSQL 16 (no host) | `127.0.0.1:5433` |

A API aplica as migrations e roda o seed ao subir. Não precisa de `.env`: todos os valores têm default de desenvolvimento (ver `.env.example`).

**Modo dev** (API com `tsx watch` e Vite com HMR):

```bash
npm install && npm run dev
```

Sobe só o banco no Docker, aplica migrations + seed (se o banco estiver vazio) e roda API e web. Usa as mesmas portas 3333 e 5173 do Compose completo: pare `api` e `web` do Compose antes (`docker compose stop api web`).

**Testes:**

```bash
npm test                    # todos os workspaces
npm run typecheck && npm run lint
```

O E2E da API (`apps/api/test/acceptance.test.ts`) usa o banco `transportadora_test`, criado junto com o `db`, e precisa dele no ar (`docker compose up -d db`). Ele aplica as migrations e limpa as tabelas sozinho. O banco de testes só é criado quando o volume do Postgres é novo; se o volume for antigo, rode `docker compose down -v` antes.

**Recomeçar do zero:** `npm run db:reset` (recria o banco, aplica migrations e roda o seed). Sem Node na máquina: `docker compose down -v && docker compose up --build`.

### Seed: 13 viagens em estados diferentes

O seed sobe automaticamente quando o banco está vazio, passando pelos mesmos casos de uso da API (não insere direto no banco), com 4 clientes e 6 motoristas de documentos válidos. As datas são relativas ao dia em que o seed rodou; se subir em outro dia, use `db:reset` para reancorar. Num banco novo os códigos vão de VG-0001 a VG-0013, na ordem abaixo.

| Viagem | Caso de borda |
|---|---|
| VG-0001 | Criada, sem eventos |
| VG-0002 | Só CT-e, sem foto: nenhum título gerado |
| VG-0003 | Só foto, sem CT-e (ordem invertida): nenhum título gerado |
| VG-0004 | Carregada, adiantamento vencendo hoje |
| VG-0005 | Carregada, adiantamento vencido |
| VG-0006 | Adiantamento pago, aguardando descarga |
| VG-0007 | Descarregada sem comprovante: saldo travado por falta do canhoto |
| VG-0008 | Descarga e comprovantes registrados antes do adiantamento pago: fica em `LOADED`, saldo programável mas não pagável |
| VG-0009 | Comprovantes recebidos, saldo liberado e ainda não programado |
| VG-0010 | Saldo programado para hoje |
| VG-0011 | Finalizada, com o a receber do cliente ainda em aberto |
| VG-0012 | Margem negativa (frete do motorista maior que o do cliente) |
| VG-0013 | Cancelada com adiantamento já pago: recuperação a receber do motorista |

## Roteiro sugerido para avaliar

O mesmo roteiro roda automatizado no E2E. Na interface:

1. **Criar a viagem.** Em `/viagens`, "Nova viagem": cliente Agro Cerrado (prazo de 30 dias), frete cotado R$ 5.000,00, frete do motorista R$ 3.333,33, adiantamento 70%. A viagem nasce "Criada" com margem projetada de R$ 1.666,67 (cotado menos frete do motorista).
2. **CT-e sem foto não gera títulos.** No detalhe, registre o CT-e (o frete cotado vem pré-preenchido). Nenhum título nasce; o próximo passo mostra "Aguardando foto do carregamento".
3. **A foto gera os 3 títulos.** Anexe a foto do carregamento (JPEG, PNG ou WEBP, até 10 MB): nascem o adiantamento de R$ 2.333,33, o saldo de R$ 1.000,00 (a pagar, sem vencimento) e o frete do cliente de R$ 5.000,00 (a receber). A viagem vira "Carregada".
4. **O a receber segue o prazo do cliente.** Vencimento = data de emissão do CT-e + 30 dias.
5. **Saldo travado.** Tente programar o saldo: a recusa mostra os motivos vindos da API. Em `/financeiro`, selecione adiantamento e saldo e use "Programar selecionados": o adiantamento é programado e o saldo aparece como recusado, com o motivo.
6. **Descarga sem comprovante mantém a trava.** Registre a descarga: o saldo continua travado ("Aguardando chegada do canhoto original do CT-e").
7. **O comprovante libera o saldo.** Registre os comprovantes: o saldo ganha vencimento (a data do comprovante) e pode ser programado. A viagem continua "Carregada" porque o adiantamento ainda não foi pago (ver decisão R8 abaixo), e a pendência mostra isso.
8. **Ordem de pagamento.** Tente dar baixa no saldo antes do adiantamento: recusado (`ADVANCE_NOT_PAID`).
9. **Baixas.** Dê baixa no adiantamento: a viagem avança em sequência (três transições gravadas na linha do tempo, até "Comprovantes recebidos"). Dê baixa no saldo: "Finalizada". O a receber continua em aberto.
10. **Idempotência.** Reenvie o mesmo CT-e (mesmos número, série, data de emissão e valor): 200, sem títulos duplicados. Com qualquer dado diferente: 409 `EVENT_ALREADY_REGISTERED`. Pela API (o `<id>` vem da URL do detalhe; os valores de `cte` vêm de `GET /api/trips/<id>`):
    ```bash
    curl -i -X POST http://localhost:3333/api/trips/<id>/cte -H 'Content-Type: application/json' \
      -d '{"number":<cte.number>,"series":<cte.series>,"issuedAt":"<cte.issuedAt>","clientFreightCents":<cte.clientFreightCents>}'
    ```
11. **Margem negativa.** Abra VG-0012: margem em vermelho com ícone na lista e badge "Margem negativa" no quadro de viagens.
12. **Bônus.** VG-0013 mostra o cancelamento com recuperação. Para cancelar na interface, use o cancelamento no detalhe de uma viagem aberta e informe o motivo. A exportação CSV da agenda está em `GET /api/titles/export.csv` (aceita os filtros de `/titles`).

## Arquitetura

Monorepo com npm workspaces (`apps/api`, `apps/web`), TypeScript `strict` nos dois. API: Fastify 5, Prisma 7, PostgreSQL 16, Zod 4, Vitest. Web: Vite 8, React 19, React Router 8, TanStack Query, Mantine 9.

```
apps/api/
  prisma/            schema, migrations, seed
  src/
    domain/          regras puras (shared, trip, title, dashboard)
    application/     casos de uso, um por arquivo
    infra/           Prisma, storage em disco, lock da viagem, clock, env
    http/            rotas, schemas Zod, serializers, error handler, CSV
  test/              E2E de aceite
apps/web/src/
  api/               cliente fetch tipado e DTOs (sem regra)
  components/        quadro, cards, inputs de dinheiro e documento
  layout/            AppShell (sidebar + topbar)
  lib/               format.ts (pt-BR), labels.ts (apresentação)
  pages/             Painel, Viagens, Detalhe, Financeiro, Clientes, Motoristas
docker/postgres/     cria o banco de testes
```

**Camadas da API e por quê:**

| Camada | Papel | Por quê |
|---|---|---|
| `domain/` | Funções puras. Não importam Fastify, Prisma nem I/O. Decidem ou lançam `DomainError(code, message)`. | Toda regra de negócio fica num lugar só e é testada sem banco. |
| `application/` | Abre a transação, trava a viagem, carrega dados, chama o domínio, persiste. Não decide regra. | Separa orquestração de decisão; a regra não vaza para as rotas nem para o Prisma. |
| `infra/` | Prisma, arquivos em disco, `lockTrip`, `Clock`, env. | Isola o que é efeito colateral e permite injetar relógio e banco nos testes. |
| `http/` | Valida com Zod, chama um caso de uso, serializa e traduz erro em status. | Rotas finas; o contrato HTTP muda sem tocar nas regras. |

**Onde mexer para mudar cada tipo de regra:**

| Para mudar... | Arquivo |
|---|---|
| Divisão do frete, arredondamento | `domain/shared/money.ts` |
| Gatilho e vencimentos dos títulos | `domain/trip/title-generation.ts` |
| Travas do saldo | `domain/title/locks.ts` |
| Programar e dar baixa (pré-condições) | `domain/title/operations.ts` |
| Sequência do ciclo de vida | `domain/trip/lifecycle.ts` |
| Idempotência e datas dos eventos | `domain/trip/event-rules.ts` |
| Margem | `domain/trip/margin.ts` |
| Cancelamento | `domain/trip/cancellation.ts` |
| Próximos passos ("o que falta") | `domain/trip/pending-steps.ts` |
| Agenda (vencidos, hoje, semana) e painel | `domain/title/agenda.ts`, `domain/dashboard/indicators.ts` |
| CPF, CNPJ, placa | `domain/shared/documents.ts` |
| Novo código de erro | `domain/errors.ts` e `statusByCode` em `http/error-handler.ts` (o typecheck cobra) |
| Nova rota ou caso de uso | `application/` + `http/routes/` (registrar em `routes/index.ts`) |
| Rótulos e cores de enums na UI | `apps/web/src/lib/labels.ts` |

## Decisões de modelagem e por quê

- **Dinheiro em centavos.** Inteiro (`Int`) no banco, no domínio e na API; nunca float. O adiantamento é `floor((total * percent + 50) / 100)` (half-up em aritmética inteira) e o saldo é `total - adiantamento`, então a soma sempre fecha. Caso 3.333,33 a 70%: 233.333 de adiantamento (R$ 2.333,33) e 100.000 de saldo (R$ 1.000,00); a 50%, 166.667 + 166.666. No front, `parseBRL` converte manipulando a string, sem `parseFloat`.
- **Eventos como fatos com data e unique.** `TripEvent` guarda o que aconteceu (`occurredAt`, informado) separado de quando foi registrado (`recordedAt`), com `@@unique([tripId, type])`. Vencimentos usam a data do fato, não a do cadastro.
- **Título como única fonte de verdade.** Agenda, painel, CSV e margem leem de `Title`. CT-e e acordo geram os títulos uma vez; depois, ninguém recalcula valor a partir deles.
- **Estado persistido, que avança na sequência canônica.** `advanceLifecycle` roda na mesma transação de cada fato ou pagamento e grava cada passo em `TripStatusChange`. Permite filtrar e agrupar por status direto no banco e deixa histórico.
  *Por que aceitar a descarga antes da baixa do adiantamento:* o diagrama de estados põe `ADVANCE_PAID` antes de `UNLOADED`, mas o roteiro de aceite registra descarga e comprovantes antes da baixa do adiantamento. Recusar o fato contradiria o roteiro e a realidade (o caminhão descarrega de qualquer jeito). Escolha: o fato é aceito quando acontece; o estado nunca pula etapas. Quando o adiantamento é pago, uma baixa só percorre `LOADED → ADVANCE_PAID → UNLOADED → PROOFS_RECEIVED`, com três transições gravadas.
- **Travas com fonte única.** `getTitleLocks` devolve `{ canSchedule, canSettle, reasons }` e é a única função que decide. Os guards do backend e o campo `locks` de cada título na API usam a mesma saída; a UI só exibe os motivos. `ADVANCE_NOT_PAID` bloqueia apenas a baixa, não a programação.
- **Idempotência em duas barreiras.** (1) `unique(tripId, type)` em `TripEvent`: mesmo evento com os mesmos dados dá 200 sem reprocessar; com dados diferentes, 409. A comparação é por campos (CT-e), sha256 (foto) ou `occurredAt`. (2) `unique(tripId, kind)` em `Title`: mesmo que duas requisições passem pela primeira, o banco impede título duplicado. Violações `P2002` viram códigos de domínio pelo nome do índice (`application/conflicts.ts`).
- **Transação + `SELECT ... FOR UPDATE`.** Toda mutação roda em `$transaction` e começa travando a viagem (`lockTrip`). Sem isso, CT-e e foto chegando juntos poderiam, cada um, enxergar só o próprio fato e nenhum gerar os títulos. A foto só é gravada em disco quando o evento é novo e é apagada se a transação falhar. Dentro da transação, as consultas são sequenciais (uma conexão do `pg` por transação).
- **Datas sem hora como `DATE`.** Vencimento, programação e pagamento são `@db.Date`, trafegam como `YYYY-MM-DD` (tipo `LocalDate`) e nunca passam por `Date` do JS, o que evita o bug de fuso em que 12/03 vira 11/03. Instantes (eventos, emissão do CT-e) são `timestamptz`. "Hoje" é sempre calculado em `America/Sao_Paulo` (`BUSINESS_TZ`), com `Clock` injetável.
- **`Payment` separado do `Title`.** A baixa é uma entidade própria para suportar baixa parcial no futuro. Hoje só existe a integral: valor diferente do título dá 422 `PARTIAL_PAYMENT_NOT_SUPPORTED`.
- **`FreightAgreement` separado da `Trip`.** O acordo com o motorista (valor e percentual) fica em tabela própria para permitir renegociação e histórico depois, sem mexer na viagem. Custo atual: um join a mais.
- **Frete cotado versus valor do CT-e.** `Trip.quotedClientFreightCents` serve só para projeção de margem e para pré-preencher o CT-e. O valor do CT-e (`Cte.clientFreightCents`) é o que gera o a receber e pode diferir do cotado. Sem títulos, a margem é projetada (cotado menos motorista); com títulos, realizada.
- **CNPJ alfanumérico.** Aceito conforme a IN RFB 2.229/2024, além do só numérico, com validação pelos dígitos verificadores. CPF, CNPJ e placa são salvos só com dígitos/letras maiúsculas; a máscara é aplicada na exibição, e o `maskCnpj` do front aceita letras.

## Premissas assumidas

Perguntas que eu faria ao negócio e a resposta que assumi.

**Centrais:**

| Pergunta | Resposta assumida |
|---|---|
| A descarga e os comprovantes podem ser registrados antes de o adiantamento ser pago? | Sim. O fato é aceito quando acontece e o estado avança só pela sequência (R8). O saldo pode ser programado, mas não pago antes do adiantamento. |
| Quando vence o saldo do motorista? | Na data de chegada dos comprovantes. Antes disso não tem vencimento (`dueDate` nulo). |
| Pode haver baixa parcial? | Não. A baixa é sempre integral. |
| O filtro de período da lista de viagens olha qual data? | A data de criação da viagem. |

**Outras decisões que tomei sem poder confirmar:**

| Pergunta | Resposta assumida |
|---|---|
| Quando vence o adiantamento? | No dia do carregamento: o mais tarde entre os `occurredAt` do CT-e e da foto. |
| Quando vence o a receber? | Data de negócio da emissão do CT-e + prazo do cliente. |
| Quais percentuais de adiantamento existem? | Só 50% ou 70%. |
| Como arredondar o adiantamento? | Half-up em centavos; o saldo absorve a diferença. |
| Dá para programar um título a receber? | Não, só a pagar (422 `ONLY_PAYABLE_CAN_BE_SCHEDULED`). Programação com data >= hoje; baixa com data <= hoje. |
| Os eventos podem ter data no futuro ou fora de ordem? | Não: `occurredAt` futuro, ou anterior ao fato que o precede, dá 422 `INVALID_EVENT_DATE`. |
| O que conta como "vencendo na semana"? | De hoje até hoje + 6 dias, pela data efetiva (`scheduledFor` ou, se vazio, `dueDate`). |
| Qual período e qual margem o painel usa? | Mês corrente por padrão; soma as margens realizadas das viagens com CT-e emitido no período. Percentual ponderado (margem total / frete total). |
| Qual a margem de uma viagem sem títulos? | Projetada, se houver frete cotado; senão `null`. |
| Quando dá para cancelar a viagem? | Em qualquer status, menos finalizada ou já cancelada. Títulos em aberto ou programados são cancelados; os pagos ficam como histórico. |
| E se o adiantamento já foi pago ao cancelar? | Nasce um título a receber do motorista (`ADVANCE_RECOVERY`) com o mesmo valor, vencendo na data do cancelamento. A margem da viagem cancelada é sempre realizada (zero quando o adiantamento é recuperado). |
| E se o cliente já pagou ao cancelar? | O estorno ao cliente está fora do escopo; o valor recebido continua contando na margem. |
| O que vale como foto do carregamento? | JPEG, PNG ou WEBP de até 10 MB; o tipo é detectado pela assinatura do arquivo, não pelo mimetype declarado. |
| Qual o fuso? | `America/Sao_Paulo`, configurável por `BUSINESS_TZ`. |

## API

Prefixo `/api`.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Healthcheck |
| GET, POST | `/clients` | Listar (`?q`) / criar |
| GET, POST | `/drivers` | Listar (`?q`) / criar |
| GET | `/trips` | Filtros `status`, `clientId`, `driverId`, `from`, `to`, `q`. Cada item traz `clientFreightCents`, `driverFreightCents`, `pendingSteps` e `margin` |
| POST | `/trips` | Cria viagem com acordo de frete |
| GET | `/trips/:id` | Detalhe: cliente, motorista, acordo, CT-e, anexos, `timeline`, títulos (cada um com `locks`), `margin`, `pendingSteps` |
| POST | `/trips/:id/cte` | `{ number, series, issuedAt, clientFreightCents }` |
| POST | `/trips/:id/loading-photo` | Multipart: `file` e `occurredAt` opcional |
| POST | `/trips/:id/unloading` | `{ occurredAt }` |
| POST | `/trips/:id/proofs` | `{ occurredAt, note? }` |
| POST | `/trips/:id/cancel` | `{ reason, occurredAt? }` |
| GET | `/titles` | Filtros `nature`, `kind`, `status`, `dueFrom`, `dueTo`, `locked`, `tripId`. Ordenado por data efetiva |
| GET | `/titles/export.csv` | Mesmos filtros e ordem; CSV para Excel pt-BR (BOM UTF-8, `;`, valor `1234,56`, datas dd/mm/aaaa) |
| POST | `/titles/schedule` | Lote `{ titleIds, date }`. Sempre 200: `{ scheduled, rejected: [{ titleId, code, message }] }` |
| POST | `/titles/:id/schedule` | Programação individual `{ date }`; a recusa vira erro HTTP |
| POST | `/titles/:id/settle` | `{ paidOn, amountCents, note? }` |
| GET | `/dashboard` | Indicadores (`?from&to`, padrão: mês corrente) |
| GET | `/uploads/*` | Arquivos enviados |

As rotas de evento (CT-e, foto, descarga, comprovantes, cancelamento) devolvem o detalhe atualizado da viagem: **201** quando o evento é novo e **200** no reenvio idempotente. Margem, travas e pendências são sempre calculadas no backend e já vêm prontas na resposta.

**Formato único de erro:**

```json
{ "error": { "code": "BALANCE_LOCKED", "message": "Mensagem de negócio em pt-BR", "details": [] } }
```

| Status | Quando |
|---|---|
| 400 `VALIDATION_ERROR` | Entrada inválida (Zod, mensagens em pt-BR); `details` traz `{ path, message }` por campo. Também upload vazio ou de tipo não aceito |
| 404 `NOT_FOUND` | Recurso inexistente |
| 409 | Conflito de estado ou duplicidade: `EVENT_ALREADY_REGISTERED`, `TRIP_NOT_LOADED`, `UNLOADING_NOT_REGISTERED`, `TITLE_ALREADY_PAID`, `DOCUMENT_ALREADY_EXISTS`, `CTE_NUMBER_IN_USE`, `TRIP_CANCELLED`, `TITLE_CANCELLED`, `TRIP_ALREADY_FINISHED` |
| 413 `PAYLOAD_TOO_LARGE` | Upload acima de 10 MB |
| 422 | Violação de regra: `BALANCE_LOCKED`, `ADVANCE_NOT_PAID`, `PARTIAL_PAYMENT_NOT_SUPPORTED`, `INVALID_EVENT_DATE`, `INVALID_DATE`, `ONLY_PAYABLE_CAN_BE_SCHEDULED`, `INVALID_DOCUMENT` |
| 500 `INTERNAL_ERROR` | Só bug; não vaza stack e é logado |

O mapeamento de código para status é um `Record<DomainErrorCode, number>` em `http/error-handler.ts`: código novo sem mapeamento não compila.

## Interface

A interface segue o padrão visual do sistema FretouBR (sidebar azul-marinho, quadros em colunas, cards com borda esquerda colorida, badges em pill, Inter, UI densa pensada para 1366 px). Toda formatação é pt-BR: dinheiro sempre via `formatBRL` (R$ 6.500,00), datas dd/mm/aaaa sem passar por `Date`, máscaras de CPF, CNPJ e placa.

| Rota | Tela |
|---|---|
| `/` | **Painel:** indicadores do período (vencidos, hoje, 7 dias, a receber, saldos travados, margem). Atualiza a cada 30 s. O sino do topo mostra vencidos + vencendo hoje |
| `/viagens` | **Viagens:** quadro com uma coluna por status; card com frete, primeiro passo pendente e badge "Margem negativa". Filtros refletidos na querystring |
| `/viagens/:id` | **Detalhe:** próximos passos, valores lado a lado (cliente, motorista, margem), linha do tempo, foto, ações (CT-e, foto, descarga, comprovantes, cancelar) e títulos com programar e baixar na linha |
| `/financeiro` | **Contas a pagar e receber:** abas, quadro por data efetiva (Vencidos, Hoje, cada um dos próximos dias, Depois, Sem data), seleção múltipla com "Programar selecionados" e "Dar baixa" |
| `/clientes`, `/motoristas` | Tabela + modal de criação |

Comportamento: toda tela trata carregando (skeleton), erro (com "tentar de novo") e lista vazia com orientação; toda ação dá retorno por notificação, e os erros mostram a `message` do backend. O front não tem regra de negócio: margem, pendências, travas e totais vêm prontos da API. O botão de um título travado continua habilitado e o backend decide, com o motivo exibido. Toda mutação invalida painel, viagens e títulos, então os números atualizam sem recarregar.

## Bônus implementados

- **Testes: 257, todos passando.** API: 212 em 21 arquivos (21 deles são o E2E de aceite, que percorre os 10 critérios, a exportação CSV e o cancelamento; o resto cobre domínio, serializador do CSV, storage, datas do banco e app HTTP). Web: 45 em 3 arquivos (formatação, cliente HTTP e tratamento de erro). Cada regra do domínio tem teste unitário, incluindo o invariante `adiantamento + saldo = total`.
- **Cancelamento com recuperação de adiantamento** (R13): transacional, idempotente, com o fato `TRIP_CANCELLED` e o motivo gravados. Títulos abertos são cancelados e, se o adiantamento já foi pago, nasce o a receber do motorista.
- **Exportação CSV** da agenda, com os mesmos filtros: formato do Excel pt-BR e proteção contra injeção de fórmula (nome que começa com `= + - @` ganha `'`).
- **Docker Compose** com banco, migrations, seed, API e web (nginx) num comando.
- **Histórico de transições como auditoria parcial:** `TripStatusChange` grava de/para, gatilho e instante de cada passo do ciclo, e a linha do tempo do detalhe mescla eventos, baixas e transições.

## O que ficou de fora e por quê

- **Baixa parcial.** Fora do escopo; o modelo (`Payment` separado) já comporta.
- **Estorno ao cliente no cancelamento.** Se o cliente já pagou, nada é devolvido nem gerado; o valor recebido continua contando na margem.
- **Cancelamento isolado de CT-e e reemissão.** O CT-e é imutável depois de registrado: mesmos dados são um reenvio, dados diferentes dão 409. Corrigir um CT-e errado hoje exige cancelar a viagem.
- **Auditoria com autor.** Não há login (fora do escopo), então eventos, baixas e transições registram o quê e quando, não quem.
- **Sem camada de repositório (trade-off).** Os casos de uso usam o Prisma direto. Ganha-se menos indireção e menos código; paga-se com casos de uso acoplados ao Prisma, cuja cobertura depende de banco real (o E2E). As regras continuam isoladas e testáveis sem banco.
- **Imagem Docker da API grande.** O Prisma CLI é dependência de produção porque o container roda `prisma migrate deploy` ao subir. Mais simples de operar (um comando), mas a imagem carrega o CLI e o schema engine.
- **Dinheiro em `Int` de 32 bits.** Comporta até R$ 21.474.836,47 por valor. Suficiente para frete rodoviário, mas é um teto.
- **Listagens sem paginação.** Viagens, títulos, clientes e motoristas voltam inteiros.
- **Arquivos em disco local** (volume do Docker), sem armazenamento de objetos e sem autenticação em `/uploads/*`.
- **Testes do front limitados** a formatação, cliente HTTP e erros; não há teste de componente nem E2E de navegador.
- **`npm ls` acusa "invalid".** O `overrides` da raiz força versões corrigidas de dependências transitivas do Prisma CLI e do concurrently (zera o `npm audit`). O TypeScript fica em 6.0.x porque o typescript-eslint ainda não suporta o 7.
- **Escopo excluído desde o início:** SEFAZ, banco/PIX/boleto/CNAB, login e perfis, multiempresa, conciliação, DRE e app mobile.

## Com mais uma semana

1. **Baixa parcial.** Maior lacuna de negócio; `Payment` já existe separado, falta regra de saldo remanescente do título e a trava do saldo em cima dela.
2. **Login e auditoria com autor.** Gravar quem registrou evento, baixa e transição; sem isso a auditoria é só parcial.
3. **Correção de CT-e** (cancelamento isolado e reemissão), hoje só resolvido cancelando a viagem.
4. **Estorno ao cliente** no cancelamento, como título a pagar vinculado ao a receber já baixado.
5. **Paginação e índices** nas listagens, antes que o volume vire problema.
6. **Testes de interface:** componentes e E2E de navegador cobrindo o roteiro de aceite.
7. **Imagem da API enxuta:** mover a migração para um job ou imagem separada e tirar o Prisma CLI do runtime.
8. **Histórico de renegociação** do `FreightAgreement` e storage de arquivos em objeto.

## Uso de IA

Desenvolvido com apoio de IA (Claude Code), com a especificação e as decisões registradas em `CLAUDE.md` e todo o código revisado.
