import { ActionIcon, AppShell, Avatar, Indicator, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBell,
  IconId,
  IconLayoutDashboard,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconReceipt2,
  IconTruckDelivery,
  IconUsers,
  type Icon,
} from '@tabler/icons-react';
import { Link, NavLink, Outlet } from 'react-router';
import { useDashboard } from '../api/hooks';
import { financePath, paths } from '../lib/routes';
import classes from './AppLayout.module.css';

interface NavItem {
  label: string;
  to: string;
  icon: Icon;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Financeiro',
    items: [
      { label: 'Painel', to: paths.dashboard, icon: IconLayoutDashboard },
      { label: 'Contas a pagar e receber', to: paths.finance, icon: IconReceipt2 },
    ],
  },
  {
    label: 'Operacional',
    items: [{ label: 'Viagens', to: paths.trips, icon: IconTruckDelivery }],
  },
  {
    label: 'Cadastros',
    items: [
      { label: 'Clientes', to: paths.clients, icon: IconUsers },
      { label: 'Motoristas', to: paths.drivers, icon: IconId },
    ],
  },
];

/** Sino da topbar: o badge soma os pagamentos vencidos e os que vencem hoje (vem do painel). */
function NotificationsBell() {
  const { data } = useDashboard();
  const count = data ? data.payableOverdue.count + data.payableDueToday.count : 0;
  const label =
    count > 0
      ? `${count} ${count === 1 ? 'pagamento vencido ou vencendo hoje' : 'pagamentos vencidos ou vencendo hoje'}`
      : 'Nenhum pagamento vencido ou vencendo hoje';

  return (
    <Tooltip label={label} position="bottom" withArrow>
      <Indicator
        label={count > 99 ? '99+' : count}
        disabled={count === 0}
        color="red"
        size={16}
        offset={4}
        styles={{ indicator: { fontSize: 10, fontWeight: 600, padding: '0 4px' } }}
      >
        <ActionIcon
          component={Link}
          to={financePath({ nature: 'PAYABLE' })}
          variant="subtle"
          color="gray"
          size={32}
          aria-label={label}
        >
          <IconBell size={18} stroke={1.5} />
        </ActionIcon>
      </Indicator>
    </Tooltip>
  );
}

export function AppLayout() {
  const [mobileOpened, mobile] = useDisclosure();
  const [desktopOpened, desktop] = useDisclosure(true);

  function toggleNavbar() {
    mobile.toggle();
    desktop.toggle();
  }

  return (
    <AppShell
      layout="alt"
      padding={24}
      header={{ height: 52 }}
      navbar={{
        width: 215,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
      }}
      withBorder={false}
    >
      <AppShell.Header className={classes.header}>
        <div className={classes.headerInner}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size={32}
            onClick={toggleNavbar}
            aria-label="Recolher ou expandir o menu lateral"
          >
            {desktopOpened ? (
              <IconLayoutSidebarLeftCollapse size={18} stroke={1.5} />
            ) : (
              <IconLayoutSidebarLeftExpand size={18} stroke={1.5} />
            )}
          </ActionIcon>
          <div className={classes.headerActions}>
            <NotificationsBell />
            <Avatar size={28} radius="xl" color="gray" aria-label="Usuário">
              A
            </Avatar>
          </div>
        </div>
      </AppShell.Header>

      <AppShell.Navbar className={classes.navbar}>
        <div className={classes.brand}>
          <span className={classes.brandMark}>F</span>
          <span className={classes.brandName}>FretouBR</span>
        </div>
        <nav className={`${classes.nav} fb-scroll`} aria-label="Menu principal">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <div className={classes.section}>{section.label}</div>
              {section.items.map(({ label, to, icon: ItemIcon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === paths.dashboard}
                  className={({ isActive }) =>
                    isActive ? `${classes.link} ${classes.linkActive}` : classes.link
                  }
                  onClick={mobile.close}
                >
                  <ItemIcon size={17} stroke={1.5} className={classes.linkIcon} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </AppShell.Navbar>

      <AppShell.Main className={classes.main}>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
