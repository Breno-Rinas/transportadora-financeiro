import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { beforeAll, describe, expect, it } from 'vitest';
import type { DueBucket, TitleListItem } from '../../api/types';
import { buildFinanceColumns } from './columns';
import { matchesSearch } from './search';

beforeAll(() => {
  dayjs.locale('pt-br');
});

function makeItem(
  id: string,
  bucket: DueBucket | null,
  effectiveDate: string | null,
  overrides: Partial<TitleListItem> = {},
): TitleListItem {
  return {
    id,
    tripId: 'trip-1',
    nature: 'PAYABLE',
    kind: 'BALANCE',
    amountCents: 100000,
    dueDate: effectiveDate,
    scheduledFor: null,
    effectiveDate,
    status: 'OPEN',
    payment: null,
    createdAt: '2026-10-06T12:00:00.000Z',
    updatedAt: '2026-10-06T12:00:00.000Z',
    locks: { canSchedule: true, canSettle: true, reasons: [] },
    bucket,
    trip: {
      id: 'trip-1',
      code: 7,
      origin: 'Uberlândia - MG',
      destination: 'São Paulo - SP',
      status: 'LOADED',
      client: { id: 'c1', legalName: 'Agro Cerrado Ltda' },
      driver: { id: 'd1', name: 'José da Conceição', vehiclePlate: 'ABC1D23' },
    },
    ...overrides,
  };
}

describe('buildFinanceColumns', () => {
  const today = '2026-10-06';

  it('monta Vencidos, Hoje, um dia por coluna até hoje + 6, Depois e Sem data', () => {
    const columns = buildFinanceColumns([], today);
    expect(columns.map((column) => column.label)).toEqual([
      'Vencidos',
      'Hoje',
      'Amanhã',
      'quinta, 08/10',
      'sexta, 09/10',
      'sábado, 10/10',
      'domingo, 11/10',
      'segunda, 12/10',
      'Depois',
      'Sem data',
    ]);
    expect(columns[1]?.eyebrow).toBe('Hoje');
    expect(columns[2]?.key).toBe('2026-10-07');
  });

  it('coloca cada título na coluna da sua faixa e, na semana, no dia da data efetiva', () => {
    const items = [
      makeItem('a', 'OVERDUE', '2026-10-01'),
      makeItem('b', 'TODAY', '2026-10-06'),
      makeItem('c', 'WITHIN_WEEK', '2026-10-09'),
      makeItem('d', 'LATER', '2026-12-01'),
      makeItem('e', 'NO_DATE', null),
    ];
    const byKey = Object.fromEntries(
      buildFinanceColumns(items, today).map((column) => [
        column.key,
        column.items.map((item) => item.id),
      ]),
    );
    expect(byKey).toMatchObject({
      OVERDUE: ['a'],
      TODAY: ['b'],
      '2026-10-09': ['c'],
      LATER: ['d'],
      NO_DATE: ['e'],
    });
  });

  it('não perde um título da semana com data fora da janela esperada', () => {
    const columns = buildFinanceColumns([makeItem('x', 'WITHIN_WEEK', '2026-10-14')], today);
    const column = columns.find((candidate) => candidate.key === '2026-10-14');
    expect(column?.items.map((item) => item.id)).toEqual(['x']);
  });
});

describe('matchesSearch', () => {
  const item = makeItem('a', 'TODAY', '2026-10-06');

  it('encontra por motorista, cliente, código da viagem, rota e espécie, sem acentos', () => {
    expect(matchesSearch(item, 'jose conceicao')).toBe(true);
    expect(matchesSearch(item, 'agro')).toBe(true);
    expect(matchesSearch(item, 'vg-0007')).toBe(true);
    expect(matchesSearch(item, 'sao paulo')).toBe(true);
    expect(matchesSearch(item, 'saldo')).toBe(true);
  });

  it('exige todas as palavras e aceita busca vazia', () => {
    expect(matchesSearch(item, 'jose curitiba')).toBe(false);
    expect(matchesSearch(item, '   ')).toBe(true);
  });
});
