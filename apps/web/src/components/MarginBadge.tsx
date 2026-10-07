import { Badge, Tooltip } from '@mantine/core';
import { IconTrendingDown } from '@tabler/icons-react';
import type { Margin } from '../api/types';
import { formatBRL, formatPercent } from '../lib/format';
import { MARGIN_KIND_LABEL } from '../lib/labels';

interface MarginBadgeProps {
  /** Margem calculada pela API; `null` quando não há títulos nem frete cotado. */
  margin: Margin | null;
  /** Mostra o percentual depois do valor (padrão); desligue em espaços estreitos. */
  showPercent?: boolean;
  /** Nos negativos, escreve "Margem negativa · valor" (sinaliza e mostra o valor). */
  negativeLabel?: boolean;
  /** Acrescenta "proj." na margem projetada (padrão); desligue se o rótulo já diz isso. */
  showKind?: boolean;
  size?: 'xs' | 'sm';
}

/**
 * Margem da viagem em pill: verde quando positiva e vermelha, com ícone, quando negativa.
 * Margem projetada (só frete cotado) leva o sufixo "proj." e a explicação no tooltip.
 */
export function MarginBadge({
  margin,
  showPercent = true,
  negativeLabel = false,
  showKind = true,
  size = 'sm',
}: MarginBadgeProps) {
  if (!margin) {
    return (
      <Badge variant="light" color="gray" size={size} radius="xl" tt="none" fw={500}>
        Sem margem
      </Badge>
    );
  }

  const amount = formatBRL(margin.amountCents);
  const percent =
    showPercent && margin.percent !== null ? ` · ${formatPercent(margin.percent)}` : '';
  const suffix = showKind && margin.kind === 'PROJECTED' ? ' proj.' : '';
  const value = `${amount}${percent}${suffix}`;
  const text = negativeLabel && margin.isNegative ? `Margem negativa · ${amount}` : value;
  const tooltip = `Margem ${MARGIN_KIND_LABEL[margin.kind].toLowerCase()}: ${amount} (${formatPercent(margin.percent)})`;

  return (
    <Tooltip label={tooltip} withArrow openDelay={300}>
      <Badge
        variant="light"
        color={margin.isNegative ? 'red' : 'teal'}
        size={size}
        radius="xl"
        tt="none"
        fw={600}
        leftSection={margin.isNegative ? <IconTrendingDown size={11} stroke={2} /> : undefined}
      >
        {text}
      </Badge>
    </Tooltip>
  );
}
