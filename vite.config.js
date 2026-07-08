import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    open: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('framer-motion')) return 'motion';
          if (id.includes('@supabase')) return 'supabase';
          if (
            id.includes('react-dom') ||
            id.includes('react-router') ||
            /node_modules[/\\]react[/\\]/.test(id)
          ) {
            return 'react-vendor';
          }
          return undefined;
        }
      }
    }
  }
});
