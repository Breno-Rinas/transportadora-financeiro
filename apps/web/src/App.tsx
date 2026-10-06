import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';
import { queryClient } from './api/query-client';
import { AppRoutes } from './routes';
import { theme } from './theme';

export function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <DatesProvider settings={{ locale: 'pt-br', firstDayOfWeek: 0 }}>
        <QueryClientProvider client={queryClient}>
          <ModalsProvider>
            <Notifications position="top-right" />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </ModalsProvider>
        </QueryClientProvider>
      </DatesProvider>
    </MantineProvider>
  );
}
