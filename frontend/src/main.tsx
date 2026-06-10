import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useStore } from './store/useStore.ts'
import { useAuthStore } from './store/authStore.ts'

function Root() {
  const syncFromServer = useStore((s) => s.syncFromServer);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    // Solo sincronizar cuando hay sesión iniciada (evita 401 en el login)
    if (!isAuthenticated) return;

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
  }, [isAuthenticated, syncFromServer]);

  return (
    <StrictMode>
      <App />
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
