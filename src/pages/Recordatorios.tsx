import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { MONTH_NAMES } from '../types';
import { showToast } from '../components/Toast';
import { formatCurrency, sendWhatsApp, buildMessage } from '../services/evolution';

export default function Recordatorios() {
    const alumnos = useStore((s) => s.alumnos);
    const pagos = useStore((s) => s.pagos);
    const config = useStore((s) => s.config);
    const addActivity = useStore((s) => s.addActivity);
    const incrementMensajes = useStore((s) => s.incrementMensajes);
    const now = new Date();
    const mesCurrent = now.getMonth() + 1;
    const anio = now.getFullYear();

    const [mes, setMes] = useState(mesCurrent);
    const [sending, setSending] = useState(false);
    const [statuses, setStatuses] = useState<Record<string, 'pending' | 'sending' | 'sent' | 'error'>>({});
    const [template, setTemplate] = useState(config.mensajePlantilla || `¡Hola {nombre}! 👋 \n\nTe recordamos que la cuota de *{mes}* está pendiente:\n\n💰 Monto: *{monto}*\n📋 Plan: *{plan}*\n\nAlias: *mutantesbjj*
a nombre de: Pablo Sebastian Echazu Bloser\n\n*Por favor, enviar comprobante al realizar el pago*\n\n¡Te esperamos en el tatami! 💪 \n\n_Mutantes Fight Team - BJJ_`);

    const pendientes = useMemo(() => {
        return alumnos.filter((a) => {
            // Solo alumnos activos reciben recordatorios
            if (a.estado !== 'activo') return false;
            const pago = pagos.find((p) => p.alumnoId === a.id && p.mes === mes && p.anio === anio);
            return !pago || pago.estado !== 'pagado';
        });
    }, [alumnos, pagos, mes, anio]);

    const randomDelay = () => {
        const min = 20.0;
        const max = 40.0;
        const sec = parseFloat((Math.random() * (max - min) + min).toFixed(2));
        return new Promise<void>((r) => setTimeout(r, sec * 1000));
    };

    const handleSend = async () => {
        if (pendientes.length === 0) return;
        if (!config.evolutionApiUrl || !config.evolutionApiKey || !config.evolutionInstance) {
            showToast('⚙️ Configurá Evolution API primero', 'warning');
            return;
        }

        setSending(true);
        const initialStatuses: Record<string, 'pending'> = {};
        pendientes.forEach((a) => { initialStatuses[a.id] = 'pending'; });
        setStatuses(initialStatuses);

        let sent = 0, failed = 0;

        for (let i = 0; i < pendientes.length; i++) {
            const a = pendientes[i];
            setStatuses((s) => ({ ...s, [a.id]: 'sending' }));

            const msg = buildMessage(template, {
                nombre: a.nombre,
                monto: formatCurrency(a.cuota),
                mes: MONTH_NAMES[mes - 1],
                plan: a.plan === 'libre' ? 'Libre' : '3 Veces por Semana',
                datos_pago: config.datosPago || '',
            });

            const res = await sendWhatsApp(config.evolutionApiUrl, config.evolutionApiKey, config.evolutionInstance, a.whatsapp, msg);

            if (res.success) {
                sent++;
                setStatuses((s) => ({ ...s, [a.id]: 'sent' }));
            } else {
                failed++;
                setStatuses((s) => ({ ...s, [a.id]: 'error' }));
            }

            if (i < pendientes.length - 1) await randomDelay();
        }

        incrementMensajes(sent);
        addActivity('sent', `Recordatorios ${MONTH_NAMES[mes - 1]}: ${sent} enviados, ${failed} fallidos`);
        showToast(`✅ ${sent} enviados, ${failed} con error`, sent > 0 ? 'success' : 'error');
        setSending(false);
    };

    const sampleMsg = pendientes.length > 0
        ? buildMessage(template, {
            nombre: pendientes[0].nombre,
            monto: formatCurrency(pendientes[0].cuota),
            mes: MONTH_NAMES[mes - 1],
            plan: pendientes[0].plan === 'libre' ? 'Libre' : '3 Veces por Semana',
            datos_pago: config.datosPago || '',
        })
        : '';

    return (
        <>
            <div className="page-header">
                <h1>🔔 <span className="header-accent">Recordatorios</span></h1>
                <p>Enviar recordatorios a alumnos que no pagaron — Solo se envía a quienes tienen cuota pendiente</p>
            </div>

            <div className="form-container" style={{ maxWidth: 900 }}>
                {/* Month + Info */}
                <div className="card">
                    <h3 className="section-title">📅 Selección de Mes</h3>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Mes a recordar</label>
                            <select className="form-select" value={mes} onChange={(e) => setMes(parseInt(e.target.value))}>
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
                    <h3 className="section-title">💬 Mensaje de Recordatorio</h3>
                    <div className="form-group">
                        <textarea className="form-textarea" value={template} onChange={(e) => setTemplate(e.target.value)} rows={8} />
                        <p className="form-hint">Variables: {'{nombre}'}, {'{monto}'}, {'{mes}'}, {'{plan}'}, {'{datos_pago}'}</p>
                    </div>

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
                                    const st = statuses[a.id];
                                    return (
                                        <tr key={a.id}>
                                            <td>{i + 1}</td>
                                            <td><strong>{a.nombre}</strong></td>
                                            <td>+{a.whatsapp}</td>
                                            <td>{a.plan === 'libre' ? '🔥 Libre' : '💪 3x'}</td>
                                            <td>{formatCurrency(a.cuota)}</td>
                                            <td>
                                                <span className={`badge ${st === 'sent' ? 'pagado' : st === 'error' ? 'vencido' : 'pendiente'}`}>
                                                    {st === 'sending' ? '⏳ Enviando...' :
                                                        st === 'sent' ? '✓ Enviado' :
                                                            st === 'error' ? '✗ Error' : '⏳ Pendiente'}
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
                        disabled={pendientes.length === 0 || sending}
                        onClick={handleSend}>
                        {sending ? '⏳ Enviando...' : `📱 Enviar Recordatorios a ${pendientes.length} Alumnos`}
                    </button>
                </div>

                <div className="card mt-2" style={{ borderLeft: '3px solid var(--accent-green)' }}>
                    <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                        💡 Los mensajes se envían con 3 segundos de intervalo para evitar bloqueos de WhatsApp.
                        Solo se envía a quienes <strong>no tienen el pago marcado como "Pagado"</strong> en el mes seleccionado.
                    </p>
                </div>
            </div>
        </>
    );
}
