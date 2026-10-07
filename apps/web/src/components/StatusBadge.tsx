import { Badge, type MantineColor } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import type { DueBucket, LockReason, TitleNature, TitleStatus, TripStatus } from '../api/types';
import {
  DUE_BUCKET_COLOR,
  DUE_BUCKET_LABEL,
  TITLE_STATUS_COLOR,
  TRIP_STATUS_COLOR,
  TRIP_STATUS_LABEL,
  titleStatusLabel,
} from '../lib/labels';

interface PillProps {
  color: MantineColor;
  children: ReactNode;
  icon?: ReactNode;
  /** `sm` (padrão, 11 px) ou `xs` (10 px, para linhas densas). */
  size?: 'xs' | 'sm';
  title?: string;
}

/** Pill do sistema: variante light com borda da mesma cor, sem caixa alta ("Prospectando"). */
export function Pill({ color, children, icon, size = 'sm', title }: PillProps) {
  return (
    <Badge
      variant="light"
      color={color}
      size={size}
      radius="xl"
      tt="none"
      fw={500}
      leftSection={icon}
      title={title}
      styles={{
        root: {
          border: `1px solid color-mix(in srgb, var(--mantine-color-${color}-light-color) 22%, transparent)`,
          paddingInline: 8,
        },
      }}
    >
      {children}
    </Badge>
  );
}

/** Status da viagem (Criada, Carregada...), com os rótulos e cores de `labels.ts`. */
export function TripStatusBadge({ status, size }: { status: TripStatus; size?: 'xs' | 'sm' }) {
  return (
    <Pill color={TRIP_STATUS_COLOR[status]} size={size}>
      {TRIP_STATUS_LABEL[status]}
    </Pill>
  );
}

interface TitleStatusBadgeProps {
  status: TitleStatus;
  /** Com `RECEIVABLE`, um título pago aparece como "Recebido". */
  nature?: TitleNature;
  size?: 'xs' | 'sm';
}

/** Status do título (Em aberto, Programado, Pago/Recebido, Cancelado). */
export function TitleStatusBadge({ status, nature, size }: TitleStatusBadgeProps) {
  return (
    <Pill color={TITLE_STATUS_COLOR[status]} size={size}>
      {titleStatusLabel(status, nature)}
    </Pill>
  );
}

/** Faixa da data efetiva (Vencidos, Hoje, Próximos 7 dias...). */
export function BucketBadge({ bucket, size }: { bucket: DueBucket; size?: 'xs' | 'sm' }) {
  return (
    <Pill color={DUE_BUCKET_COLOR[bucket]} size={size}>
      {DUE_BUCKET_LABEL[bucket]}
    </Pill>
  );
}

/**
 * Motivos da trava do saldo como badges laranja com cadeado (um por motivo). O texto vem pronto
 * da API; sem motivos, não renderiza nada.
 */
export function LockReasonBadges({
  reasons,
  size = 'xs',
}: {
  reasons: readonly LockReason[];
  size?: 'xs' | 'sm';
}) {
  return (
    <>
      {reasons.map((reason) => (
        <Pill
          key={reason.code}
          color="orange"
          size={size}
          icon={<IconLock size={10} stroke={1.8} />}
        >
          {reason.message}
        </Pill>
      ))}
    </>
  );
}
