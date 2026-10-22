import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { StoreFxProvider } from './lib/storeFx'
import { StoreProvider } from './store.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <StoreProvider>
          <StoreFxProvider>
            <App />
          </StoreFxProvider>
        </StoreProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
