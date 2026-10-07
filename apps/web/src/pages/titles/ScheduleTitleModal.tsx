import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { IconAlertTriangle } from '@tabler/icons-react';
import { getErrorMessage } from '../../api/errors';
import { useScheduleTitle } from '../../api/hooks';
import { DateField, Money } from '../../components';
import { todayLocalDate } from '../../lib/format';
import { describeTitle, type TitleTarget } from './title-target';

interface ScheduleTitleModalProps {
  /** Título a programar. */
  target: TitleTarget | null;
  opened: boolean;
  onClose: () => void;
}

function ScheduleTitleForm({ target, onClose }: { target: TitleTarget; onClose: () => void }) {
  const schedule = useScheduleTitle();
  const [date, setDate] = useState<string | null>(todayLocalDate());
  const [missingDate, setMissingDate] = useState(false);

  function submit() {
    if (!date) {
      setMissingDate(true);
      return;
    }
    schedule.mutate({ titleId: target.id, input: { date } }, { onSuccess: onClose });
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
          {describeTitle(target)} · <Money cents={target.amountCents} fw={600} />
        </Text>
        <DateField
          label="Programar o pagamento para"
          description="O pagamento fica agendado para esta data."
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

/** Modal "Programar pagamento" de um título; a recusa do backend fica visível no modal. */
export function ScheduleTitleModal({ target, opened, onClose }: ScheduleTitleModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Programar pagamento" size="sm">
      {target ? <ScheduleTitleForm target={target} onClose={onClose} /> : null}
    </Modal>
  );
}
