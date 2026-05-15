import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
    const navigate = useNavigate();
    const { admin, logout } = useAuthStore();

    const handleLogout = () => {
        logout();
        navigate('/login');
        onClose();
    };

    return (
        <>
            <div className={`sidebar-overlay ${open ? 'active' : ''}`} onClick={onClose} />
            <aside className={`sidebar ${open ? 'open' : ''}`}>
                <div className="sidebar-logo">
                    <img src="/escudo26.png" alt="Mutantes Fight Team" className="logo-img" />
                    <div>
                        <h2>Mutantes</h2>
                        <span>Fight Team BJJ</span>
                    </div>
                </div>

                {admin && (
                    <div className="sidebar-user">
                        <span className="user-icon">👤</span>
                        <div className="user-info">
                            <span className="user-name">{admin.nombre}</span>
                            <span className="user-email">{admin.email}</span>
                        </div>
                    </div>
                )}

                <nav className="sidebar-nav">
                    <span className="nav-section-label">Principal</span>
                    <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
                        <span className="nav-icon">📊</span> Dashboard
                    </NavLink>

                    <span className="nav-section-label">Gestión</span>
                    <NavLink to="/registrar" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
                        <span className="nav-icon">🥋</span> Registrar Alumno
                    </NavLink>
                    <NavLink to="/cobrar" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
                        <span className="nav-icon">💳</span> Cobrar Cuota
                    </NavLink>
                    <NavLink to="/recordatorios" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
                        <span className="nav-icon">🔔</span> Recordatorios
                    </NavLink>

                    <span className="nav-section-label">Sistema</span>
                    <NavLink to="/configuracion" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
                        <span className="nav-icon">⚙️</span> Configuración
                    </NavLink>
                </nav>

                <div className="sidebar-footer">
                    <button className="logout-button" onClick={handleLogout}>
                        <span>🚪</span> Cerrar Sesión
                    </button>
                </div>
            </aside>
        </>
    );
}
