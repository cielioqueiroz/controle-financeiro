import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // O .env fica na RAIZ do monorepo, não aqui. Sem isto o Vite procuraria
  // `frontend/.env.local`, não acharia, e as VITE_* virariam undefined —
  // em silêncio: `neonConfigurado` daria false e o app cairia no modo
  // "importa e vê", sem login e sem erro de build para denunciar.
  // Um arquivo só na raiz também é o que deixa o backend (Fatia 1b)
  // compartilhar a DATABASE_URL com este lado.
  envDir: '..',
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
    setupFiles: ['./src/test-setup.ts'],
    // Limitar jsdoms simultâneos reduz disputa de CPU: a suíte completa
    // estourava 15s num teste que isolado executava em 0,8s (16/10/2026).
    maxWorkers: 2,
    testTimeout: 15000,
  },
})
