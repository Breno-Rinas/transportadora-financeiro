import { Route, Routes } from 'react-router';
import { AppLayout } from './layout/AppLayout';
import { ClientsPage } from './pages/ClientsPage';
import { DashboardPage } from './pages/DashboardPage';
import { DriversPage } from './pages/DriversPage';
import { FinancePage } from './pages/FinancePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { TripDetailPage } from './pages/TripDetailPage';
import { TripsPage } from './pages/TripsPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="viagens" element={<TripsPage />} />
        <Route path="viagens/:id" element={<TripDetailPage />} />
        <Route path="financeiro" element={<FinancePage />} />
        <Route path="clientes" element={<ClientsPage />} />
        <Route path="motoristas" element={<DriversPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
