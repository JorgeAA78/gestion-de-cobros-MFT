import { useState, useMemo, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { MONTH_NAMES } from '../types';
import { showToast } from '../components/Toast';
import { formatCurrency, buildMessage } from '../services/ycloud';

const PREVIEW_TEMPLATES: Record<string, string> = {
    disponible: `¡Hola {nombre}! 👋 \n\nTe recordamos que la cuota de {mes} ya está disponible para abonar:\n\n💰 Monto: {monto}\n📋 Plan: {plan}\n📅 Fecha límite: {fecha}\n\nAlias: mutantesbjj\na nombre de: Pablo Sebastian Echazu Bloser\n\nPor favor, enviar comprobante al realizar el pago\n\n¡Te esperamos en el tatami! 💪\n\nMutantes Fight Team - BJJ`,
    recordatorio: `¡Hola {nombre}! 👋 \n\nTe recordamos que la cuota de {mes} está pendiente:\n\n💰 Monto: {monto}\n📋 Plan: {plan}\n\nAlias: mutantesbjj\na nombre de: Pablo Sebastian Echazu Bloser\n\nPor favor, enviar comprobante al realizar el pago\n\n¡Te esperamos en el tatami! 💪 \n\nMutantes Fight Team - BJJ`,
};

export default function Recordatorios() {
    const alumnos = useStore((s) => s.alumnos);
    const pagos = useStore((s) => s.pagos);
    const config = useStore((s) => s.config);
    const recordatoriosEnviados = useStore((s) => s.recordatoriosEnviados);
    const toggleRecordatorioEnviado = useStore((s) => s.toggleRecordatorioEnviado);
    
    // Acciones y estados del envío en segundo plano
    const statusManual = useStore((s) => s.envioManualStatus);
    const iniciarEnvioManual = useStore((s) => s.iniciarEnvioManual);
    const cancelarEnvioManual = useStore((s) => s.cancelarEnvioManual);
    const syncFromServer = useStore((s) => s.syncFromServer);

    const now = new Date();
    const mesCurrent = now.getMonth() + 1;
    const anio = now.getFullYear();

    const MAX_LOTE = 20;

    const [mes, setMes] = useState(mesCurrent);
    const plantilla = 'recordatorio';

    const sending = Boolean(statusManual?.enProgreso);

    // Polling rápido del estado completo mientras dure el envío en segundo plano
    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | undefined;
        if (sending) {
            interval = setInterval(() => {
                syncFromServer();
            }, 3000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [sending, syncFromServer]);

    const pendientes = useMemo(() => {
        return alumnos.filter((a) => {
            // Solo alumnos activos reciben recordatorios
            if (a.estado !== 'activo') return false;
            const pago = pagos.find((p) => p.alumnoId === a.id && p.mes === mes && p.anio === anio);
            return !pago || pago.estado !== 'pagado';
        });
    }, [alumnos, pagos, mes, anio]);

    const keyFor = (alumnoId: string) => `${alumnoId}_${mes}_${anio}`;

    const hasManual = (key: string) => Boolean(recordatoriosEnviados[key]?.manual);
    const hasAuto = (key: string) => {
        const entry = recordatoriosEnviados[key];
        if (!entry) return false;
        return Boolean(entry.primer_recordatorio || entry.segundo_recordatorio);
    };
    const hasAny = (key: string) => hasManual(key) || hasAuto(key);

    type StatusType = 'pending' | 'sending' | 'manual_sent' | 'auto_sent' | 'error';

    const handleSend = async () => {
        const paraEnviar = pendientes
            .filter((a) => !hasAny(keyFor(a.id)))
            .slice(0, MAX_LOTE);
        
        if (paraEnviar.length === 0) {
            showToast('✅ Todos los alumnos en esta lista ya recibieron su recordatorio este mes.', 'success');
            return;
        }

        if (!config.ycloudApiKey || !config.ycloudWhatsAppNumber) {
            showToast('⚙️ Configurá YCloud primero', 'warning');
            return;
        }

        const ids = paraEnviar.map((a) => a.id);
        const res = await iniciarEnvioManual(ids, plantilla, mes, anio);
        
        if (res.success) {
            showToast('🚀 Envío de recordatorios iniciado en segundo plano. Podés navegar libremente por el sistema.', 'success');
        } else {
            showToast(`❌ Error al iniciar el envío: ${res.error}`, 'error');
        }
    };

    const handleCancel = async () => {
        if (window.confirm('¿Estás seguro de que querés detener el envío de recordatorios?')) {
            await cancelarEnvioManual();
            showToast('🛑 Solicitud de cancelación enviada.', 'info');
        }
    };

    const sampleMsg = pendientes.length > 0
        ? buildMessage(PREVIEW_TEMPLATES[plantilla], {
            nombre: pendientes[0].nombre,
            monto: formatCurrency(pendientes[0].cuota),
            mes: MONTH_NAMES[mes - 1],
            plan: pendientes[0].plan === 'libre' ? 'Libre' : '3 Veces por Semana',
            fecha: `${pendientes[0].diaVencimiento ?? 10} de ${MONTH_NAMES[mes - 1]}`,
        })
        : '';

    return (
        <>
            <div className="page-header">
                <h1>🔔 <span className="header-accent">Recordatorios</span></h1>
                <p>Enviar recordatorios a alumnos que no pagaron — Solo se envía a quienes tienen cuota pendiente</p>
            </div>

            <div className="form-container" style={{ maxWidth: 900 }}>
                {/* Panel de progreso del envío en segundo plano */}
                {sending && statusManual && (
                    <div className="card" style={{ borderLeft: '4px solid var(--accent-green)', background: 'rgba(34,197,94,0.03)', marginBottom: 'var(--space-md)' }}>
                        <h3 className="section-title">⏳ Envío de Recordatorios en Progreso</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: '10px' }}>
                            <div>
                                Enviados: <strong style={{ color: '#22c55e' }}>{statusManual.enviados}</strong> | 
                                Fallidos: <strong style={{ color: '#ef4444' }}>{statusManual.fallidos}</strong> | 
                                Total: <strong>{statusManual.total}</strong>
                            </div>
                            <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                                Alumno actual: <strong>{alumnos.find(x => x.id === statusManual.alumnoActualId)?.nombre || 'Procesando...'}</strong>
                            </div>
                        </div>
                        {/* Barra de progreso */}
                        <div style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden', marginBottom: 15 }}>
                            <div style={{
                                width: `${((statusManual.enviados + statusManual.fallidos) / statusManual.total) * 100}%`,
                                height: '100%',
                                background: 'var(--accent-green)',
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                        <button className="btn btn-danger btn-block" onClick={handleCancel}>
                            🛑 Detener Envío
                        </button>
                    </div>
                )}

                {/* Month + Info */}
                <div className="card">
                    <h3 className="section-title">📅 Selección de Mes</h3>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Mes a recordar</label>
                            <select className="form-select" value={mes} onChange={(e) => setMes(parseInt(e.target.value))} disabled={sending}>
                                {MONTH_NAMES.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
                            </select>
                        </div>
                        <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <div style={{ background: 'rgba(34,197,94,0.08)', padding: '10px 16px', borderRadius: 8, width: '100%', textAlign: 'center' }}>
                                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: pendientes.length > 0 ? '#f59e0b' : '#22c55e' }}>
                                    {pendientes.length}
                                </span>
                                <p style={{ fontSize: '0.8rem', color: 'rgba(134,239,172,0.5)' }}>
                                    {pendientes.length > 0 ? 'alumnos sin pagar' : '¡todos al día!'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div style={{
                        background: 'rgba(34,197,94,0.05)', borderRadius: 8,
                        padding: 'var(--space-md)', marginTop: 'var(--space-md)',
                        fontSize: '0.85rem', color: 'rgba(134,239,172,0.4)'
                    }}>
                        💡 <strong>Envío inteligente:</strong> Solo se enviarán mensajes a los {pendientes.length} alumnos que
                        NO pagaron {MONTH_NAMES[mes - 1]}. Los que ya abonaron no recibirán el recordatorio.
                    </div>
                </div>

                {/* Template */}
                <div className="card mt-2">
                    <h3 className="section-title">💬 Vista Previa del Recordatorio</h3>

                    {sampleMsg && (
                        <div className="message-preview">
                            <div className="message-bubble">
                                <p style={{ whiteSpace: 'pre-wrap' }}>{sampleMsg}</p>
                                <div className="msg-time">12:00 ✓✓</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Table */}
                <div className="card mt-2">
                    <h3 className="section-title">
                        📋 Alumnos Pendientes de {MONTH_NAMES[mes - 1]} ({pendientes.length})
                    </h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="preview-table">
                            <thead>
                                <tr><th>#</th><th>Nombre</th><th>WhatsApp</th><th>Plan</th><th>Cuota</th><th>Estado</th></tr>
                            </thead>
                            <tbody>
                                {pendientes.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 'var(--space-xl)' }}>
                                            🎉 ¡Todos los alumnos pagaron {MONTH_NAMES[mes - 1]}!
                                        </td>
                                    </tr>
                                ) : pendientes.map((a, i) => {
                                    const key = keyFor(a.id);
                                    const manualSent = hasManual(key);
                                    const autoSent = hasAuto(key);
                                    
                                    // Mapear dinámicamente el estado a partir de los resultados del servidor si está en progreso
                                    let displayStatus: StatusType = 'pending';
                                    if (sending && statusManual?.resultados && statusManual.resultados[a.id]) {
                                        const resStatus = statusManual.resultados[a.id];
                                        if (resStatus === 'sent') displayStatus = 'manual_sent';
                                        else if (resStatus === 'sending') displayStatus = 'sending';
                                        else if (resStatus === 'error') displayStatus = 'error';
                                        else displayStatus = 'pending';
                                    } else {
                                        displayStatus = manualSent ? 'manual_sent' : autoSent ? 'auto_sent' : 'pending';
                                    }

                                    return (
                                        <tr key={a.id}>
                                            <td>{i + 1}</td>
                                            <td><strong>{a.nombre}</strong></td>
                                            <td>+{a.whatsapp}</td>
                                            <td>{a.plan === 'libre' ? '🔥 Libre' : '💪 3x'}</td>
                                            <td>{formatCurrency(a.cuota)}</td>
                                            <td>
                                                <span
                                                    className={`badge ${displayStatus === 'manual_sent' || displayStatus === 'auto_sent' ? 'pagado' : displayStatus === 'error' ? 'vencido' : 'pendiente'}`}
                                                    style={{ cursor: sending || autoSent ? 'default' : 'pointer' }}
                                                    title={autoSent ? 'Envío automático registrado' : 'Clic para marcar/desmarcar manualmente'}
                                                    onClick={() => {
                                                        if (sending || autoSent) return;
                                                        toggleRecordatorioEnviado(a.id, mes, anio, 'manual');
                                                    }}
                                                >
                                                    {displayStatus === 'sending' && '⏳ Enviando...'}
                                                    {displayStatus === 'error' && '✗ Error'}
                                                    {displayStatus === 'manual_sent' && '✓ Manual'}
                                                    {displayStatus === 'auto_sent' && '🤖 Automático'}
                                                    {displayStatus === 'pending' && !autoSent && !manualSent && '⏳ Pendiente (Click)'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="btn-group mt-2">
                    <button className="btn btn-success btn-lg btn-block"
                        disabled={pendientes.length === 0 || sending || pendientes.filter((a) => !hasAny(keyFor(a.id))).length === 0}
                        onClick={handleSend}>
                        {sending ? '⏳ Enviando en segundo plano...' : `📱 Enviar Recordatorios (${Math.min(MAX_LOTE, pendientes.filter((a) => !hasAny(keyFor(a.id))).length)} de ${pendientes.filter((a) => !hasAny(keyFor(a.id))).length} pendientes)`}
                    </button>
                </div>

                <div className="card mt-2" style={{ borderLeft: '3px solid var(--accent-green)' }}>
                    <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                        💡 Los mensajes se envían con un intervalo aleatorio de entre 2 y 4 minutos, con una pausa de 5 a 8 minutos cada 10 mensajes para evitar bloqueos de WhatsApp.
                        Se procesan en <strong>lotes de hasta 20 mensajes</strong> por envío.<br/>
                        <em>Tip: Podés hacer clic en el estado "⏳ Pendiente" de un alumno para marcarlo manualmente como enviado si ya le avisaste antes.</em>
                    </p>
                </div>
            </div>
        </>
    );
}
