// ─── Página de Verificación de Email ─────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { verificarEmail, reenviarToken } from '../services/auth.service';

export default function VerificarEmail() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const emailFromUrl = searchParams.get('email') || '';
    
    const [email, setEmail] = useState(emailFromUrl);
    const [token, setToken] = useState(['', '', '', '']);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [reenviando, setReenviando] = useState(false);
    const [countdown, setCountdown] = useState(0);
    
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Countdown para reenviar
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    // Manejar input de cada dígito
    const handleTokenChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return; // Solo números
        
        const newToken = [...token];
        newToken[index] = value.slice(-1); // Solo último dígito
        setToken(newToken);
        setError('');

        // Auto-focus al siguiente input
        if (value && index < 3) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit cuando se completan los 4 dígitos
        if (newToken.every(d => d !== '') && index === 3) {
            handleSubmit(newToken.join(''));
        }
    };

    // Manejar backspace
    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !token[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    // Manejar paste
    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
        if (pastedData.length === 4) {
            const newToken = pastedData.split('');
            setToken(newToken);
            inputRefs.current[3]?.focus();
            handleSubmit(pastedData);
        }
    };

    const handleSubmit = async (tokenValue?: string) => {
        const tokenToVerify = tokenValue || token.join('');
        
        if (!email) {
            setError('El email es requerido');
            return;
        }

        if (tokenToVerify.length !== 4) {
            setError('Ingresa los 4 dígitos del código');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await verificarEmail({ email, token: tokenToVerify });

            if (response.error) {
                setError(response.mensaje || 'Código inválido');
                setToken(['', '', '', '']);
                inputRefs.current[0]?.focus();
                return;
            }

            setSuccess('¡Email verificado! Redirigiendo...');
            setTimeout(() => navigate('/login'), 2000);
            
        } catch (err) {
            setError('Error de conexión. Intenta nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    const handleReenviar = async () => {
        if (!email || countdown > 0) return;
        
        setReenviando(true);
        setError('');

        try {
            const response = await reenviarToken(email);

            if (response.error) {
                setError(response.mensaje || 'Error al reenviar código');
                return;
            }

            setSuccess('Código reenviado. Revisa tu email.');
            setCountdown(60); // 60 segundos de espera
            setTimeout(() => setSuccess(''), 3000);
            
        } catch (err) {
            setError('Error de conexión');
        } finally {
            setReenviando(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <img src="/escudo26.png" alt="Mutantes Fight Team" className="auth-logo-img" />
                    <h1>Verificar Email</h1>
                    <p>Ingresa el código de 4 dígitos que enviamos a tu email</p>
                </div>

                <div className="auth-form">
                    {!emailFromUrl && (
                        <div className="form-group">
                            <label htmlFor="email">Email</label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="tu@email.com"
                                required
                            />
                        </div>
                    )}

                    {emailFromUrl && (
                        <p className="auth-email-display">
                            Código enviado a: <strong>{email}</strong>
                        </p>
                    )}

                    {error && (
                        <div className="auth-error">
                            <span>⚠️</span> {error}
                        </div>
                    )}

                    {success && (
                        <div className="auth-success">
                            <span>✅</span> {success}
                        </div>
                    )}

                    <div className="token-inputs" onPaste={handlePaste}>
                        {token.map((digit, index) => (
                            <input
                                key={index}
                                ref={(el) => { inputRefs.current[index] = el; }}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleTokenChange(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                className="token-input"
                                disabled={loading}
                                autoFocus={index === 0}
                            />
                        ))}
                    </div>

                    <button 
                        type="button"
                        onClick={() => handleSubmit()}
                        className="auth-button"
                        disabled={loading || token.some(d => d === '')}
                    >
                        {loading ? (
                            <span className="loading-spinner">⏳</span>
                        ) : (
                            'Verificar'
                        )}
                    </button>

                    <div className="auth-resend">
                        <p>¿No recibiste el código?</p>
                        <button 
                            type="button"
                            onClick={handleReenviar}
                            className="auth-link-button"
                            disabled={reenviando || countdown > 0}
                        >
                            {reenviando ? 'Enviando...' : 
                             countdown > 0 ? `Reenviar en ${countdown}s` : 
                             'Reenviar código'}
                        </button>
                    </div>
                </div>

                <div className="auth-footer">
                    <Link to="/login" className="auth-link">
                        ← Volver al login
                    </Link>
                </div>
            </div>
        </div>
    );
}
