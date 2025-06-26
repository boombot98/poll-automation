import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index1.css'
import './guest.css'
import App from './App2.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
