import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PWAUpdateBanner } from '@/components/PWAUpdateBanner'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PWAUpdateBanner />
    <App />
  </StrictMode>,
)
