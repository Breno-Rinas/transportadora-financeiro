import { Route, Routes } from 'react-router';
import { AppLayout } from './layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { FinancePage } from './pages/FinancePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RegistrationsPage } from './pages/RegistrationsPage';
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
        <Route path="cadastros" element={<RegistrationsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
