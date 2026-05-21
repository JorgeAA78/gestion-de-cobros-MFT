import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useStore } from './store/useStore.ts'

function Root() {
  const syncFromServer = useStore((s) => s.syncFromServer);

  useEffect(() => {
    // Sincronización inicial al cargar
    syncFromServer();

    // Sincronizar periódicamente cada 30 segundos
    const interval = setInterval(() => {
      syncFromServer();
    }, 30000);

    // Sincronizar automáticamente cuando el usuario regresa a la pestaña (refetch on focus)
    const handleFocus = () => {
      syncFromServer();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [syncFromServer]);

  return (
    <StrictMode>
      <App />
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
