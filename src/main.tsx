import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register high-performance offline PWA service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js')
      .then(reg => {
        console.log('Slate PWA Service Worker registered successfully on scope:', reg.scope);
      })
      .catch(err => {
        console.error('Slate PWA Service Worker registration failed:', err);
      });
  });
}
