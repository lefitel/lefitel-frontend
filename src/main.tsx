import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import 'leaflet/dist/leaflet.css'
import App from './App.tsx'

if (import.meta.env.DEV) {
  console.log(`--> Entorno: DEVELOPMENT <--`);
  console.log(`--> API: ${import.meta.env.VITE_DEV_API_URL} <--`);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
