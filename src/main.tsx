// First, and for its side effects only: axios is told to send the session cookie
// and to stamp every write with this application's own header. Without the first
// the browser never sends the cookie at all and nobody is ever authenticated by
// it; without the second the API refuses every write that arrives with one. See
// api/http.ts.
import './api/http'

import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import 'maplibre-gl/dist/maplibre-gl.css'
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
