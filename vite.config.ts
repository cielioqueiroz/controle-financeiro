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
    // Os testes que sobem o <App/> inteiro e dirigem a tela com userEvent
    // levam ~2s isolados, mas passam de 5s quando os 27 arquivos disputam
    // CPU em paralelo — o padrão do Vitest os derrubava de forma
    // intermitente (4 falhas, depois 1, depois nenhuma, sem mudar código).
    // O limite continua existindo para pegar travamento de verdade.
    testTimeout: 15000,
  },
})
