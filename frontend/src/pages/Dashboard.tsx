import { useStore } from '../store/useStore';
import { MONTH_NAMES, ESTADO_LABELS, type EstadoAlumno, type Alumno } from '../types';
import { formatCurrency, formatWhatsApp, sanitizeInput } from '../services/ycloud';
import { useState, useEffect, useMemo } from 'react';
import { showToast } from '../components/Toast';
import HistorialPagosModal from '../components/HistorialPagosModal';

function timeAgo(iso: string) {
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'Justo ahora';
    if (m < 60) return `Hace ${m} min`;
    const h = Math.floor(ms / 3600000);
    if (h < 24) return `Hace ${h}h`;
    return `Hace ${Math.floor(ms / 86400000)}d`;
}

// Shrink font when the number is long to avoid overflow
function statFontSize(value: string): string {
    const len = value.length;
    if (len > 14) return '0.95rem';
    if (len > 11) return '1.15rem';
    if (len > 8) return '1.4rem';
    return '1.8rem';
}

export default function Dashboard() {
    const alumnos = useStore((s) => s.alumnos);
    const pagos = useStore((s) => s.pagos);
    const activity = useStore((s) => s.activity);
    const config = useStore((s) => s.config);
    const mensajesEnviados = useStore((s) => s.mensajesEnviados);
    const marcarPagado = useStore((s) => s.marcarPagado);
    const marcarPendiente = useStore((s) => s.marcarPendiente);
    const removeAlumno = useStore((s) => s.removeAlumno);
    const updateAlumno = useStore((s) => s.updateAlumno);

    const now = new Date();
    const mes = now.getMonth() + 1;
    const anio = now.getFullYear();

    const [reminder, setReminder] = useState(false);

    // Compute stats from raw state (avoids Zustand selector returning new objects)
    const pendientes = useMemo(() => {
        return alumnos.filter((a) => {
            const pago = pagos.find((p) => p.alumnoId === a.id && p.mes === mes && p.anio === anio);
            return !pago || pago.estado !== 'pagado';
        });
    }, [alumnos, pagos, mes, anio]);

    const totalRecaudado = useMemo(() => {
        return pagos
            .filter((p) => p.estado === 'pagado' && p.mes === mes && p.anio === anio)
            .reduce((sum, p) => sum + p.monto, 0);
    }, [pagos, mes, anio]);

    const historialMensual = useMemo(() => {
        const agrupado: Record<string, { mes: number; anio: number; total: number }> = {};
        pagos.forEach((p) => {
            if (p.estado === 'pagado') {
                const key = `${p.anio}-${p.mes}`;
                if (!agrupado[key]) {
                    agrupado[key] = { mes: p.mes, anio: p.anio, total: 0 };
                }
                agrupado[key].total += p.monto;
            }
        });
        return Object.values(agrupado).sort((a, b) => {
            if (a.anio !== b.anio) return b.anio - a.anio;
            return b.mes - a.mes;
        });
    }, [pagos]);


    const [busqueda, setBusqueda] = useState('');
    const [seleccionados, setSeleccionados] = useState<string[]>([]);
    const [tabSituacion, setTabSituacion] = useState<'todos' | EstadoAlumno>('activo');
    const [vistaModo, setVistaModo] = useState<'tarjetas' | 'tabla'>(() => {
        return typeof window !== 'undefined' && window.innerWidth <= 768 ? 'tarjetas' : 'tabla';
    });

    // ── Modal de Historial de Pagos ──────────────────────────
    const [alumnoHistorial, setAlumnoHistorial] = useState<Alumno | null>(null);
    const [isHistorialOpen, setIsHistorialOpen] = useState(false);

    const openHistorial = (a: Alumno) => {
        setAlumnoHistorial(a);
        setIsHistorialOpen(true);
    };

    const closeHistorial = () => {
        setIsHistorialOpen(false);
        setAlumnoHistorial(null);
    };

    // ── Modal de edición ─────────────────────────────────────
    const [editAlumno, setEditAlumno] = useState<Alumno | null>(null);
    const [editNombre, setEditNombre] = useState('');
    const [editWhatsapp, setEditWhatsapp] = useState('');
    const [editCuota, setEditCuota] = useState('');
    const [editDiaVenc, setEditDiaVenc] = useState(5);
    const [editPlan, setEditPlan] = useState<'libre' | '3x'>('libre');
    const [editEstado, setEditEstado] = useState<EstadoAlumno>('activo');
    const [editFechaRegistro, setEditFechaRegistro] = useState('');
    const [editModalTab, setEditModalTab] = useState<'datos' | 'historial'>('datos');

    const openEdit = (a: Alumno) => {
        setEditAlumno(a);
        setEditNombre(a.nombre);
        setEditModalTab('datos');
        
        let displayWhatsapp = a.whatsapp || '';
        if (displayWhatsapp.startsWith('549')) {
            displayWhatsapp = displayWhatsapp.substring(3);
        } else if (displayWhatsapp.startsWith('54')) {
            displayWhatsapp = displayWhatsapp.substring(2);
        }
        setEditWhatsapp(displayWhatsapp);
        
        setEditCuota(String(a.cuota));
        setEditDiaVenc(a.diaVencimiento ?? config.diaEnvio ?? 5);
        setEditPlan(a.plan);
        setEditEstado(a.estado || 'activo');
        const fechaAlta = a.fechaRegistro ? new Date(a.fechaRegistro).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        setEditFechaRegistro(fechaAlta);
    };

    const closeEdit = () => setEditAlumno(null);

    const saveEdit = () => {
        if (!editAlumno) return;
        const cuotaNum = parseInt(editCuota) || 0;
        const nameVal = editNombre.trim() || editAlumno.nombre;
        const sanitizedNombre = sanitizeInput(nameVal);
        updateAlumno(editAlumno.id, {
            nombre: sanitizedNombre,
            whatsapp: formatWhatsApp(editWhatsapp.trim()),
            cuota: cuotaNum,
            diaVencimiento: editDiaVenc,
            plan: editPlan,
            estado: editEstado,
            fechaRegistro: editFechaRegistro ? new Date(editFechaRegistro + 'T12:00:00Z').toISOString() : editAlumno.fechaRegistro,
        });
        showToast(`✅ Alumno ${sanitizedNombre} actualizado`, 'success');
        closeEdit();
    };

    // Conteo por situación para pestañas
    const conteosPorEstado = useMemo(() => {
        const counts: Record<string, number> = { activo: 0, becado: 0, suspendido: 0, inactivo: 0 };
        alumnos.forEach((a) => {
            const st = a.estado || 'activo';
            counts[st] = (counts[st] || 0) + 1;
        });
        return counts;
    }, [alumnos]);

    // Resumen anual de cuotas para el alumno
    const getResumenAnualAlumno = (alumnoId: string) => {
        const pagosAlu = pagos.filter((p) => p.alumnoId === alumnoId && p.anio === anio && p.estado === 'pagado');
        const mesesPagadosCount = pagosAlu.length;
        const mesesEvaluados = mes;
        let pendientesEnElAnio = 0;
        for (let m = 1; m <= mes; m++) {
            const estaPagado = pagosAlu.some((p) => p.mes === m);
            if (!estaPagado) pendientesEnElAnio++;
        }
        const alDia = pendientesEnElAnio === 0;
        return { mesesPagadosCount, mesesEvaluados, pendientesEnElAnio, alDia };
    };

    const filteredAlumnos = useMemo(() => {
        let list = alumnos;
        if (tabSituacion !== 'todos') {
            list = list.filter((a) => (a.estado || 'activo') === tabSituacion);
        }
        if (!busqueda.trim()) return list;
        const q = busqueda.toLowerCase();
        return list.filter((a) =>
            a.nombre.toLowerCase().includes(q) ||
            a.whatsapp.includes(q)
        );
    }, [alumnos, tabSituacion, busqueda]);

    const todosSeleccionados = filteredAlumnos.length > 0 && filteredAlumnos.every(a => seleccionados.includes(a.id));
    
    const toggleSeleccion = (id: string) => {
        setSeleccionados(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const toggleTodos = () => {
        if (todosSeleccionados) {
            setSeleccionados([]);
        } else {
            setSeleccionados(filteredAlumnos.map(a => a.id));
        }
    };

    const eliminarSeleccionados = () => {
        if (seleccionados.length === 0) return;
        const mensaje = seleccionados.length === 1 
            ? '¿Eliminar 1 alumno seleccionado?' 
            : `¿Eliminar ${seleccionados.length} alumnos seleccionados?`;
        if (window.confirm(`${mensaje}\n\nEsta acción no se puede deshacer.`)) {
            seleccionados.forEach(id => removeAlumno(id));
            setSeleccionados([]);
        }
    };

    const getEstadoPago = (alumnoId: string) => {
        const pago = pagos.find((p) => p.alumnoId === alumnoId && p.mes === mes && p.anio === anio);
        if (!pago) return 'pendiente';
        return pago.estado;
    };

    useEffect(() => {
        const diaEnvio = config.diaEnvio || 5;
        if (now.getDate() >= diaEnvio && pendientes.length > 0) {
            setReminder(true);
        }
    }, []);

    return (
        <>
            <div className="page-header">
                <h1>📊 <span className="header-accent">Dashboard</span></h1>
                <p>Resumen general de Mutantes Fight Team — {MONTH_NAMES[mes - 1]} {anio}</p>
            </div>

            {/* Auto-reminder Banner */}
            {reminder && (
                <div className="card dashboard-reminder-banner">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div>
                            <h3 style={{ color: '#f59e0b', marginBottom: 2 }}>
                                🔔 Hay {pendientes.length} alumnos sin pagar {MONTH_NAMES[mes - 1]}
                            </h3>
                            <p style={{ fontSize: '0.82rem', color: 'rgba(134,239,172,0.6)' }}>
                                El día de envío configurado es el {config.diaEnvio} de cada mes
                            </p>
                        </div>
                        <div className="dashboard-reminder-actions">
                            <a href="#/recordatorios" className="btn btn-primary">
                                📱 Recordatorios
                            </a>
                            <button className="btn btn-secondary" onClick={() => setReminder(false)}>
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon green">🥋</div>
                    <div className="stat-info">
                        <h3>{alumnos.length}</h3>
                        <p>Alumnos Registrados</p>
                        <div className="stat-trend up">↑ Activos</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon lime">✅</div>
                    <div className="stat-info">
                        <h3>{mensajesEnviados}</h3>
                        <p>Mensajes Enviados</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon orange">⏳</div>
                    <div className="stat-info">
                        <h3>{pendientes.length}</h3>
                        <p>Cuotas Pendientes</p>
                        <div className="stat-trend down">— {MONTH_NAMES[mes - 1]}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon emerald">💰</div>
                    <div className="stat-info">
                        <h3 style={{ fontSize: statFontSize(formatCurrency(totalRecaudado)) }}>
                            {formatCurrency(totalRecaudado)}
                        </h3>
                        <p>Recaudado ({MONTH_NAMES[mes - 1]})</p>
                    </div>
                </div>
            </div>

            {/* Historial Mensual */}
            <div className="card" style={{ animationDelay: '0.15s', marginBottom: 'var(--space-2xl)' }}>
                <h2 className="section-title">📅 Historial de Recaudación Mensual</h2>
                <div className="history-grid">
                    {historialMensual.length === 0 ? (
                        <p style={{ color: 'var(--text-dim)', fontStyle: 'italic', padding: 'var(--space-md) 0' }}>
                            No se registran cobros realizados aún.
                        </p>
                    ) : (
                        historialMensual.map((item) => (
                            <div key={`${item.anio}-${item.mes}`} className="history-card-item">
                                <span className="history-date">
                                    {MONTH_NAMES[item.mes - 1]} {item.anio}
                                </span>
                                <strong className="history-amount">
                                    {formatCurrency(item.total)}
                                </strong>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <h2 className="section-title">⚡ Acciones Rápidas</h2>
            <div className="quick-actions">
                <a href="#/registrar" className="action-card">
                    <div className="action-icon">🥋</div>
                    <h3>Nuevo Alumno</h3>
                    <p>Registrá un nuevo alumno con su plan y datos de contacto</p>
                </a>
                <a href="#/cobrar" className="action-card">
                    <div className="action-icon">💳</div>
                    <h3>Cobrar Cuota</h3>
                    <p>Enviá un aviso de cobro por WhatsApp de forma directa</p>
                </a>
                <a href="#/recordatorios" className="action-card">
                    <div className="action-icon">🔔</div>
                    <h3>Recordatorios</h3>
                    <p>Avisale a los alumnos que deben abonar su cuota</p>
                </a>
            </div>

            {/* Alumnos Table with Payment Status */}
            <div className="card" style={{ animationDelay: '0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: 'var(--space-md)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <h2 className="section-title" style={{ margin: 0 }}>🥋 Alumnos — Estado de Pago ({MONTH_NAMES[mes - 1]})</h2>
                        {seleccionados.length > 0 && (
                            <button 
                                className="btn btn-danger" 
                                style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                                onClick={eliminarSeleccionados}
                            >
                                🗑️ Eliminar ({seleccionados.length})
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        {/* Selector de modo de vista: Tarjetas móviles vs Tabla */}
                        <div className="view-mode-toggle">
                            <button
                                type="button"
                                className={vistaModo === 'tarjetas' ? 'active' : ''}
                                onClick={() => setVistaModo('tarjetas')}
                                title="Vista rápida en tarjetas para móvil"
                            >
                                📱 Tarjetas
                            </button>
                            <button
                                type="button"
                                className={vistaModo === 'tabla' ? 'active' : ''}
                                onClick={() => setVistaModo('tabla')}
                                title="Vista completa en tabla clásica"
                            >
                                📄 Tabla
                            </button>
                        </div>

                        <div style={{ position: 'relative', minWidth: 190 }}>
                            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
                            <input
                                className="form-input"
                                style={{ paddingLeft: 34, margin: 0, width: '100%' }}
                                placeholder="Buscar alumno..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Pestañas de Situación de Alumnos */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: 'var(--space-lg)', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(34,197,94,0.1)' }}>
                    <button
                        type="button"
                        onClick={() => setTabSituacion('todos')}
                        className={`btn ${tabSituacion === 'todos' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '5px 14px', fontSize: '0.82rem' }}
                    >
                        👥 Todos ({alumnos.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setTabSituacion('activo')}
                        className={`btn ${tabSituacion === 'activo' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{
                            padding: '5px 14px',
                            fontSize: '0.82rem',
                            borderColor: tabSituacion === 'activo' ? undefined : 'rgba(34,197,94,0.3)',
                            background: tabSituacion === 'activo' ? undefined : 'rgba(34,197,94,0.06)',
                        }}
                    >
                        ✅ Activos ({conteosPorEstado.activo})
                    </button>
                    <button
                        type="button"
                        onClick={() => setTabSituacion('becado')}
                        className={`btn ${tabSituacion === 'becado' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '5px 14px', fontSize: '0.82rem' }}
                    >
                        🎓 Becados ({conteosPorEstado.becado})
                    </button>
                    <button
                        type="button"
                        onClick={() => setTabSituacion('suspendido')}
                        className={`btn ${tabSituacion === 'suspendido' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '5px 14px', fontSize: '0.82rem' }}
                    >
                        ⏸️ Suspendidos ({conteosPorEstado.suspendido})
                    </button>
                    <button
                        type="button"
                        onClick={() => setTabSituacion('inactivo')}
                        className={`btn ${tabSituacion === 'inactivo' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '5px 14px', fontSize: '0.82rem' }}
                    >
                        ❌ Inactivos ({conteosPorEstado.inactivo})
                    </button>
                </div>

                {/* ── Vista en Tarjetas para Móviles ── */}
                {vistaModo === 'tarjetas' ? (
                    <div className="alumnos-mobile-container">
                        {filteredAlumnos.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 'var(--space-xl)' }}>
                                No hay alumnos registrados con el filtro seleccionado.
                            </div>
                        ) : (
                            filteredAlumnos.map((a) => {
                                const estadoPago = getEstadoPago(a.id);
                                const isSelected = seleccionados.includes(a.id);
                                const estadoAlumno = a.estado || 'activo';
                                const esActivo = estadoAlumno === 'activo';
                                const resumenAnual = esActivo ? getResumenAnualAlumno(a.id) : null;
                                const fechaAltaFormatted = a.fechaRegistro
                                    ? new Date(a.fechaRegistro).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                    : null;

                                return (
                                    <div key={a.id} className={`alumno-mobile-card ${isSelected ? 'selected' : ''}`}>
                                        {/* Header de la tarjeta: Checkbox + Nombre + Badge de Pago */}
                                        <div className="alumno-mobile-card-header">
                                            <div className="alumno-mobile-name-row">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSeleccion(a.id)}
                                                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                                                    title="Seleccionar alumno"
                                                />
                                                <span
                                                    className="alumno-mobile-name"
                                                    onClick={() => openEdit(a)}
                                                    style={{ cursor: 'pointer' }}
                                                    title="Click para editar alumno"
                                                >
                                                    {a.nombre}
                                                </span>
                                            </div>
                                            <span className={`badge ${estadoPago}`} style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                                                {estadoPago === 'pagado' ? '✓ Pagado' : estadoPago === 'vencido' ? '✗ Vencido' : '⏳ Pendiente'}
                                            </span>
                                        </div>

                                        {/* Chips: Plan, Cuota, Alta, Situación */}
                                        <div className="alumno-mobile-chips">
                                            <span className="alumno-chip plan">
                                                {a.plan === 'libre' ? '🔥 Libre' : '💪 3x Sem.'}
                                            </span>
                                            <span className="alumno-chip">
                                                💰 <strong>{formatCurrency(a.cuota)}</strong> (día {a.diaVencimiento ?? config.diaEnvio ?? 5})
                                            </span>
                                            {fechaAltaFormatted && (
                                                <span className="alumno-chip alta" title="Fecha en que se dio de alta">
                                                    📅 Alta: {fechaAltaFormatted}
                                                </span>
                                            )}
                                            <select
                                                className="form-select"
                                                value={estadoAlumno}
                                                onChange={(e) => updateAlumno(a.id, { estado: e.target.value as EstadoAlumno })}
                                                style={{
                                                    padding: '2px 6px',
                                                    fontSize: '0.72rem',
                                                    borderRadius: 6,
                                                    background: estadoAlumno === 'activo' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                                                    borderColor: estadoAlumno === 'activo' ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)',
                                                    color: estadoAlumno === 'activo' ? '#4ade80' : '#fbbf24',
                                                }}
                                            >
                                                {Object.entries(ESTADO_LABELS).map(([val, lab]) => (
                                                    <option key={val} value={val}>{lab}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Resumen Anual de Cuotas (Clickable para abrir Historial) */}
                                        {esActivo && resumenAnual && (
                                            <div>
                                                <span
                                                    className={`alumno-chip ${resumenAnual.alDia ? 'al-dia' : 'debt'}`}
                                                    onClick={() => openHistorial(a)}
                                                    title="Click para ver el historial detallado de pagos"
                                                    style={{ fontSize: '0.74rem', width: '100%', justifyContent: 'space-between', padding: '4px 8px' }}
                                                >
                                                    <span>
                                                        {resumenAnual.alDia
                                                            ? `✓ Al día (${resumenAnual.mesesPagadosCount}/${resumenAnual.mesesEvaluados} meses)`
                                                            : `⚠️ Adeuda ${resumenAnual.pendientesEnElAnio} ${resumenAnual.pendientesEnElAnio === 1 ? 'cuota' : 'cuotas'} (${resumenAnual.mesesPagadosCount}/${resumenAnual.mesesEvaluados} pagadas)`}
                                                    </span>
                                                    <span style={{ opacity: 0.75 }}>Ver meses →</span>
                                                </span>
                                            </div>
                                        )}

                                        {/* Acciones directas para móvil con 1 toque */}
                                        <div className="alumno-mobile-actions">
                                            {estadoPago !== 'pagado' ? (
                                                <button
                                                    className="btn btn-success btn-pay"
                                                    onClick={() => marcarPagado(a.id, mes, anio)}
                                                >
                                                    ✓ Marcar Pagó
                                                </button>
                                            ) : (
                                                <button
                                                    className="btn btn-secondary btn-pay"
                                                    onClick={() => marcarPendiente(a.id, mes, anio)}
                                                >
                                                    ↩ Deshacer
                                                </button>
                                            )}
                                            {esActivo && (
                                                <button
                                                    className="btn btn-secondary btn-tool"
                                                    style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', borderColor: 'rgba(34,197,94,0.3)' }}
                                                    onClick={() => openHistorial(a)}
                                                    title="Historial de cuotas"
                                                >
                                                    📜
                                                </button>
                                            )}
                                            <a
                                                href={`https://wa.me/${a.whatsapp}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-secondary btn-tool"
                                                style={{ background: 'rgba(37,211,102,0.12)', color: '#25D366', borderColor: 'rgba(37,211,102,0.3)' }}
                                                title="Enviar WhatsApp"
                                            >
                                                💬
                                            </a>
                                            <button
                                                className="btn btn-secondary btn-tool"
                                                style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', borderColor: 'rgba(59,130,246,0.3)' }}
                                                onClick={() => openEdit(a)}
                                                title="Editar alumno"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                className="btn btn-secondary btn-tool"
                                                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                                                onClick={() => {
                                                    if (window.confirm(`¿Estás seguro de eliminar a ${a.nombre}?`)) {
                                                        removeAlumno(a.id);
                                                    }
                                                }}
                                                title="Eliminar alumno"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : (
                    /* ── Vista Clásica en Tabla Completa ── */
                    <div style={{ overflowX: 'auto' }}>
                        <table className="preview-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 40, textAlign: 'center' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={todosSeleccionados}
                                            onChange={toggleTodos}
                                            title="Seleccionar todos"
                                            style={{ cursor: 'pointer', width: 16, height: 16 }}
                                        />
                                    </th>
                                    <th>Nombre</th>
                                    <th className="col-hide-mobile">Fecha Alta</th>
                                    <th>Plan</th>
                                    <th>WhatsApp</th>
                                    <th>Cuota</th>
                                    <th>Día Vcto.</th>
                                    <th>Estado {MONTH_NAMES[mes - 1]}</th>
                                    <th>Situación</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>
                        <tbody>
                            {filteredAlumnos.length === 0 ? (
                                <tr>
                                    <td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 'var(--space-xl)' }}>
                                        No hay alumnos registrados con el filtro seleccionado.
                                    </td>
                                </tr>
                            ) : filteredAlumnos.map((a) => {
                                const estadoPago = getEstadoPago(a.id);
                                const isSelected = seleccionados.includes(a.id);
                                const estadoAlumno = a.estado || 'activo';
                                const esActivo = estadoAlumno === 'activo';
                                const resumenAnual = esActivo ? getResumenAnualAlumno(a.id) : null;

                                return (
                                    <tr key={a.id} style={{ background: isSelected ? 'rgba(34, 197, 94, 0.1)' : estadoAlumno !== 'activo' ? 'rgba(100,100,100,0.1)' : undefined }}>
                                        <td style={{ textAlign: 'center' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={isSelected}
                                                onChange={() => toggleSeleccion(a.id)}
                                                style={{ cursor: 'pointer', width: 16, height: 16 }}
                                            />
                                        </td>
                                        <td>
                                            <strong>{a.nombre}</strong>
                                            {a.fechaRegistro && (
                                                <div style={{ fontSize: '0.72rem', color: 'rgba(134,239,172,0.7)', marginTop: 2 }}>
                                                    📅 Alta: {new Date(a.fechaRegistro).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </div>
                                            )}
                                            {esActivo && resumenAnual && (
                                                <div style={{ marginTop: 3 }}>
                                                    <span
                                                        onClick={() => openHistorial(a)}
                                                        style={{
                                                            fontSize: '0.72rem',
                                                            cursor: 'pointer',
                                                            color: resumenAnual.alDia ? '#4ade80' : '#f59e0b',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 4,
                                                            transition: 'opacity 0.15s',
                                                        }}
                                                        title="Hacé click para ver el historial detallado de pagos"
                                                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.75')}
                                                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                                                    >
                                                        {resumenAnual.alDia
                                                            ? `✓ Al día (${resumenAnual.mesesPagadosCount}/${resumenAnual.mesesEvaluados} meses)`
                                                            : `⚠️ Adeuda ${resumenAnual.pendientesEnElAnio} ${resumenAnual.pendientesEnElAnio === 1 ? 'cuota' : 'cuotas'} (${resumenAnual.mesesPagadosCount}/${resumenAnual.mesesEvaluados} pagadas)`}
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="col-hide-mobile">
                                            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap' }} title="Fecha en que se dio de alta al alumno">
                                                {a.fechaRegistro ? (
                                                    new Date(a.fechaRegistro).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                                ) : (
                                                    <span style={{ color: 'var(--text-dim)' }}>—</span>
                                                )}
                                            </span>
                                        </td>
                                        <td>{a.plan === 'libre' ? '🔥 Libre' : '💪 3x Sem.'}</td>
                                        <td>+{a.whatsapp}</td>
                                        <td>{formatCurrency(a.cuota)}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span style={{ fontSize: '0.8rem', color: 'rgba(134,239,172,0.6)' }}>
                                                día {a.diaVencimiento ?? config.diaEnvio ?? 5}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`badge ${estadoPago}`}>
                                                {estadoPago === 'pagado' ? '✓ Pagado' : estadoPago === 'vencido' ? '✗ Vencido' : '⏳ Pendiente'}
                                            </span>
                                        </td>
                                        <td>
                                            <select 
                                                className="form-select"
                                                value={estadoAlumno}
                                                onChange={(e) => updateAlumno(a.id, { estado: e.target.value as EstadoAlumno })}
                                                style={{ 
                                                    padding: '2px 6px', 
                                                    fontSize: '0.75rem', 
                                                    minWidth: 100,
                                                    background: estadoAlumno === 'activo' ? 'rgba(34,197,94,0.1)' : 
                                                               estadoAlumno === 'becado' ? 'rgba(168,85,247,0.1)' :
                                                               estadoAlumno === 'suspendido' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                                                    borderColor: estadoAlumno === 'activo' ? 'rgba(34,197,94,0.3)' : 
                                                                 estadoAlumno === 'becado' ? 'rgba(168,85,247,0.3)' :
                                                                 estadoAlumno === 'suspendido' ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)',
                                                }}
                                            >
                                                {Object.entries(ESTADO_LABELS).map(([value, label]) => (
                                                    <option key={value} value={value}>{label}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                {estadoPago !== 'pagado' ? (
                                                    <button className="btn btn-success" style={{ padding: '2px 10px', fontSize: '0.75rem' }}
                                                        onClick={() => marcarPagado(a.id, mes, anio)}>
                                                        ✓ Pagó
                                                    </button>
                                                ) : (
                                                    <button className="btn btn-secondary" style={{ padding: '2px 10px', fontSize: '0.75rem' }}
                                                        onClick={() => marcarPendiente(a.id, mes, anio)}>
                                                        ↩ Deshacer
                                                    </button>
                                                )}
                                                {esActivo && (
                                                    <button
                                                        className="btn btn-secondary"
                                                        style={{
                                                            padding: '2px 8px',
                                                            fontSize: '0.75rem',
                                                            background: 'rgba(34,197,94,0.12)',
                                                            color: '#4ade80',
                                                            borderColor: 'rgba(34,197,94,0.35)',
                                                            fontWeight: 600,
                                                        }}
                                                        title="Ver historial mensual y registrar pagos"
                                                        onClick={() => openHistorial(a)}
                                                    >
                                                        📜 Historial
                                                    </button>
                                                )}
                                                <button
                                                    className="btn btn-secondary"
                                                    style={{ padding: '2px 10px', fontSize: '0.75rem', background: 'rgba(59,130,246,0.12)', color: '#60a5fa', borderColor: 'rgba(59,130,246,0.3)' }}
                                                    title="Editar alumno"
                                                    onClick={() => openEdit(a)}
                                                >
                                                    ✏️
                                                </button>
                                                <button className="btn btn-secondary" style={{ padding: '2px 10px', fontSize: '0.75rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                                                    onClick={() => { if (window.confirm(`¿Estás seguro de eliminar a ${a.nombre}? Esta acción no se puede deshacer.`)) removeAlumno(a.id) }}>
                                                    🗑️
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                className="form-input"
                                                style={{ padding: '2px 6px', fontSize: '0.75rem', margin: 0, height: 24, width: '100%', minWidth: 150 }}
                                                placeholder="Notas (ej. inasistencia)..."
                                                value={a.notas || ''}
                                                onChange={(e) => updateAlumno(a.id, { notas: e.target.value })}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            </div>

            {/* Activity */}
            <div className="card mt-2" style={{ animationDelay: '0.3s' }}>
                <h2 className="section-title">🕐 Actividad Reciente</h2>
                <ul className="activity-list">
                    {activity.length === 0 ? (
                        <li className="activity-item" style={{ justifyContent: 'center', color: 'var(--text-dim)', padding: 'var(--space-xl)' }}>
                            No hay actividad registrada aún.
                        </li>
                    ) : activity.slice(0, 10).map((a, i) => (
                        <li className="activity-item" key={i}>
                            <span className={`activity-dot ${a.type}`}></span>
                            <div className="activity-content">
                                <p>{a.message}</p>
                                <span className="activity-time">{timeAgo(a.timestamp)}</span>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
            {/* ── Modal de Edición de Alumno ─────────────────────────────────── */}
            {editAlumno && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 1000,
                        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 'var(--space-lg)',
                        animation: 'fadeInUp 0.25s ease',
                    }}
                    onClick={(e) => { if (e.target === e.currentTarget) closeEdit(); }}
                >
                    <div style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-xl)',
                        width: '100%',
                        maxWidth: 520,
                        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                    }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
                            <h3 style={{ color: 'var(--accent-green)', fontFamily: 'Montserrat, sans-serif', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                                🥋 Alumno: <span style={{ fontSize: '1rem', color: '#f0fdf4', fontWeight: 600 }}>{editAlumno.nombre}</span>
                            </h3>
                            <button
                                onClick={closeEdit}
                                style={{ background: 'none', border: 'none', color: 'rgba(134,239,172,0.5)', fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1, padding: 4 }}
                                title="Cerrar"
                            >✕</button>
                        </div>

                        {/* Pestañas del Alumno */}
                        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(34,197,94,0.15)', marginBottom: 'var(--space-lg)' }}>
                            <button
                                type="button"
                                onClick={() => setEditModalTab('datos')}
                                style={{
                                    background: editModalTab === 'datos' ? 'rgba(34,197,94,0.12)' : 'transparent',
                                    color: editModalTab === 'datos' ? '#4ade80' : 'rgba(134,239,172,0.6)',
                                    border: 'none',
                                    borderBottom: editModalTab === 'datos' ? '2px solid #22c55e' : '2px solid transparent',
                                    padding: '8px 16px',
                                    fontSize: '0.88rem',
                                    fontWeight: editModalTab === 'datos' ? 600 : 400,
                                    cursor: 'pointer',
                                    borderRadius: '6px 6px 0 0',
                                }}
                            >
                                ✏️ Datos del Alumno
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (editAlumno.estado === 'activo') {
                                        openHistorial(editAlumno);
                                        closeEdit();
                                    } else {
                                        showToast(`ℹ️ El historial de cuotas mensuales aplica a alumnos con situación Activo (situación actual: ${editAlumno.estado})`, 'info');
                                    }
                                }}
                                style={{
                                    background: 'transparent',
                                    color: editAlumno.estado === 'activo' ? '#22c55e' : 'rgba(134,239,172,0.4)',
                                    border: 'none',
                                    borderBottom: '2px solid transparent',
                                    padding: '8px 16px',
                                    fontSize: '0.88rem',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                }}
                                title={editAlumno.estado === 'activo' ? 'Ver y registrar cuotas mensuales de este alumno' : 'Solo disponible para alumnos en situación activo'}
                            >
                                📜 Historial de Pagos
                                {editAlumno.estado === 'activo' && (
                                    <span style={{ fontSize: '0.68rem', background: 'rgba(34,197,94,0.25)', color: '#22c55e', padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>
                                        Abrir ↗
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Nombre */}
                        <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
                            <label>👤 Nombre</label>
                            <input
                                type="text"
                                className="form-input"
                                value={editNombre}
                                onChange={(e) => setEditNombre(e.target.value)}
                                placeholder="Nombre completo"
                            />
                        </div>

                        {/* WhatsApp */}
                        <div className="form-group">
                            <label>📱 WhatsApp</label>
                            <div className="input-group">
                                <span className="input-prefix">+54</span>
                                <input
                                    type="tel"
                                    className="form-input"
                                    value={editWhatsapp}
                                    onChange={(e) => setEditWhatsapp(e.target.value)}
                                    placeholder="11 2345 6789"
                                />
                            </div>
                            <p className="form-hint">Número sin 0 ni 15, con código de área. Ej: 1123456789</p>
                        </div>

                        {/* Plan y Cuota en fila */}
                        <div className="form-row" style={{ marginBottom: 'var(--space-lg)' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label>📋 Plan</label>
                                <select
                                    className="form-select"
                                    value={editPlan}
                                    onChange={(e) => setEditPlan(e.target.value as 'libre' | '3x')}
                                >
                                    <option value="libre">🔥 Libre</option>
                                    <option value="3x">💪 3x Semana</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label>💰 Cuota $</label>
                                <div className="input-group">
                                    <span className="input-prefix">$</span>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={editCuota}
                                        onChange={(e) => setEditCuota(e.target.value)}
                                        min="0"
                                        step="500"
                                        placeholder="25000"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Día de Vencimiento y Estado en fila */}
                        <div className="form-row" style={{ marginBottom: 'var(--space-md)' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label>📅 Día de Vencimiento</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    min={1}
                                    max={31}
                                    value={editDiaVenc}
                                    onChange={(e) => setEditDiaVenc(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                                />
                                <p className="form-hint">Día del mes (1-31)</p>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label>🎯 Situación</label>
                                <select
                                    className="form-select"
                                    value={editEstado}
                                    onChange={(e) => setEditEstado(e.target.value as EstadoAlumno)}
                                >
                                    {Object.entries(ESTADO_LABELS).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                                <p className="form-hint">Solo "Activo" recibe recordatorios</p>
                            </div>
                        </div>

                        {/* Fecha de Alta / Registro */}
                        <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
                            <label>📅 Fecha de Alta / Registro</label>
                            <input
                                type="date"
                                className="form-input"
                                value={editFechaRegistro}
                                onChange={(e) => setEditFechaRegistro(e.target.value)}
                            />
                            <p className="form-hint">Fecha en que se dio de alta al alumno</p>
                        </div>

                        {/* Botones */}
                        <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-xl)', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" onClick={closeEdit}>Cancelar</button>
                            <button
                                className="btn btn-primary"
                                onClick={saveEdit}
                                style={{ minWidth: 140 }}
                            >
                                💾 Guardar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal de Historial de Pagos de Alumno ──────────────────────── */}
            {isHistorialOpen && alumnoHistorial && (
                <HistorialPagosModal
                    alumno={alumnoHistorial}
                    isOpen={isHistorialOpen}
                    onClose={closeHistorial}
                />
            )}
        </>
    );
}
