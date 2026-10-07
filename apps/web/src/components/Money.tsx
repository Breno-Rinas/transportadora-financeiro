import { Text, type TextProps } from '@mantine/core';
import { formatBRL } from '../lib/format';

interface MoneyProps extends Omit<TextProps, 'children'> {
  /** Valor em centavos; `null`/`undefined` mostram traço. */
  cents: number | null | undefined;
  /** Cor dos valores positivos; os negativos são sempre vermelhos. */
  positiveColor?: TextProps['c'];
}

/** Valor em reais (`R$ 6.500,00`), em vermelho quando negativo. */
export function Money({ cents, positiveColor, ...rest }: MoneyProps) {
  if (cents === null || cents === undefined) {
    return (
      <Text span inherit c="dimmed" {...rest}>
        —
      </Text>
    );
  }
  return (
    <Text span inherit c={cents < 0 ? 'red.7' : positiveColor} {...rest}>
      {formatBRL(cents)}
    </Text>
  );
}
