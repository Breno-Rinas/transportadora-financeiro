import { AppShell, Burger, Group, NavLink, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconLayoutDashboard,
  IconReceipt2,
  IconTruckDelivery,
  IconUsers,
  type Icon,
} from '@tabler/icons-react';
import { Link, Outlet, useLocation } from 'react-router';

interface NavItem {
  label: string;
  to: string;
  icon: Icon;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Painel', to: '/', icon: IconLayoutDashboard },
  { label: 'Viagens', to: '/viagens', icon: IconTruckDelivery },
  { label: 'Financeiro', to: '/financeiro', icon: IconReceipt2 },
  { label: 'Cadastros', to: '/cadastros', icon: IconUsers },
];

function isActive(pathname: string, to: string): boolean {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);
}

export function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure();
  const { pathname } = useLocation();

  return (
    <AppShell
      header={{ height: 52 }}
      navbar={{ width: 200, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" gap="sm">
          <Burger
            opened={opened}
            onClick={toggle}
            hiddenFrom="sm"
            size="sm"
            aria-label="Abrir menu"
          />
          <IconTruckDelivery size={22} />
          <Text fw={700}>Financeiro · Transportadora</Text>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        {NAV_ITEMS.map(({ label, to, icon: ItemIcon }) => (
          <NavLink
            key={to}
            component={Link}
            to={to}
            label={label}
            leftSection={<ItemIcon size={18} />}
            active={isActive(pathname, to)}
            onClick={close}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
