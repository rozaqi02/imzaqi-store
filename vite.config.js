import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('react') ||
              id.includes('framer-motion') ||
              id.includes('lucide-react') ||
              id.includes('@supabase')
            ) {
              return 'vendor';
            }
          }
        }
      }
    }
  }
});
