import { Text } from '@mantine/core';
import { IconCoins, IconPercentage, IconTruckDelivery } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import type { TitleWithLocks, TripDetail } from '../../api/types';
import { KpiCard, Money, Pill, TitleStatusBadge } from '../../components';
import { formatDate, formatPercent } from '../../lib/format';
import { MARGIN_KIND_LABEL } from '../../lib/labels';
import { findTitle } from './helpers';
import classes from './TripDetail.module.css';

function ValueRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className={classes.valueRow}>
      <span className={classes.valueRowLabel}>{label}</span>
      <span className={classes.valueRowAmount}>{children}</span>
    </div>
  );
}

function DriverPartRow({ label, title }: { label: string; title: TitleWithLocks | undefined }) {
  return (
    <ValueRow label={label}>
      {title ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Money cents={title.amountCents} />
          <TitleStatusBadge status={title.status} nature={title.nature} size="xs" />
        </span>
      ) : (
        <Money cents={null} />
      )}
    </ValueRow>
  );
}

function ClientFreightCard({ detail }: { detail: TripDetail }) {
  const { cte, trip } = detail;
  const title = findTitle(detail, 'CLIENT_FREIGHT');
  const cents = cte?.clientFreightCents ?? trip.quotedClientFreightCents;

  let detailText: ReactNode;
  if (cte) {
    if (title?.status === 'CANCELLED') detailText = 'Valor do CT-e · título cancelado';
    else if (title?.dueDate) detailText = `Valor do CT-e · vence em ${formatDate(title.dueDate)}`;
    else detailText = 'Valor do CT-e';
  } else if (cents !== null) {
    detailText = 'Frete cotado · o CT-e ainda não foi registrado';
  } else {
    detailText = 'Sem frete cotado · o valor vem do CT-e';
  }

  return (
    <KpiCard
      accent="green"
      label="Frete do cliente"
      icon={<IconCoins size={12} stroke={1.8} />}
      value={<Money cents={cents} />}
      detail={detailText}
    />
  );
}

function DriverFreightCard({ detail }: { detail: TripDetail }) {
  const { agreement } = detail;
  const advance = findTitle(detail, 'ADVANCE');
  const balance = findTitle(detail, 'BALANCE');

  return (
    <KpiCard
      label="Frete do motorista"
      icon={<IconTruckDelivery size={12} stroke={1.8} />}
      value={<Money cents={agreement.driverFreightCents} />}
      detail={
        <div className={classes.valueRows}>
          <DriverPartRow label={`Adiantamento (${agreement.advancePercent}%)`} title={advance} />
          <DriverPartRow label="Saldo" title={balance} />
          {advance || balance ? null : (
            <span>Os valores saem quando os títulos forem gerados.</span>
          )}
        </div>
      }
    />
  );
}

function MarginCard({ detail }: { detail: TripDetail }) {
  const { margin } = detail;
  const projected = margin?.kind === 'PROJECTED';

  return (
    <KpiCard
      tone={margin?.isNegative ? 'red' : 'neutral'}
      accent={margin?.isNegative ? 'red' : 'green'}
      label={projected ? 'Margem prevista' : 'Margem'}
      icon={<IconPercentage size={12} stroke={1.8} />}
      value={<Money cents={margin ? margin.amountCents : null} />}
      detail={
        margin ? (
          <div className={classes.valueRows}>
            <ValueRow label={<span>Sobre o frete do cliente</span>}>
              <Text span inherit c={margin.isNegative ? 'red.7' : undefined}>
                {formatPercent(margin.percent)}
              </Text>
            </ValueRow>
            <div>
              <Pill color={projected ? 'yellow' : 'teal'} size="xs">
                {projected ? 'Prevista' : MARGIN_KIND_LABEL[margin.kind]}
              </Pill>{' '}
              {projected ? 'Com base no frete cotado.' : 'Com base nos títulos da viagem.'}
            </div>
          </div>
        ) : (
          'Informe o frete cotado ou registre o CT-e para ver a margem.'
        )
      }
    />
  );
}

/** Três cards lado a lado: frete do cliente, frete do motorista (adiantamento e saldo) e margem. */
export function ValueCards({ detail }: { detail: TripDetail }) {
  return (
    <div className={classes.values}>
      <ClientFreightCard detail={detail} />
      <DriverFreightCard detail={detail} />
      <MarginCard detail={detail} />
    </div>
  );
}
