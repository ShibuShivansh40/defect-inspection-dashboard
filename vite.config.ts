import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Set VITE_BASE=/sub-path/ to serve from a sub-directory.
  base: process.env.VITE_BASE ?? '/',
  // The Antd table (lazy DefectLog chunk) and MSW (the demo backend) are knowingly large.
  build: { chunkSizeWarningLimit: 650 },
});
