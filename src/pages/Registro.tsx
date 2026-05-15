// ─── Página de Registro ──────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { registrarAdmin, validarCodigoInvitacion } from '../services/auth.service';

export default function Registro() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const codigoFromUrl = searchParams.get('codigo') || '';
    
    const [formData, setFormData] = useState({
        codigoInvitacion: codigoFromUrl,
        nombre: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [codigoValido, setCodigoValido] = useState<boolean | null>(null);
    const [validandoCodigo, setValidandoCodigo] = useState(false);

    // Validar código cuando cambia
    useEffect(() => {
        const validar = async () => {
            if (formData.codigoInvitacion.length >= 8) {
                setValidandoCodigo(true);
                try {
                    const resultado = await validarCodigoInvitacion(formData.codigoInvitacion);
                    setCodigoValido(resultado.valido);
                    if (!resultado.valido) {
                        setError(resultado.mensaje);
                    } else {
                        setError('');
                    }
                } catch {
                    setCodigoValido(false);
                }
                setValidandoCodigo(false);
            } else {
                setCodigoValido(null);
            }
        };
        validar();
    }, [formData.codigoInvitacion]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        // Convertir código a mayúsculas
        const newValue = name === 'codigoInvitacion' ? value.toUpperCase() : value;
        setFormData({ ...formData, [name]: newValue });
        if (name !== 'codigoInvitacion') setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validar código de invitación
        if (!formData.codigoInvitacion || !codigoValido) {
            setError('Código de invitación inválido o no proporcionado');
            return;
        }

        // Validar contraseñas
        if (formData.password !== formData.confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        if (formData.password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setLoading(true);

        try {
            const response = await registrarAdmin({
                nombre: formData.nombre,
                email: formData.email,
                password: formData.password,
                codigoInvitacion: formData.codigoInvitacion,
            });

            if (response.error) {
                setError(response.mensaje || 'Error al registrar');
                return;
            }

            // Redirigir a verificación
            navigate(`/verificar?email=${encodeURIComponent(formData.email)}`);
            
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
                    <h2>Crear Cuenta</h2>

                    {error && (
                        <div className="auth-error">
                            <span>⚠️</span> {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="codigoInvitacion">
                            Código de invitación
                            {codigoValido === true && <span className="codigo-valido"> ✓</span>}
                            {codigoValido === false && <span className="codigo-invalido"> ✗</span>}
                            {validandoCodigo && <span className="codigo-validando"> ...</span>}
                        </label>
                        <input
                            type="text"
                            id="codigoInvitacion"
                            name="codigoInvitacion"
                            value={formData.codigoInvitacion}
                            onChange={handleChange}
                            placeholder="Ej: ABC12345"
                            required
                            maxLength={8}
                            style={{ textTransform: 'uppercase', letterSpacing: '2px' }}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="nombre">Nombre completo</label>
                        <input
                            type="text"
                            id="nombre"
                            name="nombre"
                            value={formData.nombre}
                            onChange={handleChange}
                            placeholder="Tu nombre"
                            required
                            autoComplete="name"
                            disabled={!codigoValido}
                        />
                    </div>

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
                            placeholder="Mínimo 6 caracteres"
                            required
                            autoComplete="new-password"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirmar contraseña</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            placeholder="Repite tu contraseña"
                            required
                            autoComplete="new-password"
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="auth-button"
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="loading-spinner">⏳</span>
                        ) : (
                            'Crear cuenta'
                        )}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>¿Ya tienes cuenta?</p>
                    <Link to="/login" className="auth-link">
                        Iniciar sesión →
                    </Link>
                </div>
            </div>
        </div>
    );
}
