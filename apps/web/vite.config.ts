import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Em dev, a API roda em :3333 e o Vite faz o proxy. Em produção, o nginx faz o mesmo.
const API_TARGET = 'http://127.0.0.1:3333';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': API_TARGET,
      '/uploads': API_TARGET,
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
