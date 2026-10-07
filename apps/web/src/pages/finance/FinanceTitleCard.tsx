import { Checkbox } from '@mantine/core';
import { IconCalendarEvent, IconCash, IconEye, IconLock } from '@tabler/icons-react';
import { Link } from 'react-router';
import type { TitleListItem } from '../../api/types';
import {
  CardActions,
  CardButton,
  CardPrimaryButton,
  EntityCard,
  MetaLine,
  Money,
  NoteBox,
  TitleStatusBadge,
  type CardAccent,
  type NoteVariant,
} from '../../components';
import { formatDate, formatTripCode } from '../../lib/format';
import { TITLE_COUNTERPARTY, TITLE_KIND_LABEL } from '../../lib/labels';
import { paths } from '../../lib/routes';
import type { TitleTarget } from '../titles/title-target';

function accentFor(item: TitleListItem): CardAccent {
  if (item.bucket === 'OVERDUE') return 'red';
  return item.locks.reasons.length > 0 ? 'orange' : 'indigo';
}

interface NoteContent {
  variant: NoteVariant;
  text: string;
  locked: boolean;
}

/** O motivo da trava (vindo da API) ou, sem trava, o status do título. */
function noteFor(item: TitleListItem): NoteContent {
  if (item.locks.reasons.length > 0) {
    return {
      // Se ainda dá para programar (só falta o adiantamento), a trava é de baixa: âmbar.
      variant: item.locks.canSchedule ? 'warning' : 'danger',
      text: item.locks.reasons.map((reason) => reason.message).join(' · '),
      locked: true,
    };
  }
  if (item.status === 'SCHEDULED') {
    return {
      variant: 'success',
      text: `Programado para ${formatDate(item.scheduledFor)}`,
      locked: false,
    };
  }
  return {
    variant: 'info',
    text:
      item.nature === 'PAYABLE'
        ? 'Em aberto, aguardando programação'
        : 'Em aberto, aguardando recebimento',
    locked: false,
  };
}

interface FinanceTitleCardProps {
  item: TitleListItem;
  /** Mostra o checkbox (só títulos a pagar são programados em lote). */
  selectable: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
  onSchedule: (target: TitleTarget) => void;
  onSettle: (target: TitleTarget) => void;
}

/** Card de título do quadro: nome, viagem, espécie, valor, motivo da trava ou status e as ações. */
export function FinanceTitleCard({
  item,
  selectable,
  selected,
  onToggle,
  onSchedule,
  onSettle,
}: FinanceTitleCardProps) {
  const { trip } = item;
  const name =
    TITLE_COUNTERPARTY[item.kind] === 'CLIENT' ? trip.client.legalName : trip.driver.name;
  const code = formatTripCode(trip.code);
  const note = noteFor(item);
  const target: TitleTarget = {
    id: item.id,
    nature: item.nature,
    kind: item.kind,
    amountCents: item.amountCents,
    tripCode: trip.code,
  };

  return (
    <EntityCard
      accent={accentFor(item)}
      selected={selected}
      title={name}
      badge={<TitleStatusBadge status={item.status} nature={item.nature} />}
      code={
        <>
          <Link to={paths.trip(trip.id)} style={{ color: 'inherit' }}>
            {code}
          </Link>{' '}
          · {TITLE_KIND_LABEL[item.kind]}
        </>
      }
      leading={
        selectable ? (
          <Checkbox
            size="xs"
            checked={selected}
            onChange={() => onToggle(item.id)}
            aria-label={`Selecionar ${TITLE_KIND_LABEL[item.kind]} de ${name} (${code})`}
          />
        ) : undefined
      }
      actions={
        <CardActions>
          {item.nature === 'PAYABLE' ? (
            <CardButton
              tone="yellow"
              icon={<IconCalendarEvent size={13} stroke={1.5} />}
              onClick={() => onSchedule(target)}
            >
              Programar
            </CardButton>
          ) : null}
          <CardButton
            tone="indigo"
            icon={<IconEye size={13} stroke={1.5} />}
            to={paths.trip(trip.id)}
          >
            Detalhes
          </CardButton>
        </CardActions>
      }
      primaryAction={
        <CardPrimaryButton
          icon={<IconCash size={14} stroke={1.5} />}
          onClick={() => onSettle(target)}
        >
          Dar baixa
        </CardPrimaryButton>
      }
    >
      <MetaLine
        icon={<IconCalendarEvent size={12} stroke={1.5} />}
        left={item.effectiveDate ? formatDate(item.effectiveDate) : 'Sem data'}
        right={<Money cents={item.amountCents} />}
      />
      <NoteBox
        variant={note.variant}
        lines={3}
        icon={note.locked ? <IconLock size={12} stroke={1.6} /> : undefined}
      >
        {note.text}
      </NoteBox>
    </EntityCard>
  );
}
