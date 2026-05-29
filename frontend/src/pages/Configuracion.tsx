import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/authStore';
import { showToast } from '../components/Toast';
import { testConnection, sendWhatsAppTemplate, sanitizeInput, formatWhatsApp } from '../services/ycloud';
import { generarInvitacion, listarInvitaciones, eliminarInvitacion } from '../services/auth.service';

interface Invitacion {
    id: string;
    codigo: string;
    creadoEn: string;
    expiraEn: string;
    usado: boolean;
    usadoPor: string | null;
    expirado: boolean;
}

export default function Configuracion() {
    const config = useStore((s) => s.config);
    const updateConfig = useStore((s) => s.updateConfig);
    const addActivity = useStore((s) => s.addActivity);
    const token = useAuthStore((s) => s.token);

    const [key, setKey] = useState(config.ycloudApiKey);
    const [whatsappNumber, setWhatsappNumber] = useState(config.ycloudWhatsAppNumber);
    const [dia, setDia] = useState(config.diaEnvio);
    const [datosPago, setDatosPago] = useState(config.datosPago);
    const [showTest, setShowTest] = useState(false);
    const [testNum, setTestNum] = useState('');

    // Estado para invitaciones
    const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
    const [generandoInvitacion, setGenerandoInvitacion] = useState(false);
    const [nuevoCodigo, setNuevoCodigo] = useState<string | null>(null);

    // Cargar invitaciones al montar
    useEffect(() => {
        if (token) cargarInvitaciones();
    }, [token]);

    const cargarInvitaciones = async () => {
        if (!token) return;
        try {
            const data = await listarInvitaciones(token);
            setInvitaciones(data.invitaciones || []);
        } catch (err) {
            console.error('Error cargando invitaciones:', err);
        }
    };

    const handleGenerarInvitacion = async () => {
        if (!token) return;
        setGenerandoInvitacion(true);
        try {
            const data = await generarInvitacion(token, 7);
            if (data.invitacion) {
                setNuevoCodigo(data.invitacion.codigo);
                showToast('✅ Invitación generada', 'success');
                cargarInvitaciones();
            }
        } catch (err) {
            showToast('❌ Error al generar invitación', 'error');
        }
        setGenerandoInvitacion(false);
    };

    const handleEliminarInvitacion = async (id: string) => {
        if (!token) return;
        if (!confirm('¿Eliminar esta invitación?')) return;
        try {
            await eliminarInvitacion(token, id);
            showToast('Invitación eliminada', 'success');
            cargarInvitaciones();
        } catch (err) {
            showToast('Error al eliminar', 'error');
        }
    };

    const copiarCodigo = (codigo: string) => {
        navigator.clipboard.writeText(codigo);
        showToast('📋 Código copiado', 'success');
    };

    const copiarEnlace = (codigo: string) => {
        const enlace = `${window.location.origin}/#/registro?codigo=${codigo}`;
        navigator.clipboard.writeText(enlace);
        showToast('🔗 Enlace copiado', 'success');
    };

    const save = () => {
        updateConfig({
            ycloudApiKey: sanitizeInput(key),
            ycloudWhatsAppNumber: sanitizeInput(whatsappNumber),
            diaEnvio: dia,
            datosPago: sanitizeInput(datosPago),
        });
        showToast('✅ Configuración guardada', 'success');
        addActivity('sent', 'Configuración actualizada');
    };

    const test = async () => {
        if (!key) { showToast('Completá la API Key', 'warning'); return; }
        showToast('🔄 Probando conexión...', 'info');
        const res = await testConnection(key);
        if (res.connected) showToast(`✅ Conectado! Balance: ${res.balance || 'OK'}`, 'success');
        else showToast(`❌ Error: ${res.error}`, 'error');
    };

    const sendTest = async () => {
        const num = formatWhatsApp(testNum);
        if (!num || num.length < 10) { showToast('Número inválido', 'warning'); return; }
        save();
        const res = await sendWhatsAppTemplate(num, 'bienvenida', ['Alumno Prueba', 'Plan Libre', '$25.000']);
        if (res.success) showToast('✅ Mensaje de prueba enviado!', 'success');
        else showToast(`❌ ${res.error}`, 'error');
    };

    const clearAll = () => {
        if (confirm('⚠️ ¿BORRAR TODO?')) {
            localStorage.removeItem('mft-store');
            window.location.reload();
        }
    };

    return (
        <>
            <div className="page-header">
                <h1>⚙️ <span className="header-accent">Configuración</span></h1>
                <p>YCloud WhatsApp Business API y parámetros del sistema</p>
            </div>

            <div className="form-container" style={{ maxWidth: 800 }}>
                {/* YCloud WhatsApp Business API */}
                <div className="card">
                    <h3 className="section-title">📱 YCloud WhatsApp API</h3>
                    <p style={{ color: 'rgba(134,239,172,0.4)', fontSize: '0.9rem', marginBottom: 'var(--space-lg)' }}>
                        Conectá tu cuenta de YCloud para enviar WhatsApp Business de forma oficial a través de plantillas aprobadas.
                    </p>

                    <div className="form-group">
                        <label>YCloud API Key <span className="required">*</span></label>
                        <div className="input-group">
                            <span className="input-prefix">🔑</span>
                            <input type="password" className="form-input" value={key} onChange={(e) => setKey(e.target.value)}
                                placeholder="Ingresá tu API Key de YCloud" />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Número de WhatsApp Remitente <span className="required">*</span></label>
                        <input type="text" className="form-input" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)}
                            placeholder="Ej: +5491122334455" />
                        <p className="form-hint">Tu número conectado a WABA/YCloud en formato internacional E.164 (debe comenzar con +)</p>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                        <button className="btn btn-primary" onClick={test}>🔄 Probar Conexión</button>
                        <button className="btn btn-secondary" onClick={() => setShowTest(!showTest)}>📱 Mensaje de Prueba</button>
                    </div>
                </div>

                {showTest && (
                    <div className="card mt-2">
                        <h3 className="section-title"> Enviar Prueba</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <div className="input-group">
                                    <span className="input-prefix">+54</span>
                                    <input type="tel" className="form-input" value={testNum} onChange={(e) => setTestNum(e.target.value)}
                                        placeholder="11 2345 6789" />
                                </div>
                            </div>
                            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                                <button className="btn btn-success" style={{ width: '100%' }} onClick={sendTest}>📤 Enviar</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Billing Settings */}
                <div className="card mt-2">
                    <h3 className="section-title">📅 Parámetros de Cobro</h3>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Día de Envío Automático</label>
                            <input type="number" className="form-input" value={dia}
                                onChange={(e) => setDia(parseInt(e.target.value) || 5)} min={1} max={28} />
                            <p className="form-hint">A partir de este día, el sistema avisa sobre cuotas pendientes (default: 5)</p>
                        </div>
                        <div className="form-group">
                            <label>Datos de Pago (CBU/Alias/MP)</label>
                            <input type="text" className="form-input" value={datosPago}
                                onChange={(e) => setDatosPago(e.target.value)} placeholder="Alias: mutantes.bjj" />
                        </div>
                    </div>
                </div>

                <div className="btn-group">
                    <button className="btn btn-primary btn-lg" onClick={save}>💾 Guardar Configuración</button>
                </div>

                {/* Flow */}
                <div className="card mt-2" style={{ borderLeft: '3px solid var(--accent-green)' }}>
                    <h3 className="section-title">🔄 Flujo del Sistema</h3>
                    <pre style={{
                        background: 'rgba(0,0,0,0.3)', padding: 'var(--space-lg)', borderRadius: 8,
                        color: 'var(--accent-green)', fontSize: '0.85rem', lineHeight: 1.8, overflow: 'auto',
                    }}>
                        {`  📝 Form / Excel Import
       │
       ▼
  🖥️  React + TypeScript
       │
       ▼
  📱 YCloud API ────────► 💬 WhatsApp
       │                    │
       ▼                    ▼
  ✅ Estado              📲 Alumno recibe
  actualizado            el mensaje
       │
       ▼
  📊 Dashboard (solo pendientes)`}
                    </pre>
                </div>

                {/* Invitaciones */}
                <div className="card mt-2" style={{ borderLeft: '3px solid var(--accent-blue)' }}>
                    <h3 className="section-title">🎟️ Invitaciones de Acceso</h3>
                    <p style={{ color: 'rgba(134,239,172,0.4)', fontSize: '0.9rem', marginBottom: 'var(--space-lg)' }}>
                        Genera códigos de invitación para permitir que nuevos administradores se registren.
                    </p>

                    <button 
                        className="btn btn-primary" 
                        onClick={handleGenerarInvitacion}
                        disabled={generandoInvitacion}
                        style={{ marginBottom: 'var(--space-lg)' }}
                    >
                        {generandoInvitacion ? '⏳ Generando...' : '➕ Generar Nueva Invitación'}
                    </button>

                    {nuevoCodigo && (
                        <div className="invitacion-nueva">
                            <p>✅ Nueva invitación generada:</p>
                            <div className="codigo-display">
                                <span className="codigo">{nuevoCodigo}</span>
                                <button className="btn btn-sm" onClick={() => copiarCodigo(nuevoCodigo)}>📋 Copiar</button>
                                <button className="btn btn-sm" onClick={() => copiarEnlace(nuevoCodigo)}>🔗 Enlace</button>
                            </div>
                            <p className="hint">Válido por 7 días. Comparte este código o enlace con el nuevo administrador.</p>
                        </div>
                    )}

                    {invitaciones.length > 0 && (
                        <div className="invitaciones-lista">
                            <h4>Invitaciones existentes</h4>
                            <table className="invitaciones-table">
                                <thead>
                                    <tr>
                                        <th>Código</th>
                                        <th>Estado</th>
                                        <th>Expira</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invitaciones.map((inv) => (
                                        <tr key={inv.id} className={inv.usado || inv.expirado ? 'disabled' : ''}>
                                            <td className="codigo-cell">{inv.codigo}</td>
                                            <td>
                                                {inv.usado ? (
                                                    <span className="badge badge-used">Usado por {inv.usadoPor}</span>
                                                ) : inv.expirado ? (
                                                    <span className="badge badge-expired">Expirado</span>
                                                ) : (
                                                    <span className="badge badge-active">Activo</span>
                                                )}
                                            </td>
                                            <td>{new Date(inv.expiraEn).toLocaleDateString('es-AR')}</td>
                                            <td>
                                                {!inv.usado && !inv.expirado && (
                                                    <>
                                                        <button className="btn-icon" onClick={() => copiarCodigo(inv.codigo)} title="Copiar código">📋</button>
                                                        <button className="btn-icon" onClick={() => copiarEnlace(inv.codigo)} title="Copiar enlace">🔗</button>
                                                    </>
                                                )}
                                                <button className="btn-icon btn-danger-icon" onClick={() => handleEliminarInvitacion(inv.id)} title="Eliminar">🗑️</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Danger */}
                <div className="card mt-2" style={{ borderLeft: '3px solid var(--accent-red)' }}>
                    <h3 className="section-title" style={{ color: 'var(--accent-red)' }}>⚠️ Zona de Peligro</h3>
                    <button className="btn btn-danger" onClick={clearAll}>💣 Borrar TODO (Alumnos, Pagos, Config)</button>
                </div>
            </div>
        </>
    );
}
