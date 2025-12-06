import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider, NetworkProvider, PlatformProvider } from './contexts';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PlatformProvider>
        <NetworkProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </NetworkProvider>
      </PlatformProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
