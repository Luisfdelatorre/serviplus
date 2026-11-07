import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './shared/styles/tokens.css';
import './shared/styles/ui-primitives.css';
import './index.css';
import { AppProviders } from './app/AppProviders';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppProviders>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppProviders>
  </StrictMode>
);
