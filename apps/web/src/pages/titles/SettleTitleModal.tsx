import { Alert, Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useState } from 'react';
import { getErrorMessage } from '../../api/errors';
import { useSettleTitle } from '../../api/hooks';
import { DateField, Money, MoneyInput } from '../../components';
import { formatBRLNumber, parseBRL, todayLocalDate } from '../../lib/format';
import { describeTitle, type TitleTarget } from './title-target';

interface SettleTitleModalProps {
  /** Título a baixar. */
  target: TitleTarget | null;
  opened: boolean;
  onClose: () => void;
}

function SettleTitleForm({ target, onClose }: { target: TitleTarget; onClose: () => void }) {
  const settle = useSettleTitle();
  const receivable = target.nature === 'RECEIVABLE';
  const [paidOn, setPaidOn] = useState<string | null>(todayLocalDate());
  const [amount, setAmount] = useState(formatBRLNumber(target.amountCents));
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ paidOn?: string; amount?: string }>({});

  function submit() {
    const amountCents = parseBRL(amount);
    const next = {
      paidOn: paidOn ? undefined : 'Informe a data',
      amount: amountCents === null || amountCents <= 0 ? 'Informe o valor' : undefined,
    };
    setErrors(next);
    if (!paidOn || amountCents === null || next.amount) return;

    settle.mutate(
      {
        titleId: target.id,
        input: { paidOn, amountCents, ...(note.trim() ? { note: note.trim() } : {}) },
      },
      { onSuccess: onClose },
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
          {describeTitle(target)} · <Money cents={target.amountCents} fw={600} />
        </Text>
        <DateField
          label={receivable ? 'Data do recebimento' : 'Data do pagamento'}
          value={paidOn}
          onChange={(value) => {
            setPaidOn(value);
            setErrors((previous) => ({ ...previous, paidOn: undefined }));
          }}
          error={errors.paidOn}
          data-autofocus
        />
        <MoneyInput
          label={receivable ? 'Valor recebido' : 'Valor pago'}
          description="A baixa é sempre integral: o valor é o do título."
          value={amount}
          onChange={(value) => {
            setAmount(value);
            setErrors((previous) => ({ ...previous, amount: undefined }));
          }}
          error={errors.amount}
        />
        <TextInput
          label="Observação"
          placeholder="Opcional"
          value={note}
          onChange={(event) => setNote(event.currentTarget.value)}
        />
        {settle.isError ? (
          <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />} p="xs">
            <Text size="xs">{getErrorMessage(settle.error)}</Text>
          </Alert>
        ) : null}
        <Group justify="flex-end" mt="xs">
          <Button variant="default" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" loading={settle.isPending}>
            {receivable ? 'Registrar recebimento' : 'Dar baixa'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/** Modal "Dar baixa": data = hoje e valor = valor do título, ambos editáveis. */
export function SettleTitleModal({ target, opened, onClose }: SettleTitleModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Dar baixa no título" size="sm">
      {target ? <SettleTitleForm target={target} onClose={onClose} /> : null}
    </Modal>
  );
}
