import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import App from './App.js';
import { queryClient } from './lib/queryClient.js';
import { initTheme } from './lib/theme.js';
import './index.css';

initTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster position="bottom-right" closeButton richColors theme="system" />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
