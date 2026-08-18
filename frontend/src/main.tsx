import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { IdiomaProvider } from './i18n/IdiomaProvider'
import { DiscretoProvider } from './dados/DiscretoProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IdiomaProvider>
      <DiscretoProvider>
        <App />
      </DiscretoProvider>
    </IdiomaProvider>
  </StrictMode>,
)
