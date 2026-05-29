// ─── Componente de protección de rutas ───────────────────────────────────────
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { isAuthenticated, isLoading } = useAuthStore();
    const location = useLocation();

    // Mostrar loading mientras se verifica el estado de autenticación
    if (isLoading) {
        return (
            <div className="auth-loading">
                <div className="auth-loading-spinner">🥋</div>
                <p>Cargando...</p>
            </div>
        );
    }

    // Si no está autenticado, redirigir al login
    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
}
