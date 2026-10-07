import { Button, Table } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconId, IconPlus } from '@tabler/icons-react';
import { useDrivers } from '../api/hooks';
import {
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  SearchInput,
  TableSkeleton,
} from '../components';
import { formatInstantDate, maskCpfCnpj, maskPlate } from '../lib/format';
import { useSearchQuery } from '../lib/use-search-query';
import { DriverModal } from './registrations/DriverModal';

export function DriversPage() {
  const { search, setSearch, query } = useSearchQuery();
  const [modalOpened, modal] = useDisclosure(false);
  const drivers = useDrivers(query);

  function renderContent() {
    if (drivers.isPending) return <TableSkeleton columns={5} />;
    if (drivers.isError) {
      return (
        <ErrorState
          title="Não foi possível carregar os motoristas"
          error={drivers.error}
          onRetry={() => void drivers.refetch()}
          retrying={drivers.isRefetching}
        />
      );
    }
    if (drivers.data.length === 0) {
      return query ? (
        <EmptyState
          icon={<IconId size={18} stroke={1.5} />}
          title="Nenhum motorista encontrado"
          description="Nenhum motorista combina com a busca. Confira o nome, o documento ou a placa."
          action={
            <Button size="xs" variant="default" onClick={() => setSearch('')}>
              Limpar busca
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={<IconId size={18} stroke={1.5} />}
          title="Nenhum motorista cadastrado"
          description="Cadastre o primeiro motorista para poder criar viagens. Clique em Novo motorista."
          action={
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={modal.open}>
              Novo motorista
            </Button>
          }
        />
      );
    }
    return (
      <DataTable>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nome</Table.Th>
            <Table.Th>CPF / CNPJ</Table.Th>
            <Table.Th>Placa</Table.Th>
            <Table.Th>Chave PIX</Table.Th>
            <Table.Th>Cadastrado em</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {drivers.data.map((driver) => (
            <Table.Tr key={driver.id}>
              <Table.Td fw={500}>{driver.name}</Table.Td>
              <Table.Td style={{ fontVariantNumeric: 'tabular-nums' }}>
                {maskCpfCnpj(driver.document)}
              </Table.Td>
              <Table.Td style={{ fontVariantNumeric: 'tabular-nums' }}>
                {maskPlate(driver.vehiclePlate)}
              </Table.Td>
              <Table.Td>{driver.pixKey}</Table.Td>
              <Table.Td c="dimmed">{formatInstantDate(driver.createdAt)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </DataTable>
    );
  }

  return (
    <>
      <PageHeader title="Motoristas">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Nome, documento ou placa…"
          aria-label="Buscar motoristas"
        />
        <Button size="sm" leftSection={<IconPlus size={14} />} onClick={modal.open}>
          Novo motorista
        </Button>
      </PageHeader>
      {renderContent()}
      <DriverModal opened={modalOpened} onClose={modal.close} />
    </>
  );
}
