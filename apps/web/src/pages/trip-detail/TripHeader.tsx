import { IconBan } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import type { TripDetail } from '../../api/types';
import { CardFooterLink, RouteLine, TripStatusBadge } from '../../components';
import {
  formatDateTime,
  formatTripCode,
  formatWeightKg,
  maskCnpj,
  maskCpfCnpj,
  maskPlate,
} from '../../lib/format';
import classes from './TripDetail.module.css';

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={classes.fact}>
      <span className={classes.factLabel}>{label}</span>
      {children}
    </div>
  );
}

interface TripHeaderProps {
  detail: TripDetail;
  /** Abre o modal de cancelamento. */
  onCancel: () => void;
}

/** Cabeçalho: código + cliente, status, motorista (documento e placa mascarados) e a rota. */
export function TripHeader({ detail, onCancel }: TripHeaderProps) {
  const { trip, client, driver } = detail;
  const cancelled = trip.status === 'CANCELLED';
  // Cancelar não faz sentido numa viagem já cancelada ou finalizada (o backend também recusa).
  const canCancel = !cancelled && trip.status !== 'BALANCE_PAID';

  return (
    <section
      className={`${classes.header} ${cancelled ? classes.headerCancelled : ''}`}
      aria-label="Dados da viagem"
    >
      <div className={classes.headerTop}>
        <div className={classes.headerTitle}>
          <h1 className={classes.heading}>
            <span className={classes.headingCode}>{formatTripCode(trip.code)}</span> ·{' '}
            {client.legalName}
          </h1>
          <TripStatusBadge status={trip.status} />
        </div>
        {canCancel ? (
          <CardFooterLink tone="red" icon={<IconBan size={13} stroke={1.6} />} onClick={onCancel}>
            Cancelar viagem
          </CardFooterLink>
        ) : null}
      </div>

      <div className={classes.facts}>
        <Fact label="Motorista">
          <span className={classes.factStrong}>{driver.name}</span>
          <span className={classes.factMuted}>
            {driver.document.length === 11 ? 'CPF' : 'CNPJ'} {maskCpfCnpj(driver.document)} · Placa{' '}
            {maskPlate(driver.vehiclePlate)}
          </span>
        </Fact>
        <Fact label="Rota">
          <RouteLine origin={trip.origin} destination={trip.destination} />
        </Fact>
        <Fact label="Carga">
          <span className={classes.factStrong}>{trip.product}</span>
          <span className={classes.factMuted}>{formatWeightKg(trip.weightKg)}</span>
        </Fact>
        <Fact label="Cliente (tomador)">
          <span className={classes.factStrong}>{client.legalName}</span>
          <span className={classes.factMuted}>CNPJ {maskCnpj(client.cnpj)}</span>
        </Fact>
        <Fact label="Criada em">
          <span className={classes.factStrong}>{formatDateTime(trip.createdAt)}</span>
        </Fact>
      </div>
    </section>
  );
}
