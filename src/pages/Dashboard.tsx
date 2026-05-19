import { useStore } from '../store/useStore';
import { MONTH_NAMES, ESTADO_LABELS, type EstadoAlumno, type Alumno } from '../types';
import { formatCurrency } from '../services/evolution';
import { useState, useEffect, useMemo } from 'react';
import { showToast } from '../components/Toast';

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
        return pagos.filter((p) => p.estado === 'pagado').reduce((sum, p) => sum + p.monto, 0);
    }, [pagos]);

    const [busqueda, setBusqueda] = useState('');
    const [seleccionados, setSeleccionados] = useState<string[]>([]);

    // ── Modal de edición ─────────────────────────────────────
    const [editAlumno, setEditAlumno] = useState<Alumno | null>(null);
    const [editNombre, setEditNombre] = useState('');
    const [editWhatsapp, setEditWhatsapp] = useState('');
    const [editCuota, setEditCuota] = useState('');
    const [editDiaVenc, setEditDiaVenc] = useState(5);
    const [editPlan, setEditPlan] = useState<'libre' | '3x'>('libre');
    const [editEstado, setEditEstado] = useState<EstadoAlumno>('activo');

    const openEdit = (a: Alumno) => {
        setEditAlumno(a);
        setEditNombre(a.nombre);
        setEditWhatsapp(a.whatsapp);
        setEditCuota(String(a.cuota));
        setEditDiaVenc(a.diaVencimiento ?? config.diaEnvio ?? 5);
        setEditPlan(a.plan);
        setEditEstado(a.estado || 'activo');
    };

    const closeEdit = () => setEditAlumno(null);

    const saveEdit = () => {
        if (!editAlumno) return;
        const cuotaNum = parseInt(editCuota) || 0;
        updateAlumno(editAlumno.id, {
            nombre: editNombre.trim() || editAlumno.nombre,
            whatsapp: editWhatsapp.trim(),
            cuota: cuotaNum,
            diaVencimiento: editDiaVenc,
            plan: editPlan,
            estado: editEstado,
        });
        showToast(`✅ Alumno ${editNombre.trim() || editAlumno.nombre} actualizado`, 'success');
        closeEdit();
    };

    const filteredAlumnos = useMemo(() => {
        if (!busqueda.trim()) return alumnos;
        const q = busqueda.toLowerCase();
        return alumnos.filter((a) =>
            a.nombre.toLowerCase().includes(q) ||
            a.whatsapp.includes(q)
        );
    }, [alumnos, busqueda]);

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
                <div className="card" style={{
                    borderLeft: '3px solid #f59e0b',
                    marginBottom: 'var(--space-xl)',
                    animation: 'fadeInUp 0.5s ease',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h3 style={{ color: '#f59e0b', marginBottom: 4 }}>
                                🔔 Hay {pendientes.length} alumnos sin pagar {MONTH_NAMES[mes - 1]}
                            </h3>
                            <p style={{ fontSize: '0.9rem', color: 'rgba(134,239,172,0.5)' }}>
                                El día de envío configurado es el {config.diaEnvio} de cada mes
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <a href="#/recordatorios" className="btn btn-primary">
                                📱 Enviar Recordatorios
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
                        <p>Total Recaudado</p>
                    </div>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: 'var(--space-lg)' }}>
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
                    <div style={{ position: 'relative', minWidth: 220 }}>
                        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
                        <input
                            className="form-input"
                            style={{ paddingLeft: 34, margin: 0 }}
                            placeholder="Buscar alumno..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                        />
                    </div>
                </div>
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
                                    <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 'var(--space-xl)' }}>
                                        No hay alumnos registrados. <a href="#/registrar">Registrá uno</a> o <a href="#/registrar">importá un Excel</a>.
                                    </td>
                                </tr>
                            ) : filteredAlumnos.map((a) => {
                                const estadoPago = getEstadoPago(a.id);
                                const isSelected = seleccionados.includes(a.id);
                                const estadoAlumno = a.estado || 'activo';
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
                                        <td><strong>{a.nombre}</strong></td>
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
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-xl)' }}>
                            <h3 style={{ color: 'var(--accent-green)', fontFamily: 'Montserrat, sans-serif', display: 'flex', alignItems: 'center', gap: 8 }}>
                                ✏️ Editar Alumno
                                <span style={{ fontSize: '0.85rem', color: 'rgba(134,239,172,0.5)', fontWeight: 400 }}>{editAlumno.nombre}</span>
                            </h3>
                            <button
                                onClick={closeEdit}
                                style={{ background: 'none', border: 'none', color: 'rgba(134,239,172,0.5)', fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1, padding: 4 }}
                                title="Cerrar"
                            >✕</button>
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
                        <div className="form-row" style={{ marginBottom: 'var(--space-lg)' }}>
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
        </>
    );
}
