import { Button, Group, Modal, NumberInput, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { getFieldErrors } from '../../api/errors';
import { useCreateClient } from '../../api/hooks';
import { CnpjInput } from '../../components';

interface ClientFormValues {
  legalName: string;
  /** Sem máscara (CNPJ numérico ou alfanumérico). */
  cnpj: string;
  paymentTermDays: number | string;
}

const INITIAL_VALUES: ClientFormValues = { legalName: '', cnpj: '', paymentTermDays: 30 };
const CNPJ_LENGTH = 14;

interface ClientModalProps {
  opened: boolean;
  onClose: () => void;
}

export function ClientModal({ opened, onClose }: ClientModalProps) {
  const createClient = useCreateClient();

  const form = useForm<ClientFormValues>({
    mode: 'controlled',
    initialValues: INITIAL_VALUES,
    validate: {
      legalName: (value) => (value.trim() ? null : 'Informe a razão social'),
      cnpj: (value) => (value.length === CNPJ_LENGTH ? null : 'O CNPJ tem 14 caracteres'),
      paymentTermDays: (value) =>
        typeof value === 'number' && Number.isInteger(value) && value >= 0
          ? null
          : 'Informe o prazo em dias (0 ou mais)',
    },
  });

  function handleClose() {
    form.reset();
    onClose();
  }

  function submit(values: ClientFormValues) {
    createClient.mutate(
      {
        legalName: values.legalName.trim(),
        cnpj: values.cnpj,
        paymentTermDays: Number(values.paymentTermDays),
      },
      {
        onSuccess: handleClose,
        onError: (error) =>
          form.setErrors(
            getFieldErrors(error, { INVALID_DOCUMENT: 'cnpj', DOCUMENT_ALREADY_EXISTS: 'cnpj' }),
          ),
      },
    );
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Novo cliente" size="md">
      <form onSubmit={form.onSubmit(submit)} noValidate>
        <Stack gap="sm">
          <TextInput
            label="Razão social"
            placeholder="Nome do tomador do frete"
            withAsterisk
            data-autofocus
            {...form.getInputProps('legalName')}
          />
          <CnpjInput label="CNPJ" withAsterisk {...form.getInputProps('cnpj')} />
          <NumberInput
            label="Prazo de pagamento (dias)"
            description="Dias entre a emissão do CT-e e o vencimento do frete a receber."
            min={0}
            allowDecimal={false}
            allowNegative={false}
            withAsterisk
            {...form.getInputProps('paymentTermDays')}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" size="sm" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" loading={createClient.isPending}>
              Cadastrar cliente
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
