import React, { StrictMode, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/**
 * Ensure the root element exists before attempting to mount.
 * Provides a strong runtime guarantee and clearer diagnostics.
 */
const rootElement = document.getElementById('root');
if (!(rootElement instanceof HTMLElement)) {
  throw new Error('React root element "#root" was not found in the DOM.');
}

/**
 * Create the React root with future-safe configuration options.
 * Error hooks improve observability without impacting production stability.
 */
const root = ReactDOM.createRoot(rootElement, {
  onRecoverableError: (error, errorInfo) => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Recoverable React error:', error, errorInfo);
    }
  },
});

/**
 * Reusable fallback component for Suspense boundaries.
 * Keeps rendering resilient during lazy loading or async boundaries.
 */
const RootFallback = () => null;

/**
 * Render function wrapper to allow controlled re-rendering,
 * easier integration with HMR, and improved lifecycle isolation.
 */
function renderApp() {
  root.render(
    <StrictMode>
      <Suspense fallback={<RootFallback />}>
        <App />
      </Suspense>
    </StrictMode>
  );
}

renderApp();

/**
 * Enable Hot Module Replacement (development environments only).
 * Allows updating the App module without a full page reload.
 */
if (import.meta && import.meta.hot) {
  import.meta.hot.accept('./App', () => {
    renderApp();
  });
} else if (module && module.hot) {
  module.hot.accept('./App', () => {
    renderApp();
  });
}
