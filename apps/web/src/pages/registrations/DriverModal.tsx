import { Button, Group, Modal, SimpleGrid, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { ApiError } from '../../api/client';
import { getFieldErrors } from '../../api/errors';
import { useCreateDriver } from '../../api/hooks';
import { CpfCnpjInput, PlateInput } from '../../components';
import { normalizePlate } from '../../lib/format';

interface DriverFormValues {
  name: string;
  /** CPF ou CNPJ, sem máscara. */
  document: string;
  /** Sem máscara, maiúscula. */
  vehiclePlate: string;
  pixKey: string;
}

const INITIAL_VALUES: DriverFormValues = { name: '', document: '', vehiclePlate: '', pixKey: '' };
const CPF_LENGTH = 11;
const CNPJ_LENGTH = 14;
const PLATE_LENGTH = 7;

/**
 * `INVALID_DOCUMENT` serve para documento e placa: o `details.value` devolvido pela API diz qual
 * campo falhou (com a mensagem como reserva).
 */
function driverFieldErrors(error: unknown, values: DriverFormValues): Record<string, string> {
  if (error instanceof ApiError && error.code === 'INVALID_DOCUMENT') {
    const details = error.details;
    const invalidValue =
      typeof details === 'object' && details !== null && 'value' in details
        ? String(details.value)
        : '';
    const isPlate =
      (invalidValue && normalizePlate(invalidValue) === values.vehiclePlate) ||
      /placa/i.test(error.message);
    return { [isPlate ? 'vehiclePlate' : 'document']: error.message };
  }
  return getFieldErrors(error, { DOCUMENT_ALREADY_EXISTS: 'document' });
}

interface DriverModalProps {
  opened: boolean;
  onClose: () => void;
}

export function DriverModal({ opened, onClose }: DriverModalProps) {
  const createDriver = useCreateDriver();

  const form = useForm<DriverFormValues>({
    mode: 'controlled',
    initialValues: INITIAL_VALUES,
    validate: {
      name: (value) => (value.trim() ? null : 'Informe o nome do motorista'),
      document: (value) =>
        value.length === CPF_LENGTH || value.length === CNPJ_LENGTH
          ? null
          : 'Informe um CPF (11 dígitos) ou CNPJ (14 caracteres)',
      vehiclePlate: (value) =>
        value.length === PLATE_LENGTH ? null : 'A placa tem 7 caracteres (ABC-1D23)',
      pixKey: (value) => (value.trim() ? null : 'Informe a chave PIX'),
    },
  });

  function handleClose() {
    form.reset();
    onClose();
  }

  function submit(values: DriverFormValues) {
    createDriver.mutate(
      {
        name: values.name.trim(),
        document: values.document,
        vehiclePlate: values.vehiclePlate,
        pixKey: values.pixKey.trim(),
      },
      {
        onSuccess: handleClose,
        onError: (error) => form.setErrors(driverFieldErrors(error, values)),
      },
    );
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Novo motorista" size="md">
      <form onSubmit={form.onSubmit(submit)} noValidate>
        <Stack gap="sm">
          <TextInput
            label="Nome"
            placeholder="Nome completo ou razão social"
            withAsterisk
            data-autofocus
            {...form.getInputProps('name')}
          />
          <SimpleGrid cols={2} spacing="sm">
            <CpfCnpjInput label="CPF ou CNPJ" withAsterisk {...form.getInputProps('document')} />
            <PlateInput
              label="Placa do veículo"
              withAsterisk
              {...form.getInputProps('vehiclePlate')}
            />
          </SimpleGrid>
          <TextInput
            label="Chave PIX"
            placeholder="CPF, e-mail, telefone ou chave aleatória"
            withAsterisk
            {...form.getInputProps('pixKey')}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" size="sm" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" loading={createDriver.isPending}>
              Cadastrar motorista
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
