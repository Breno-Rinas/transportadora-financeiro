import { describe, expect, it } from 'vitest';
import type { TitleListView } from '../application/title-view.js';
import { formatCsvAmount, formatCsvDate, serializeTitlesCsv } from './titles-csv.js';

const UNLOCKED = { canSchedule: true, canSettle: true, reasons: [] };

const titleView = (overrides: Partial<TitleListView>): TitleListView => ({
  id: 'b7d4c0de-0000-4000-8000-000000000001',
  tripId: 'b7d4c0de-0000-4000-8000-000000000002',
  nature: 'PAYABLE',
  kind: 'ADVANCE',
  amountCents: 233333,
  dueDate: '2026-03-20',
  scheduledFor: null,
  effectiveDate: '2026-03-20',
  status: 'OPEN',
  payment: null,
  createdAt: new Date('2026-03-20T13:05:00Z'),
  updatedAt: new Date('2026-03-20T13:05:00Z'),
  locks: UNLOCKED,
  bucket: 'TODAY',
  trip: {
    id: 'b7d4c0de-0000-4000-8000-000000000002',
    code: 7,
    origin: 'Rio Verde/GO',
    destination: 'Santos/SP',
    status: 'LOADED',
    client: { id: 'c', legalName: 'Agro Cerrado Ltda' },
    driver: { id: 'd', name: 'João da Silva', vehiclePlate: 'ABC1D23' },
  },
  ...overrides,
});

const rowsOf = (csv: string): string[] => csv.slice(1).split('\r\n');

describe('formatCsvAmount', () => {
  it('vírgula decimal, sem separador de milhar e sem float', () => {
    expect(formatCsvAmount(123456)).toBe('1234,56');
    expect(formatCsvAmount(100000)).toBe('1000,00');
    expect(formatCsvAmount(5)).toBe('0,05');
    expect(formatCsvAmount(-150000)).toBe('-1500,00');
    expect(formatCsvAmount(2_147_483_647)).toBe('21474836,47');
  });
});

describe('formatCsvDate', () => {
  it('dd/mm/aaaa a partir da string, e vazio sem data', () => {
    expect(formatCsvDate('2026-03-05')).toBe('05/03/2026');
    expect(formatCsvDate(null)).toBe('');
  });
});

describe('serializeTitlesCsv', () => {
  it('começa com o BOM UTF-8, usa ; e CRLF, e termina com quebra de linha', () => {
    const csv = serializeTitlesCsv([]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toBe(
      '﻿Viagem;Natureza;Espécie;Cliente/Motorista;Valor;Vencimento;Programado para;Status;Motivo da trava\r\n',
    );
  });

  it('uma linha por título, com o nome do cliente ou do motorista conforme a espécie', () => {
    const csv = serializeTitlesCsv([
      titleView({ scheduledFor: '2026-03-25', status: 'SCHEDULED' }),
      titleView({
        nature: 'RECEIVABLE',
        kind: 'CLIENT_FREIGHT',
        amountCents: 500000,
        dueDate: '2026-04-18',
        status: 'PAID',
      }),
      titleView({ nature: 'RECEIVABLE', kind: 'ADVANCE_RECOVERY', dueDate: '2026-03-21' }),
    ]);

    expect(rowsOf(csv).slice(1, 4)).toEqual([
      'VG-0007;A pagar;Adiantamento;João da Silva;2333,33;20/03/2026;25/03/2026;Programado;',
      'VG-0007;A receber;Frete do cliente;Agro Cerrado Ltda;5000,00;18/04/2026;;Recebido;',
      'VG-0007;A receber;Recuperação de adiantamento;João da Silva;2333,33;21/03/2026;;Em aberto;',
    ]);
  });

  it('saldo travado: os motivos na última coluna, entre aspas por causa do ;', () => {
    const csv = serializeTitlesCsv([
      titleView({
        kind: 'BALANCE',
        amountCents: 100000,
        dueDate: null,
        locks: {
          canSchedule: false,
          canSettle: false,
          reasons: [
            { code: 'NOT_UNLOADED', message: 'Aguardando registro da descarga' },
            { code: 'ADVANCE_NOT_PAID', message: 'O saldo só pode ser pago após a baixa' },
          ],
        },
      }),
    ]);

    expect(rowsOf(csv)[1]).toBe(
      'VG-0007;A pagar;Saldo;João da Silva;1000,00;;;Em aberto;' +
        '"Aguardando registro da descarga; O saldo só pode ser pago após a baixa"',
    );
  });

  it('escapa aspas e neutraliza nome que o Excel executaria como fórmula', () => {
    const trip = titleView({}).trip;
    const csv = serializeTitlesCsv([
      titleView({ trip: { ...trip, driver: { ...trip.driver, name: 'José "Zé" Lima' } } }),
      titleView({ trip: { ...trip, driver: { ...trip.driver, name: '=HYPERLINK("x")' } } }),
    ]);

    const [, quoted, formula] = rowsOf(csv);
    expect(quoted).toContain(';"José ""Zé"" Lima";');
    expect(formula).toContain(`;"'=HYPERLINK(""x"")";`);
  });
});
