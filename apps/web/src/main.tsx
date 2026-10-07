import '@fontsource-variable/inter';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import 'dayjs/locale/pt-br';
import './styles/global.css';
import dayjs from 'dayjs';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

dayjs.locale('pt-br');

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root não encontrado');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
