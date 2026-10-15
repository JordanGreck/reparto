import { defineConfig } from 'vite';
export default defineConfig({ base: './', build: { chunkSizeWarningLimit: 1400 }, server: { host: '127.0.0.1' } });
