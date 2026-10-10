void caches.delete('oshodi-coop-api').catch(()=>{})
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => registration.unregister())
  })
}

if ('caches' in window) {
  caches.keys().then(keys => {
    keys.forEach(key => caches.delete(key))
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
