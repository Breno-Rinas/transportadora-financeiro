import { Text, TextInput, type TextInputProps } from '@mantine/core';
import { formatBRLNumber, parseBRL } from '../lib/format';

type MoneyInputProps = Omit<
  TextInputProps,
  'value' | 'onChange' | 'type' | 'leftSection' | 'inputMode'
> & {
  /** Texto digitado (`"3.333,33"`). Guarde-o no formulário e converta no envio com `parseBRL`. */
  value?: string;
  onChange: (value: string) => void;
};

/**
 * Campo de dinheiro em reais, com prefixo `R$`. Só aceita dígitos, ponto e vírgula; ao sair do
 * campo, um valor válido é reformatado (`3333,5` -> `3.333,50`). O valor em centavos sai de
 * `parseBRL(value)` (`null` = texto inválido ou vazio); `formatBRLNumber(cents)` preenche o inicial.
 */
export function MoneyInput({ value = '', onChange, onBlur, ...rest }: MoneyInputProps) {
  return (
    <TextInput
      inputMode="decimal"
      autoComplete="off"
      placeholder="0,00"
      leftSection={
        <Text span size="xs" c="dimmed" fw={500}>
          R$
        </Text>
      }
      leftSectionWidth={34}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value.replace(/[^\d.,]/g, ''))}
      onBlur={(event) => {
        const cents = parseBRL(value);
        if (cents !== null) onChange(formatBRLNumber(cents));
        onBlur?.(event);
      }}
      {...rest}
    />
  );
}
