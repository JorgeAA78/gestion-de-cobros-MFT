// ─── Página de Login ─────────────────────────────────────────────────────────
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginAdmin } from '../services/auth.service';
import { useAuthStore } from '../store/authStore';

export default function Login() {
    const navigate = useNavigate();
    const setAuth = useAuthStore((state) => state.setAuth);
    
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [requiereVerificacion, setRequiereVerificacion] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await loginAdmin(formData);

            if (response.error) {
                if (response.requiereVerificacion) {
                    setRequiereVerificacion(true);
                }
                setError(response.mensaje || 'Error al iniciar sesión');
                return;
            }

            if (response.token && response.admin) {
                setAuth(response.token, response.admin);
                navigate('/');
            }
        } catch (err) {
            setError('Error de conexión. Intenta nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <img src="/escudo26.png" alt="Mutantes Fight Team" className="auth-logo-img" />
                    <h1>Mutantes Fight Team</h1>
                    <p>Sistema de Gestión de Cobros</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <h2>Iniciar Sesión</h2>

                    {error && (
                        <div className="auth-error">
                            <span>⚠️</span> {error}
                        </div>
                    )}

                    {requiereVerificacion && (
                        <div className="auth-warning">
                            <Link to={`/verificar?email=${encodeURIComponent(formData.email)}`}>
                                Verificar mi email →
                            </Link>
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="tu@email.com"
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Contraseña</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="••••••••"
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="auth-button"
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="loading-spinner">
                                <img src="/escudo26.png" alt="Cargando..." className="loading-logo" />
                            </span>
                        ) : (
                            'Ingresar'
                        )}
                    </button>
                </form>

                <div className="auth-footer">
                    <p className="auth-footer-note">
                        El acceso es solo por invitación.<br/>
                        Contacta al administrador para obtener acceso.
                    </p>
                </div>
            </div>
        </div>
    );
}
