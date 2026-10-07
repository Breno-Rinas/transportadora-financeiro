import { describe, expect, it } from 'vitest';
import {
  formatBRL,
  formatBRLNumber,
  formatDate,
  formatDateTime,
  formatInstantDate,
  formatPercent,
  formatTripCode,
  formatWeightKg,
  maskCnpj,
  maskCpfCnpj,
  maskPlate,
  normalizeCnpj,
  normalizeDocument,
  normalizePlate,
  onlyDigits,
  parseBRL,
} from './format';

/** O Intl usa espaço sem quebra (U+00A0) depois de `R$`; nos testes comparamos com espaço comum. */
function plain(text: string): string {
  return text.replace(/\u00a0/g, ' ');
}

describe('formatBRL', () => {
  it('formata centavos em reais, com milhar e vírgula', () => {
    expect(plain(formatBRL(333333))).toBe('R$ 3.333,33');
    expect(plain(formatBRL(500000))).toBe('R$ 5.000,00');
    expect(plain(formatBRL(1))).toBe('R$ 0,01');
    expect(plain(formatBRL(0))).toBe('R$ 0,00');
  });

  it('formata negativos com sinal', () => {
    expect(plain(formatBRL(-50050))).toBe('-R$ 500,50');
  });

  it('formatBRLNumber devolve o número sem símbolo, com 2 casas', () => {
    expect(formatBRLNumber(333333)).toBe('3.333,33');
    expect(formatBRLNumber(100000)).toBe('1.000,00');
    expect(formatBRLNumber(5)).toBe('0,05');
  });
});

describe('parseBRL', () => {
  it('converte o texto digitado em centavos', () => {
    expect(parseBRL('3.333,33')).toBe(333333);
    expect(parseBRL('3333,33')).toBe(333333);
    expect(parseBRL('1.000.000,00')).toBe(100000000);
    expect(parseBRL('0,01')).toBe(1);
  });

  it('completa as casas decimais que faltam', () => {
    expect(parseBRL('3333')).toBe(333300);
    expect(parseBRL('3333,5')).toBe(333350);
    expect(parseBRL(',5')).toBe(50);
    expect(parseBRL('3333,')).toBe(333300);
  });

  it('aceita símbolo, espaços e o NBSP do Intl', () => {
    expect(parseBRL('R$ 3.333,33')).toBe(333333);
    expect(parseBRL(` R$\u00a01.000,00 `)).toBe(100000);
  });

  it('aceita sinal negativo', () => {
    expect(parseBRL('-500,50')).toBe(-50050);
    expect(parseBRL('-0')).toBe(0);
  });

  it('é o inverso de formatBRLNumber', () => {
    for (const cents of [1, 99, 100, 123456, 333333, 99999999]) {
      expect(parseBRL(formatBRLNumber(cents))).toBe(cents);
    }
  });

  it('devolve null para entradas inválidas ou ambíguas', () => {
    expect(parseBRL('')).toBeNull();
    expect(parseBRL('   ')).toBeNull();
    expect(parseBRL('abc')).toBeNull();
    expect(parseBRL('R$')).toBeNull();
    expect(parseBRL(',')).toBeNull();
    expect(parseBRL('1,234,56')).toBeNull();
    expect(parseBRL('3,333,33')).toBeNull();
    expect(parseBRL('3.33')).toBeNull();
    expect(parseBRL('3,333')).toBeNull();
    expect(parseBRL('12.34.567,00')).toBeNull();
    expect(parseBRL('1e5')).toBeNull();
  });

  it('rejeita valores além do inteiro seguro', () => {
    expect(parseBRL('9'.repeat(30))).toBeNull();
  });
});

describe('formatPercent', () => {
  it('usa vírgula e 2 casas', () => {
    expect(formatPercent(12.5)).toBe('12,50%');
    expect(formatPercent(-10)).toBe('-10,00%');
    expect(formatPercent(0)).toBe('0,00%');
  });

  it('devolve traço quando não há percentual', () => {
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(undefined)).toBe('—');
  });
});

describe('formatTripCode e formatWeightKg', () => {
  it('formata o código da viagem com 4 dígitos', () => {
    expect(formatTripCode(1)).toBe('VG-0001');
    expect(formatTripCode(42)).toBe('VG-0042');
    expect(formatTripCode(12345)).toBe('VG-12345');
  });

  it('formata o peso com milhar', () => {
    expect(formatWeightKg(28000)).toBe('28.000 kg');
    expect(formatWeightKg(950)).toBe('950 kg');
  });
});

describe('formatDate', () => {
  it('troca a ordem do texto, sem Date', () => {
    expect(formatDate('2026-03-12')).toBe('12/03/2026');
    expect(formatDate('2026-01-01')).toBe('01/01/2026');
  });

  it('devolve traço para vazio e mantém texto fora do padrão', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('')).toBe('—');
    expect(formatDate('12/03/2026')).toBe('12/03/2026');
  });
});

describe('formatDateTime', () => {
  it('converte o instante para o fuso de negócio (America/Sao_Paulo, UTC-3)', () => {
    expect(formatDateTime('2026-03-12T17:30:00.000Z')).toBe('12/03/2026 14:30');
  });

  it('muda o dia quando o instante em UTC já é o dia seguinte', () => {
    expect(formatDateTime('2026-03-13T01:15:00Z')).toBe('12/03/2026 22:15');
  });

  it('usa a meia-noite como 00:00, não 24:00', () => {
    expect(formatDateTime('2026-03-12T03:00:00Z')).toBe('12/03/2026 00:00');
  });

  it('devolve traço para vazio e o texto original quando não é uma data', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime('não é data')).toBe('não é data');
  });
});

describe('formatInstantDate', () => {
  it('devolve só o dia no fuso de negócio', () => {
    expect(formatInstantDate('2026-03-12T17:30:00.000Z')).toBe('12/03/2026');
    expect(formatInstantDate('2026-03-13T01:15:00Z')).toBe('12/03/2026');
  });

  it('devolve traço para vazio e o texto original quando não é uma data', () => {
    expect(formatInstantDate(null)).toBe('—');
    expect(formatInstantDate('não é data')).toBe('não é data');
  });
});

describe('máscaras', () => {
  it('maskCnpj formata e aceita entrada parcial', () => {
    expect(maskCnpj('12345678000195')).toBe('12.345.678/0001-95');
    expect(maskCnpj('12.345.678/0001-95')).toBe('12.345.678/0001-95');
    expect(maskCnpj('123')).toBe('12.3');
    expect(maskCnpj('12345678')).toBe('12.345.678');
    expect(maskCnpj('123456780')).toBe('12.345.678/0');
    expect(maskCnpj('')).toBe('');
  });

  it('maskCnpj ignora o que passa de 14 dígitos', () => {
    expect(maskCnpj('123456780001959999')).toBe('12.345.678/0001-95');
  });

  it('maskCpfCnpj usa CPF até 11 dígitos e CNPJ acima', () => {
    expect(maskCpfCnpj('12345678909')).toBe('123.456.789-09');
    expect(maskCpfCnpj('1234')).toBe('123.4');
    expect(maskCpfCnpj('123456789012')).toBe('12.345.678/9012');
    expect(maskCpfCnpj('12345678000195')).toBe('12.345.678/0001-95');
  });

  it('maskCnpj aceita o CNPJ alfanumérico, em maiúsculas', () => {
    expect(maskCnpj('12abc34501de35')).toBe('12.ABC.345/01DE-35');
    expect(maskCnpj('12.ABC.345/01DE-35')).toBe('12.ABC.345/01DE-35');
    expect(maskCnpj('12ABC345')).toBe('12.ABC.345');
  });

  it('maskCnpj só aceita número nos 2 dígitos verificadores', () => {
    expect(maskCnpj('12ABC34501DEAB')).toBe('12.ABC.345/01DE');
    expect(maskCnpj('12ABC34501DE3A')).toBe('12.ABC.345/01DE-3');
  });

  it('maskCpfCnpj troca para a máscara de CNPJ quando aparece letra', () => {
    expect(maskCpfCnpj('12A')).toBe('12.A');
    expect(maskCpfCnpj('12abc34501de35')).toBe('12.ABC.345/01DE-35');
  });

  it('normalizeCnpj e normalizeDocument devolvem o formato salvo, sem máscara', () => {
    expect(normalizeCnpj('12.abc.345/01de-35')).toBe('12ABC34501DE35');
    expect(normalizeCnpj('12.345.678/0001-95')).toBe('12345678000195');
    expect(normalizeDocument('123.456.789-09')).toBe('12345678909');
    expect(normalizeDocument('12.345.678/0001-95')).toBe('12345678000195');
    expect(normalizeDocument('12.abc.345/01de-35')).toBe('12ABC34501DE35');
  });

  it('maskPlate aceita o formato antigo e o Mercosul, em maiúsculas', () => {
    expect(maskPlate('abc1234')).toBe('ABC-1234');
    expect(maskPlate('ABC1D23')).toBe('ABC-1D23');
    expect(maskPlate('abc-1d23')).toBe('ABC-1D23');
    expect(maskPlate('ab')).toBe('AB');
    expect(maskPlate('abc1')).toBe('ABC-1');
    expect(maskPlate('ABC1234999')).toBe('ABC-1234');
  });

  it('onlyDigits e normalizePlate devolvem o formato salvo, sem máscara', () => {
    expect(onlyDigits('12.345.678/0001-95')).toBe('12345678000195');
    expect(normalizePlate('abc-1d23')).toBe('ABC1D23');
    expect(normalizePlate('  abc 1234 ')).toBe('ABC1234');
  });
});
