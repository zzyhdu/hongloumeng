import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import checker from 'vite-plugin-checker';

export default defineConfig({
  plugins: [
    react(),
    checker({ typescript: true })
  ],
  base: './',
  server: {
    port: 4173,
    host: '0.0.0.0',
  },
  build: {
    outDir: 'dist',
  },
});
