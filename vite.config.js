import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true, include: ['tests/**/*.test.jsx'] },
  server: {
    port: 5173,
    allowedHosts: ['precut-afford-reapprove.ngrok-free.dev', 'localhost', '127.0.0.1']
  }
});
