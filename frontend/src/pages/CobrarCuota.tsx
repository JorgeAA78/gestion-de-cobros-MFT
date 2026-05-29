import { useState, useMemo, type FormEvent } from 'react';
import { useStore } from '../store/useStore';
import { MONTH_NAMES } from '../types';
import { showToast } from '../components/Toast';
import { formatWhatsApp, formatCurrency, sendWhatsAppTemplate, sanitizeInput, buildMessage } from '../services/ycloud';

const PREVIEW_TEMPLATES: Record<string, string> = {
    disponible: `¡Hola {nombre}! 👋 \n\nTe recordamos que la cuota de {mes} ya está disponible para abonar:\n\n💰 Monto: {monto}\n📋 Plan: {plan}\n📅 Fecha límite: {fecha}\n\nAlias: mutantesbjj\na nombre de: Pablo Sebastian Echazu Bloser\n\nPor favor, enviar comprobante al realizar el pago\n\n¡Te esperamos en el tatami! 💪\n\nMutantes Fight Team - BJJ`,
    recordatorio: `¡Hola {nombre}! 👋 \n\nTe recordamos que la cuota de {mes} está pendiente:\n\n💰 Monto: {monto}\n📋 Plan: {plan}\n\nAlias: mutantesbjj\na nombre de: Pablo Sebastian Echazu Bloser\n\nPor favor, enviar comprobante al realizar el pago\n\n¡Te esperamos en el tatami! 💪 \n\nMutantes Fight Team - BJJ`,
};

export default function CobrarCuota() {
    const alumnos = useStore((s) => s.alumnos);
    const config = useStore((s) => s.config);
    const addActivity = useStore((s) => s.addActivity);
    const incrementMensajes = useStore((s) => s.incrementMensajes);
    const now = new Date();
    const mesCurrent = now.getMonth() + 1;

    const [alumnoId, setAlumnoId] = useState('');
    const [nombre, setNombre] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [monto, setMonto] = useState('');
    const [mes, setMes] = useState(mesCurrent);
    const [plan, setPlan] = useState('libre');
    const [fechaLimite, setFechaLimite] = useState('');
    const [datosPago, setDatosPago] = useState(config.datosPago || '');
    const plantilla = 'disponible';
    const [loading, setLoading] = useState(false);
    const [alumnoSearch, setAlumnoSearch] = useState('');
    const filteredAlumnos = useMemo(() => {
        if (!alumnoSearch.trim()) return alumnos;
        const q = alumnoSearch.toLowerCase();
        return alumnos.filter((a) => a.nombre.toLowerCase().includes(q));
    }, [alumnos, alumnoSearch]);

    const selectAlumno = (id: string) => {
        const a = alumnos.find((x) => x.id === id);
        if (a) {
            setAlumnoId(a.id);
            setNombre(a.nombre);
            setWhatsapp(a.whatsapp);
            setMonto(String(a.cuota));
            setPlan(a.plan);
        }
    };

    const preview = buildMessage(PREVIEW_TEMPLATES[plantilla], {
        nombre: nombre || '{nombre}',
        monto: monto ? formatCurrency(parseInt(monto)) : '{monto}',
        mes: MONTH_NAMES[mes - 1],
        plan: plan === 'libre' ? 'Libre' : '3 Veces por Semana',
        fecha: fechaLimite ? new Date(fechaLimite).toLocaleDateString('es-AR') : 'A convenir',
    });

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!config.ycloudApiKey) {
            showToast('⚙️ Configurá YCloud primero', 'warning');
            return;
        }
        setLoading(true);

        const sanitizedNombre = sanitizeInput(nombre);
        const sanitizedMonto = parseInt(monto) || 0;
        const num = formatWhatsApp(whatsapp);

        const mesText = MONTH_NAMES[mes - 1];
        const montoText = formatCurrency(sanitizedMonto);
        const planText = plan === 'libre' ? 'Libre' : '3 Veces por Semana';
        const fechaText = fechaLimite ? new Date(fechaLimite).toLocaleDateString('es-AR') : 'A convenir';

        const vars = [sanitizedNombre, mesText, montoText, planText, fechaText];

        const res = await sendWhatsAppTemplate(num, plantilla, vars);

        if (res.success) {
            showToast(`✅ Cobro enviado a ${sanitizedNombre}`, 'success');
            incrementMensajes();
            addActivity('sent', `Cobro ${mesText} enviado a ${sanitizedNombre}: ${montoText}`);
        } else {
            showToast(`❌ Error: ${res.error}`, 'error');
            addActivity('failed', `Error cobro a ${sanitizedNombre}: ${res.error}`);
        }
        setLoading(false);
    };

    return (
        <>
            <div className="page-header">
                <h1>💳 <span className="header-accent">Cobrar Cuota</span></h1>
                <p>Enviá un aviso de cobro por WhatsApp al alumno</p>
            </div>

            <div className="form-container">
                <form className="card" onSubmit={handleSubmit}>
                    <h3 className="section-title">👤 Seleccionar Alumno</h3>

                    <div className="form-group">
                        <label>Alumno Registrado</label>
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, zIndex: 1 }}>🔍</span>
                            <input
                                className="form-input"
                                style={{ paddingLeft: 34 }}
                                placeholder="Buscar alumno por nombre..."
                                value={alumnoSearch}
                                onChange={(e) => { setAlumnoSearch(e.target.value); setAlumnoId(''); }}
                            />
                        </div>
                        {alumnoSearch.trim() && filteredAlumnos.length > 0 && !alumnoId && (
                            <div style={{
                                background: '#0d1610', border: '1px solid rgba(34,197,94,0.2)',
                                borderRadius: 8, maxHeight: 200, overflowY: 'auto', marginTop: 4,
                            }}>
                                {filteredAlumnos.slice(0, 10).map((a) => (
                                    <div key={a.id}
                                        onClick={() => { selectAlumno(a.id); setAlumnoSearch(a.nombre); }}
                                        style={{
                                            padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem',
                                            borderBottom: '1px solid rgba(34,197,94,0.08)',
                                            transition: 'background 150ms',
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(34,197,94,0.1)')}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <strong style={{ color: '#22c55e' }}>{a.nombre}</strong>
                                        <span style={{ color: 'rgba(134,239,172,0.5)', marginLeft: 8, fontSize: '0.8rem' }}>
                                            {a.plan === 'libre' ? '🔥 Libre' : '💪 3x'} · {formatCurrency(a.cuota)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {alumnoId && (
                            <p style={{ fontSize: '0.78rem', color: '#22c55e', marginTop: 4 }}>
                                ✓ Seleccionado: <strong>{nombre}</strong>
                                <button type="button" onClick={() => { setAlumnoId(''); setAlumnoSearch(''); setNombre(''); setWhatsapp(''); setMonto(''); }}
                                    style={{ marginLeft: 8, background: 'none', border: 'none', color: 'rgba(134,239,172,0.5)', cursor: 'pointer', fontSize: '0.78rem' }}>
                                    ✕ Limpiar
                                </button>
                            </p>
                        )}
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Nombre <span className="required">*</span></label>
                            <input type="text" className="form-input" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label>WhatsApp <span className="required">*</span></label>
                            <div className="input-group">
                                <span className="input-prefix">+54</span>
                                <input type="tel" className="form-input" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} required />
                            </div>
                        </div>
                    </div>

                    <div className="form-row-3">
                        <div className="form-group">
                            <label>Monto <span className="required">*</span></label>
                            <div className="input-group">
                                <span className="input-prefix">$</span>
                                <input type="number" className="form-input" value={monto} onChange={(e) => setMonto(e.target.value)} required />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Mes <span className="required">*</span></label>
                            <select className="form-select" value={mes} onChange={(e) => setMes(parseInt(e.target.value))}>
                                {MONTH_NAMES.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Plan</label>
                            <select className="form-select" value={plan} onChange={(e) => setPlan(e.target.value)}>
                                <option value="libre">🔥 Libre</option>
                                <option value="3x">💪 3x Semana</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Fecha Límite</label>
                            <input type="date" className="form-input" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Datos de Pago</label>
                            <input type="text" className="form-input" value={datosPago} onChange={(e) => setDatosPago(e.target.value)}
                                placeholder="Alias: mutantes.bjj" />
                        </div>
                    </div>

                    <h3 className="section-title mt-2">💬 Vista Previa de Plantilla (Aviso de Cuota Disponible)</h3>

                    <div className="message-preview">
                        <div className="message-bubble">
                            <p style={{ whiteSpace: 'pre-wrap' }}>{preview}</p>
                            <div className="msg-time">12:00 ✓✓</div>
                        </div>
                    </div>

                    <div className="btn-group">
                        <button type="submit" className="btn btn-success btn-lg" disabled={loading}>
                            {loading ? '⏳ Enviando...' : '📱 Enviar por WhatsApp'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
