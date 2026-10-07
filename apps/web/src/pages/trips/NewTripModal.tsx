import {
  Alert,
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconInfoCircle } from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router';
import { getFieldErrors } from '../../api/errors';
import { useClients, useCreateTrip, useDrivers } from '../../api/hooks';
import type { AdvancePercent, CreateTripInput } from '../../api/types';
import { MoneyInput } from '../../components';
import { maskPlate, parseBRL } from '../../lib/format';
import { ADVANCE_PERCENT_OPTIONS } from '../../lib/labels';
import { paths } from '../../lib/routes';

interface NewTripFormValues {
  clientId: string | null;
  driverId: string | null;
  origin: string;
  destination: string;
  product: string;
  weightKg: number | string;
  /** Opcional: só projeta a margem e pré-preenche o CT-e. */
  quotedFreight: string;
  driverFreight: string;
  advancePercent: AdvancePercent;
}

const INITIAL_VALUES: NewTripFormValues = {
  clientId: null,
  driverId: null,
  origin: '',
  destination: '',
  product: '',
  weightKg: '',
  quotedFreight: '',
  driverFreight: '',
  advancePercent: 70,
};

/** Nomes dos campos do contrato da API -> nomes dos campos deste formulário. */
const FIELD_BY_API_PATH: Record<string, string> = {
  quotedClientFreightCents: 'quotedFreight',
  driverFreightCents: 'driverFreight',
};

function renameApiFields(errors: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(errors).map(([path, message]) => [FIELD_BY_API_PATH[path] ?? path, message]),
  );
}

function requiredText(message: string) {
  return (value: string) => (value.trim() ? null : message);
}

interface NewTripModalProps {
  opened: boolean;
  onClose: () => void;
}

/** Modal "Nova viagem". Ao criar, abre o detalhe da viagem (`/viagens/:id`). */
export function NewTripModal({ opened, onClose }: NewTripModalProps) {
  const navigate = useNavigate();
  const clients = useClients();
  const drivers = useDrivers();
  const createTrip = useCreateTrip();

  const form = useForm<NewTripFormValues>({
    mode: 'controlled',
    initialValues: INITIAL_VALUES,
    validate: {
      clientId: (value) => (value ? null : 'Selecione o cliente'),
      driverId: (value) => (value ? null : 'Selecione o motorista'),
      origin: requiredText('Informe a origem'),
      destination: requiredText('Informe o destino'),
      product: requiredText('Informe o produto'),
      weightKg: (value) => (typeof value === 'number' && value > 0 ? null : 'Informe o peso em kg'),
      driverFreight: (value) => {
        const cents = parseBRL(value);
        return cents !== null && cents > 0 ? null : 'Informe o frete do motorista';
      },
      quotedFreight: (value) => {
        if (!value.trim()) return null;
        const cents = parseBRL(value);
        return cents !== null && cents > 0 ? null : 'Valor inválido';
      },
    },
  });

  const clientOptions = (clients.data ?? []).map((client) => ({
    value: client.id,
    label: client.legalName,
  }));
  const driverOptions = (drivers.data ?? []).map((driver) => ({
    value: driver.id,
    label: `${driver.name} · ${maskPlate(driver.vehiclePlate)}`,
  }));
  const missingRegistrations =
    clients.isSuccess &&
    drivers.isSuccess &&
    (clients.data.length === 0 || drivers.data.length === 0);

  function handleClose() {
    form.reset();
    onClose();
  }

  function submit(values: NewTripFormValues) {
    const driverFreightCents = parseBRL(values.driverFreight);
    const quotedCents = values.quotedFreight.trim() ? parseBRL(values.quotedFreight) : null;
    if (!values.clientId || !values.driverId || driverFreightCents === null) return;

    const input: CreateTripInput = {
      clientId: values.clientId,
      driverId: values.driverId,
      origin: values.origin.trim(),
      destination: values.destination.trim(),
      product: values.product.trim(),
      weightKg: Number(values.weightKg),
      driverFreightCents,
      advancePercent: values.advancePercent,
      ...(quotedCents !== null ? { quotedClientFreightCents: quotedCents } : {}),
    };

    createTrip.mutate(input, {
      onSuccess: ({ trip }) => {
        handleClose();
        void navigate(paths.trip(trip.id));
      },
      onError: (error) => form.setErrors(renameApiFields(getFieldErrors(error))),
    });
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Nova viagem" size="lg">
      <form onSubmit={form.onSubmit(submit)} noValidate>
        <Stack gap="sm">
          {missingRegistrations ? (
            <Alert color="indigo" variant="light" icon={<IconInfoCircle size={16} />} p="xs">
              <Text size="xs">
                Antes de criar uma viagem, cadastre ao menos um{' '}
                <Link to={paths.clients}>cliente</Link> e um{' '}
                <Link to={paths.drivers}>motorista</Link>.
              </Text>
            </Alert>
          ) : null}

          <SimpleGrid cols={2} spacing="sm">
            <Select
              label="Cliente (tomador)"
              placeholder="Selecione"
              data={clientOptions}
              searchable
              nothingFoundMessage="Nenhum cliente encontrado"
              withAsterisk
              {...form.getInputProps('clientId')}
            />
            <Select
              label="Motorista"
              placeholder="Selecione"
              data={driverOptions}
              searchable
              nothingFoundMessage="Nenhum motorista encontrado"
              withAsterisk
              {...form.getInputProps('driverId')}
            />
            <TextInput
              label="Origem"
              placeholder="Cidade - UF"
              withAsterisk
              {...form.getInputProps('origin')}
            />
            <TextInput
              label="Destino"
              placeholder="Cidade - UF"
              withAsterisk
              {...form.getInputProps('destination')}
            />
            <TextInput label="Produto" withAsterisk {...form.getInputProps('product')} />
            <NumberInput
              label="Peso (kg)"
              min={1}
              allowDecimal={false}
              allowNegative={false}
              thousandSeparator="."
              decimalSeparator=","
              withAsterisk
              {...form.getInputProps('weightKg')}
            />
            <MoneyInput
              label="Frete cotado do cliente"
              description="Opcional: projeta a margem e preenche o CT-e."
              {...form.getInputProps('quotedFreight')}
            />
            <MoneyInput
              label="Frete do motorista"
              description="Total a pagar ao motorista."
              withAsterisk
              {...form.getInputProps('driverFreight')}
            />
          </SimpleGrid>

          <div>
            <Text size="sm" fw={500} mb={4}>
              Adiantamento ao motorista
            </Text>
            <SegmentedControl
              size="xs"
              data={ADVANCE_PERCENT_OPTIONS.map(({ value, label }) => ({
                value: String(value),
                label,
              }))}
              value={String(form.values.advancePercent)}
              onChange={(value) => form.setFieldValue('advancePercent', value === '50' ? 50 : 70)}
            />
            <Text size="xs" c="dimmed" mt={4}>
              O saldo é pago depois da descarga e da chegada do canhoto original do CT-e.
            </Text>
          </div>

          <Group justify="flex-end" mt="xs">
            <Button variant="default" size="sm" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" loading={createTrip.isPending}>
              Criar viagem
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
