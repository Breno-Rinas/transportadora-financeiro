import { Alert, Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useState } from 'react';
import { getErrorMessage, getFieldErrors } from '../../api/errors';
import { useCancelTrip } from '../../api/hooks';
import { formatTripCode } from '../../lib/format';

interface CancelTripModalProps {
  tripId: string;
  tripCode: number;
  opened: boolean;
  onClose: () => void;
}

function CancelTripForm({ tripId, tripCode, onClose }: Omit<CancelTripModalProps, 'opened'>) {
  const cancel = useCancelTrip();
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();

  function submit() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setReasonError('Informe o motivo do cancelamento');
      return;
    }
    cancel.mutate(
      { tripId, input: { reason: trimmed } },
      {
        onSuccess: onClose,
        onError: (error) => setReasonError(getFieldErrors(error).reason),
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
          Cancelar a viagem <strong>{formatTripCode(tripCode)}</strong>? Os títulos em aberto são
          cancelados e os já pagos continuam como histórico. Se o adiantamento já foi pago, nasce um
          título a receber do motorista para recuperá-lo.
        </Text>
        <Textarea
          label="Motivo do cancelamento"
          placeholder="Ex.: carga cancelada pelo cliente"
          autosize
          minRows={3}
          maxRows={6}
          maxLength={1000}
          withAsterisk
          value={reason}
          onChange={(event) => {
            setReason(event.currentTarget.value);
            setReasonError(undefined);
          }}
          error={reasonError}
          data-autofocus
        />
        {cancel.isError && !reasonError ? (
          <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />} p="xs">
            <Text size="xs">{getErrorMessage(cancel.error)}</Text>
          </Alert>
        ) : null}
        <Group justify="flex-end" mt="xs">
          <Button variant="default" size="sm" onClick={onClose}>
            Voltar
          </Button>
          <Button type="submit" size="sm" color="red" loading={cancel.isPending}>
            Cancelar viagem
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/** Modal de cancelamento da viagem (R13), com o motivo obrigatório. */
export function CancelTripModal({ tripId, tripCode, opened, onClose }: CancelTripModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Cancelar viagem" size="md">
      <CancelTripForm tripId={tripId} tripCode={tripCode} onClose={onClose} />
    </Modal>
  );
}
