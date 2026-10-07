import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { IconAlertTriangle, IconCircleCheck } from '@tabler/icons-react';
import { useState } from 'react';
import { getErrorMessage } from '../../api/errors';
import { useScheduleTitles } from '../../api/hooks';
import type { ScheduleResult, TitleListItem } from '../../api/types';
import { DateField, Money } from '../../components';
import { formatDate, formatTripCode, todayLocalDate } from '../../lib/format';
import { TITLE_COUNTERPARTY, TITLE_KIND_LABEL } from '../../lib/labels';

interface ScheduleBatchModalProps {
  /** Títulos selecionados. */
  titles: readonly TitleListItem[];
  opened: boolean;
  onClose: () => void;
  /** Chamado com o que foi programado, para a tela desmarcar esses títulos. */
  onScheduled: (titleIds: string[]) => void;
}

function describe(item: TitleListItem): string {
  const { trip } = item;
  const name =
    TITLE_COUNTERPARTY[item.kind] === 'CLIENT' ? trip.client.legalName : trip.driver.name;
  return `${name} · ${formatTripCode(trip.code)} · ${TITLE_KIND_LABEL[item.kind]}`;
}

function ResultView({
  result,
  date,
  lookup,
  onClose,
}: {
  result: ScheduleResult;
  date: string;
  lookup: ReadonlyMap<string, TitleListItem>;
  onClose: () => void;
}) {
  return (
    <Stack gap="sm">
      {result.scheduled.length > 0 ? (
        <Alert color="green" variant="light" icon={<IconCircleCheck size={16} />} p="xs">
          <Text size="xs" fw={600}>
            {result.scheduled.length === 1
              ? '1 título programado'
              : `${result.scheduled.length} títulos programados`}{' '}
            para {formatDate(date)}
          </Text>
          <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: 12 }}>
            {result.scheduled.map((title) => {
              const item = lookup.get(title.id);
              return (
                <li key={title.id}>
                  {item ? describe(item) : title.id} · <Money cents={title.amountCents} />
                </li>
              );
            })}
          </ul>
        </Alert>
      ) : null}

      {result.rejected.length > 0 ? (
        <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />} p="xs">
          <Text size="xs" fw={600}>
            {result.rejected.length === 1
              ? '1 título recusado'
              : `${result.rejected.length} títulos recusados`}
          </Text>
          <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: 12 }}>
            {result.rejected.map((rejection) => {
              const item = lookup.get(rejection.titleId);
              return (
                <li key={rejection.titleId}>
                  <strong>{item ? describe(item) : rejection.titleId}</strong>: {rejection.message}
                </li>
              );
            })}
          </ul>
        </Alert>
      ) : null}

      <Group justify="flex-end" mt="xs">
        <Button size="sm" onClick={onClose}>
          Fechar
        </Button>
      </Group>
    </Stack>
  );
}

function ScheduleBatchForm({
  titles,
  onClose,
  onScheduled,
}: Omit<ScheduleBatchModalProps, 'opened'>) {
  const schedule = useScheduleTitles();
  // Guarda os títulos de quando o modal abriu: o resultado nomeia cada um mesmo que a lista mude.
  const [snapshot] = useState(() => new Map(titles.map((item) => [item.id, item])));
  const [date, setDate] = useState<string | null>(todayLocalDate());
  const [missingDate, setMissingDate] = useState(false);
  const [done, setDone] = useState<{ result: ScheduleResult; date: string } | null>(null);

  if (done) {
    return <ResultView result={done.result} date={done.date} lookup={snapshot} onClose={onClose} />;
  }

  function submit() {
    if (!date) {
      setMissingDate(true);
      return;
    }
    schedule.mutate(
      { titleIds: [...snapshot.keys()], date },
      {
        onSuccess: (result) => {
          setDone({ result, date });
          onScheduled(result.scheduled.map((title) => title.id));
        },
      },
    );
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Stack gap="sm">
        <Text size="sm">
          {snapshot.size === 1 ? '1 título selecionado.' : `${snapshot.size} títulos selecionados.`}{' '}
          Os que não puderem ser programados são recusados, com o motivo.
        </Text>
        <DateField
          label="Programar os pagamentos para"
          value={date}
          onChange={(value) => {
            setDate(value);
            setMissingDate(false);
          }}
          error={missingDate ? 'Escolha a data da programação' : undefined}
          data-autofocus
        />
        {schedule.isError ? (
          <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />} p="xs">
            <Text size="xs">{getErrorMessage(schedule.error)}</Text>
          </Alert>
        ) : null}
        <Group justify="flex-end" mt="xs">
          <Button variant="default" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" loading={schedule.isPending}>
            Programar
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/** Modal de data da programação em lote; depois do envio, lista o que passou e o que foi recusado. */
export function ScheduleBatchModal({
  titles,
  opened,
  onClose,
  onScheduled,
}: ScheduleBatchModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Programar selecionados" size="md">
      <ScheduleBatchForm titles={titles} onClose={onClose} onScheduled={onScheduled} />
    </Modal>
  );
}
