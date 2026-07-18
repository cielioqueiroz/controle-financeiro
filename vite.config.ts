/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Uma única instância de React em runtime. Sem isso, o pré-bundling do
  // Vite pode servir uma cópia diferente para libs como o sonner,
  // causando "Invalid hook call" (React.useState null).
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'sonner'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
