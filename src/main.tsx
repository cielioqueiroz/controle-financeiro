import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { IdiomaProvider } from './i18n/IdiomaProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IdiomaProvider>
      <App />
    </IdiomaProvider>
  </StrictMode>,
)
