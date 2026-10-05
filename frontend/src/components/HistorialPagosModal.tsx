import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { MONTH_NAMES, MONTH_SHORT, type Alumno, type PagoMensual } from '../types';
import { formatCurrency } from '../services/ycloud';
import { showToast } from './Toast';

interface Props {
    alumno: Alumno | null;
    isOpen: boolean;
    onClose: () => void;
}

export default function HistorialPagosModal({ alumno, isOpen, onClose }: Props) {
    const pagos = useStore((s) => s.pagos);
    const registrarPago = useStore((s) => s.registrarPago);
    const marcarPendiente = useStore((s) => s.marcarPendiente);
    const marcarEneAbrPagados = useStore((s) => s.marcarEneAbrPagados);
    const addActivity = useStore((s) => s.addActivity);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12

    const [anioSeleccionado, setAnioSeleccionado] = useState(currentYear);
    const [busqueda, setBusqueda] = useState('');
    const [filtroEstado, setFiltroEstado] = useState<'todos' | 'pagados' | 'pendientes'>('todos');

    // Formulario para registrar pago histórico
    const [formMes, setFormMes] = useState(currentMonth);
    const [formAnio, setFormAnio] = useState(currentYear);
    const [formMonto, setFormMonto] = useState<string>('');
    const [formFecha, setFormFecha] = useState<string>(() => {
        const d = new Date();
        return d.toISOString().split('T')[0]; // YYYY-MM-DD
    });
    const [mostrarFormNuevo, setMostrarFormNuevo] = useState(false);

    const esActivo = alumno ? (alumno.estado || 'activo') === 'activo' : false;

    // Obtener todos los pagos registrados para este alumno
    const pagosAlumno = useMemo(() => {
        if (!alumno) return [];
        return pagos.filter((p) => p.alumnoId === alumno.id);
    }, [pagos, alumno]);

    // Mapa de pagos por clave "mes-anio"
    const pagosMap = useMemo(() => {
        const map = new Map<string, PagoMensual>();
        pagosAlumno.forEach((p) => {
            map.set(`${p.mes}-${p.anio}`, p);
        });
        return map;
    }, [pagosAlumno]);

    // Resumen del año seleccionado
    const estadisticasAnio = useMemo(() => {
        let pagados = 0;
        let pendientes = 0;
        let totalRecaudado = 0;
        const cuotaBase = alumno?.cuota || 0;

        for (let m = 1; m <= 12; m++) {
            const pago = pagosMap.get(`${m}-${anioSeleccionado}`);
            const estaPagado = Boolean(pago && pago.estado === 'pagado');
            if (estaPagado) {
                pagados++;
                totalRecaudado += pago?.monto || cuotaBase;
            } else {
                // Si es el año actual y el mes ya transcurrió o es el actual
                if (anioSeleccionado < currentYear || (anioSeleccionado === currentYear && m <= currentMonth)) {
                    pendientes++;
                }
            }
        }

        const mesesEvaluados = anioSeleccionado < currentYear ? 12 : anioSeleccionado === currentYear ? currentMonth : 0;
        const alDia = pendientes === 0 && mesesEvaluados > 0;

        return {
            pagados,
            pendientes,
            totalRecaudado,
            mesesEvaluados,
            alDia,
        };
    }, [pagosMap, anioSeleccionado, alumno?.cuota, currentYear, currentMonth]);

    // Formatear fecha legible en español
    const formatearFecha = (isoString?: string) => {
        if (!isoString) return '—';
        try {
            const d = new Date(isoString);
            if (isNaN(d.getTime())) return isoString;
            return d.toLocaleDateString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            });
        } catch {
            return isoString;
        }
    };

    // Registrar o alternar pago
    const handleMarcarPagadoRapido = (mes: number, anio: number) => {
        if (!alumno) return;
        const monto = alumno.cuota || 0;
        const fechaActual = new Date().toISOString();
        registrarPago(alumno.id, mes, anio, monto, fechaActual);
        showToast(`✅ Pago de ${MONTH_NAMES[mes - 1]} ${anio} registrado (${formatCurrency(monto)})`, 'success');
        addActivity('payment', `Pago registrado: ${alumno.nombre} - ${MONTH_NAMES[mes - 1]} ${anio} (${formatCurrency(monto)})`);
    };

    const handleMarcarPendiente = (mes: number, anio: number) => {
        if (!alumno) return;
        marcarPendiente(alumno.id, mes, anio);
        showToast(`↩ Pago de ${MONTH_NAMES[mes - 1]} ${anio} marcado como pendiente`, 'info');
        addActivity('payment', `Pago deshecho a pendiente: ${alumno.nombre} - ${MONTH_NAMES[mes - 1]} ${anio}`);
    };

    // Guardar desde el formulario manual
    const handleGuardarPagoManual = (e: React.FormEvent) => {
        e.preventDefault();
        if (!alumno) return;
        const montoNum = parseInt(formMonto) || alumno.cuota || 0;
        if (montoNum <= 0) {
            showToast('⚠️ Ingresá un monto válido mayor a 0', 'warning');
            return;
        }

        const fechaIso = formFecha ? new Date(formFecha + 'T12:00:00Z').toISOString() : new Date().toISOString();
        registrarPago(alumno.id, formMes, formAnio, montoNum, fechaIso);

        showToast(`✅ Pago histórico guardado: ${MONTH_NAMES[formMes - 1]} ${formAnio} (${formatCurrency(montoNum)})`, 'success');
        addActivity('payment', `Pago histórico registrado: ${alumno.nombre} - ${MONTH_NAMES[formMes - 1]} ${formAnio} (${formatCurrency(montoNum)})`);
        setMostrarFormNuevo(false);
    };

    // Marcar cuotas iniciales (Enero, Febrero, Marzo, Abril) como pagadas
    const handleMarcarEneAbr = async () => {
        if (!alumno) return;
        await marcarEneAbrPagados(alumno.id, anioSeleccionado);
        showToast(`✅ Cuotas de Enero a Abril ${anioSeleccionado} marcadas como pagadas para ${alumno.nombre}`, 'success');
        addActivity('payment', `Regularización Ene-Abr ${anioSeleccionado} como pagados: ${alumno.nombre}`);
    };

    // Abrir formulario para un mes específico
    const abrirFormularioParaMes = (mes: number) => {
        if (!alumno) return;
        setFormMes(mes);
        setFormAnio(anioSeleccionado);
        const pagoExistente = pagosMap.get(`${mes}-${anioSeleccionado}`);
        setFormMonto(String(pagoExistente?.monto || alumno.cuota || ''));
        if (pagoExistente?.fechaPago) {
            setFormFecha(pagoExistente.fechaPago.split('T')[0]);
        } else {
            setFormFecha(new Date().toISOString().split('T')[0]);
        }
        setMostrarFormNuevo(true);
    };

    // Lista de meses del año filtrados por búsqueda y estado
    const mesesVisualizables = useMemo(() => {
        if (!alumno) return [];
        const items = [];
        for (let m = 1; m <= 12; m++) {
            const pago = pagosMap.get(`${m}-${anioSeleccionado}`);
            const estaPagado = Boolean(pago && pago.estado === 'pagado');
            const esPasadoOActual = anioSeleccionado < currentYear || (anioSeleccionado === currentYear && m <= currentMonth);
            const esFuturo = anioSeleccionado > currentYear || (anioSeleccionado === currentYear && m > currentMonth);

            const estado = estaPagado ? 'pagado' : esPasadoOActual ? 'pendiente' : 'futuro';

            // Filtrado por estado
            if (filtroEstado === 'pagados' && !estaPagado) continue;
            if (filtroEstado === 'pendientes' && (estaPagado || esFuturo)) continue;

            // Filtrado por búsqueda de texto
            const nombreMes = MONTH_NAMES[m - 1].toLowerCase();
            const abreviatura = MONTH_SHORT[m - 1].toLowerCase();
            const q = busqueda.trim().toLowerCase();
            if (q) {
                const coincideMes = nombreMes.includes(q) || abreviatura.includes(q);
                const coincideEstado = (estaPagado && 'pagado'.includes(q)) || (!estaPagado && 'pendiente'.includes(q));
                const coincideMonto = pago && String(pago.monto).includes(q);
                const coincideFecha = pago?.fechaPago && pago.fechaPago.includes(q);
                if (!coincideMes && !coincideEstado && !coincideMonto && !coincideFecha) {
                    continue;
                }
            }

            items.push({
                mes: m,
                nombreMes: MONTH_NAMES[m - 1],
                abreviatura: MONTH_SHORT[m - 1],
                pago,
                estaPagado,
                estado,
                esPasadoOActual,
                esFuturo,
            });
        }
        return items;
    }, [pagosMap, anioSeleccionado, currentYear, currentMonth, filtroEstado, busqueda, alumno]);

    // Historial cronológico completo de pagos realizados
    const historialPagosRealizados = useMemo(() => {
        return pagosAlumno
            .filter((p) => p.estado === 'pagado')
            .sort((a, b) => {
                if (a.anio !== b.anio) return b.anio - a.anio;
                return b.mes - a.mes;
            });
    }, [pagosAlumno]);

    // Retorno condicional DEPUES de haber ejecutado todos los hooks de React
    if (!isOpen || !alumno) {
        return null;
    }

    return (
        <div
            className="historial-modal-backdrop"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="historial-modal-content">
                {/* ─── Encabezado del Modal ─── */}
                <div className="historial-modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                        <div
                            style={{
                                width: 44,
                                height: 44,
                                minWidth: 44,
                                borderRadius: 12,
                                background: 'rgba(34,197,94,0.15)',
                                border: '1px solid rgba(34,197,94,0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.4rem',
                            }}
                        >
                            🥋
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <h2 style={{ fontSize: '1.15rem', margin: 0, color: '#f0fdf4', fontWeight: 700, wordBreak: 'break-word' }}>
                                    {alumno.nombre}
                                </h2>
                                <span
                                    style={{
                                        fontSize: '0.72rem',
                                        padding: '2px 8px',
                                        borderRadius: 6,
                                        background: esActivo ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                                        color: esActivo ? '#4ade80' : '#f87171',
                                        border: `1px solid ${esActivo ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {esActivo ? '✅ Activo' : `⚠️ ${alumno.estado || 'activo'}`}
                                </span>
                            </div>
                            <div
                                className="historial-meta-row"
                                style={{
                                    fontSize: '0.8rem',
                                    color: 'rgba(134,239,172,0.7)',
                                    marginTop: 4,
                                    display: 'flex',
                                    gap: '0.5rem 1rem',
                                    flexWrap: 'wrap',
                                }}
                            >
                                <span>📋 Plan: <strong style={{ color: '#86efac' }}>{alumno.plan === 'libre' ? 'Libre' : '3x Sem.'}</strong></span>
                                <span>💰 Cuota: <strong style={{ color: '#4ade80' }}>{formatCurrency(alumno.cuota || 0)}</strong></span>
                                <span>📱 +{alumno.whatsapp}</span>
                                <span>📅 Alta: <strong style={{ color: '#4ade80' }}>{formatearFecha(alumno.fechaRegistro)}</strong></span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 8,
                            color: 'rgba(134,239,172,0.8)',
                            fontSize: '1.2rem',
                            cursor: 'pointer',
                            width: 34,
                            height: 34,
                            minWidth: 34,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease',
                        }}
                        title="Cerrar ventana"
                    >
                        ✕
                    </button>
                </div>

                {/* ─── Aviso si no está en situación "activo" ─── */}
                {!esActivo && (
                    <div
                        style={{
                            background: 'rgba(245, 158, 11, 0.12)',
                            borderLeft: '4px solid #f59e0b',
                            padding: '10px 16px',
                            margin: '12px 20px 0 20px',
                            borderRadius: 6,
                            fontSize: '0.88rem',
                            color: '#fbbf24',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}
                    >
                        <span>ℹ️</span>
                        <span>
                            Este alumno se encuentra actualmente en situación <strong>{(alumno.estado || '').toUpperCase()}</strong>.
                            El seguimiento activo de cuotas y recordatorios aplica a alumnos en situación <strong>"Activo"</strong>.
                        </span>
                    </div>
                )}

                {/* ─── Contenido Scrollable ─── */}
                <div className="historial-modal-body">
                    {/* Barra de control superior: Selector de Año + Resumen Anual */}
                    <div
                        style={{
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(34,197,94,0.12)',
                            borderRadius: 'var(--radius-md)',
                            padding: '0.85rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                            {/* Selector de Año */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.85rem', color: 'rgba(134,239,172,0.8)', fontWeight: 600 }}>
                                    📅 Año:
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', background: '#080c08', borderRadius: 8, border: '1px solid rgba(34,197,94,0.2)' }}>
                                    <button
                                        type="button"
                                        onClick={() => setAnioSeleccionado((prev) => prev - 1)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#22c55e',
                                            padding: '4px 10px',
                                            cursor: 'pointer',
                                            fontSize: '1rem',
                                            fontWeight: 'bold',
                                        }}
                                        title="Año anterior"
                                    >
                                        ◀
                                    </button>
                                    <span style={{ padding: '4px 12px', fontWeight: 700, color: '#f0fdf4', fontSize: '1rem', minWidth: 50, textAlign: 'center' }}>
                                        {anioSeleccionado}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setAnioSeleccionado((prev) => prev + 1)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#22c55e',
                                            padding: '4px 10px',
                                            cursor: 'pointer',
                                            fontSize: '1rem',
                                            fontWeight: 'bold',
                                        }}
                                        title="Año siguiente"
                                    >
                                        ▶
                                    </button>
                                </div>
                                {anioSeleccionado !== currentYear && (
                                    <button
                                        type="button"
                                        onClick={() => setAnioSeleccionado(currentYear)}
                                        className="btn btn-secondary"
                                        style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                                    >
                                        Actual ({currentYear})
                                    </button>
                                )}
                            </div>

                            {/* Botones de acción rápida */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {anioSeleccionado === 2026 && (
                                    <button
                                        type="button"
                                        onClick={handleMarcarEneAbr}
                                        className="btn btn-secondary"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4,
                                            fontSize: '0.78rem',
                                            padding: '5px 10px',
                                            background: 'rgba(59,130,246,0.12)',
                                            color: '#60a5fa',
                                            borderColor: 'rgba(59,130,246,0.3)',
                                            fontWeight: 600,
                                        }}
                                        title="Marcar Enero, Febrero, Marzo y Abril 2026 como pagados"
                                    >
                                        ⚡ Ene-Abr Pagados
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMostrarFormNuevo(!mostrarFormNuevo);
                                        setFormAnio(anioSeleccionado);
                                        setFormMonto(String(alumno.cuota || ''));
                                    }}
                                    className="btn btn-primary"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        fontSize: '0.8rem',
                                        padding: '5px 12px',
                                    }}
                                >
                                    <span>{mostrarFormNuevo ? '✕ Cerrar' : '➕ Pago Histórico'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Tarjetas de Métricas del Año */}
                        <div className="historial-stats-boxes">
                            <div
                                style={{
                                    background: 'rgba(34,197,94,0.08)',
                                    border: '1px solid rgba(34,197,94,0.2)',
                                    borderRadius: 10,
                                    padding: '0.75rem 1rem',
                                }}
                            >
                                <div style={{ fontSize: '0.75rem', color: 'rgba(134,239,172,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Meses Abonados
                                </div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4ade80', marginTop: 2 }}>
                                    {estadisticasAnio.pagados} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'rgba(134,239,172,0.5)' }}>/ 12</span>
                                </div>
                            </div>

                            <div
                                style={{
                                    background: estadisticasAnio.pendientes > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${estadisticasAnio.pendientes > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.08)'}`,
                                    borderRadius: 10,
                                    padding: '0.75rem 1rem',
                                }}
                            >
                                <div style={{ fontSize: '0.75rem', color: estadisticasAnio.pendientes > 0 ? '#fca5a5' : 'rgba(134,239,172,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Cuotas Pendientes
                                </div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: estadisticasAnio.pendientes > 0 ? '#ef4444' : '#a3e635', marginTop: 2 }}>
                                    {estadisticasAnio.pendientes}
                                    <span style={{ fontSize: '0.8rem', fontWeight: 400, marginLeft: 6, color: 'rgba(255,255,255,0.5)' }}>
                                        {estadisticasAnio.pendientes === 0 ? '(Al día ✨)' : '(Por regularizar ⚠️)'}
                                    </span>
                                </div>
                            </div>

                            <div
                                style={{
                                    background: 'rgba(16,185,129,0.08)',
                                    border: '1px solid rgba(16,185,129,0.2)',
                                    borderRadius: 10,
                                    padding: '0.75rem 1rem',
                                }}
                            >
                                <div style={{ fontSize: '0.75rem', color: 'rgba(134,239,172,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Total Pagado en {anioSeleccionado}
                                </div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399', marginTop: 2 }}>
                                    {formatCurrency(estadisticasAnio.totalRecaudado)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ─── Formulario para Registrar / Agregar Pago Histórico ─── */}
                    {mostrarFormNuevo && (
                        <form
                            onSubmit={handleGuardarPagoManual}
                            style={{
                                background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(8,12,8,0.95))',
                                border: '1px solid rgba(34,197,94,0.35)',
                                borderRadius: 'var(--radius-md)',
                                padding: '1.25rem',
                                animation: 'fadeInUp 0.2s ease',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <h4 style={{ margin: 0, color: '#22c55e', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    💳 Registrar Pago de Cuota
                                </h4>
                                <span style={{ fontSize: '0.8rem', color: 'rgba(134,239,172,0.6)' }}>
                                    Podés asentar pagos del mes actual o retroactivos
                                </span>
                            </div>

                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                    gap: '1rem',
                                    alignItems: 'flex-end',
                                }}
                            >
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label style={{ fontSize: '0.8rem' }}>Mes correspondiente</label>
                                    <select
                                        className="form-select"
                                        value={formMes}
                                        onChange={(e) => setFormMes(parseInt(e.target.value))}
                                    >
                                        {MONTH_NAMES.map((name, i) => (
                                            <option key={i + 1} value={i + 1}>
                                                {name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group" style={{ margin: 0 }}>
                                    <label style={{ fontSize: '0.8rem' }}>Año</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={formAnio}
                                        onChange={(e) => setFormAnio(parseInt(e.target.value) || currentYear)}
                                        min={2020}
                                        max={currentYear + 2}
                                    />
                                </div>

                                <div className="form-group" style={{ margin: 0 }}>
                                    <label style={{ fontSize: '0.8rem' }}>Monto abonado ($)</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={formMonto}
                                        onChange={(e) => setFormMonto(e.target.value)}
                                        placeholder={String(alumno.cuota || 0)}
                                        required
                                    />
                                </div>

                                <div className="form-group" style={{ margin: 0 }}>
                                    <label style={{ fontSize: '0.8rem' }}>Fecha en que pagó</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={formFecha}
                                        onChange={(e) => setFormFecha(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setMostrarFormNuevo(false)}
                                    className="btn btn-secondary"
                                    style={{ fontSize: '0.85rem' }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    style={{ fontSize: '0.85rem', padding: '6px 16px' }}
                                >
                                    💾 Guardar en Historial
                                </button>
                            </div>
                        </form>
                    )}

                    {/* ─── Barra de Filtros y Búsqueda en el Historial ─── */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.85rem', color: 'rgba(134,239,172,0.7)', fontWeight: 600 }}>Filtrar:</span>
                            <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: 3, borderRadius: 8, border: '1px solid rgba(34,197,94,0.12)' }}>
                                <button
                                    type="button"
                                    onClick={() => setFiltroEstado('todos')}
                                    style={{
                                        background: filtroEstado === 'todos' ? 'rgba(34,197,94,0.2)' : 'transparent',
                                        color: filtroEstado === 'todos' ? '#4ade80' : 'rgba(134,239,172,0.6)',
                                        border: 'none',
                                        borderRadius: 6,
                                        padding: '4px 10px',
                                        fontSize: '0.78rem',
                                        cursor: 'pointer',
                                        fontWeight: filtroEstado === 'todos' ? 600 : 400,
                                    }}
                                >
                                    Todos (12)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFiltroEstado('pagados')}
                                    style={{
                                        background: filtroEstado === 'pagados' ? 'rgba(34,197,94,0.2)' : 'transparent',
                                        color: filtroEstado === 'pagados' ? '#4ade80' : 'rgba(134,239,172,0.6)',
                                        border: 'none',
                                        borderRadius: 6,
                                        padding: '4px 10px',
                                        fontSize: '0.78rem',
                                        cursor: 'pointer',
                                        fontWeight: filtroEstado === 'pagados' ? 600 : 400,
                                    }}
                                >
                                    ✅ Pagados ({estadisticasAnio.pagados})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFiltroEstado('pendientes')}
                                    style={{
                                        background: filtroEstado === 'pendientes' ? 'rgba(239,68,68,0.2)' : 'transparent',
                                        color: filtroEstado === 'pendientes' ? '#f87171' : 'rgba(134,239,172,0.6)',
                                        border: 'none',
                                        borderRadius: 6,
                                        padding: '4px 10px',
                                        fontSize: '0.78rem',
                                        cursor: 'pointer',
                                        fontWeight: filtroEstado === 'pendientes' ? 600 : 400,
                                    }}
                                >
                                    ⏳ Pendientes ({estadisticasAnio.pendientes})
                                </button>
                            </div>
                        </div>

                        {/* Input de Búsqueda rápida */}
                        <div style={{ position: 'relative', minWidth: 200 }}>
                            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: '0.85rem' }}>🔍</span>
                            <input
                                className="form-input"
                                style={{ paddingLeft: 30, paddingRight: 10, margin: 0, height: 32, fontSize: '0.8rem', width: '100%' }}
                                placeholder="Buscar mes, monto..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* ─── Visualizador de Cuotas Mes a Mes (Año Seleccionado) ─── */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#f0fdf4', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                📅 Estado de Cuotas Mes a Mes — {anioSeleccionado}
                            </h3>
                            <span style={{ fontSize: '0.78rem', color: 'rgba(134,239,172,0.5)' }}>
                                Click en el botón para marcar pagado o revertir a pendiente
                            </span>
                        </div>

                        {mesesVisualizables.length === 0 ? (
                            <div
                                style={{
                                    textAlign: 'center',
                                    padding: '2rem',
                                    background: 'rgba(255,255,255,0.02)',
                                    borderRadius: 8,
                                    color: 'rgba(134,239,172,0.5)',
                                    fontSize: '0.9rem',
                                }}
                            >
                                No se encontraron cuotas con los filtros aplicados.
                            </div>
                        ) : (
                            <div className="historial-meses-grid">
                                {mesesVisualizables.map((item) => {
                                    const { mes, nombreMes, pago, estaPagado, esFuturo } = item;
                                    const esMesActual = anioSeleccionado === currentYear && mes === currentMonth;

                                    return (
                                        <div
                                            key={mes}
                                            className="historial-mes-card"
                                            style={{
                                                background: estaPagado
                                                    ? 'rgba(34, 197, 94, 0.08)'
                                                    : esMesActual
                                                    ? 'rgba(245, 158, 11, 0.08)'
                                                    : esFuturo
                                                    ? 'rgba(255, 255, 255, 0.02)'
                                                    : 'rgba(239, 68, 68, 0.06)',
                                                border: `1px solid ${
                                                    estaPagado
                                                        ? 'rgba(34, 197, 94, 0.35)'
                                                        : esMesActual
                                                        ? 'rgba(245, 158, 11, 0.35)'
                                                        : esFuturo
                                                        ? 'rgba(255, 255, 255, 0.06)'
                                                        : 'rgba(239, 68, 68, 0.25)'
                                                }`,
                                                borderRadius: 10,
                                                padding: '0.75rem',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'space-between',
                                                gap: '0.5rem',
                                                position: 'relative',
                                                boxShadow: estaPagado ? '0 0 12px rgba(34,197,94,0.06)' : undefined,
                                            }}
                                        >
                                            {/* Cabecera del mes */}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <strong style={{ fontSize: '0.95rem', color: estaPagado ? '#4ade80' : '#f0fdf4' }}>
                                                    {nombreMes}
                                                </strong>
                                                {esMesActual && (
                                                    <span style={{ fontSize: '0.65rem', background: 'rgba(245,158,11,0.2)', color: '#fbbf24', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                                                        ACTUAL
                                                    </span>
                                                )}
                                            </div>

                                            {/* Estado y Monto */}
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                    <span
                                                        style={{
                                                            fontSize: '0.72rem',
                                                            padding: '2px 6px',
                                                            borderRadius: 4,
                                                            fontWeight: 700,
                                                            background: estaPagado
                                                                ? 'rgba(34,197,94,0.25)'
                                                                : esFuturo
                                                                ? 'rgba(255,255,255,0.08)'
                                                                : 'rgba(239,68,68,0.2)',
                                                            color: estaPagado ? '#22c55e' : esFuturo ? 'rgba(255,255,255,0.6)' : '#ef4444',
                                                        }}
                                                    >
                                                        {estaPagado ? '✓ PAGADO' : esFuturo ? '⏳ PRÓXIMO' : '✗ PENDIENTE'}
                                                    </span>
                                                </div>

                                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f0fdf4' }}>
                                                    {formatCurrency(pago?.monto || alumno.cuota || 0)}
                                                </div>

                                                {estaPagado && pago?.fechaPago && (
                                                    <div style={{ fontSize: '0.72rem', color: 'rgba(134,239,172,0.6)', marginTop: 2 }}>
                                                        Abonó: {formatearFecha(pago.fechaPago)}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Botones de acción del mes */}
                                            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                                                {estaPagado ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMarcarPendiente(mes, anioSeleccionado)}
                                                        className="btn btn-secondary"
                                                        style={{
                                                            flex: 1,
                                                            padding: '4px 6px',
                                                            fontSize: '0.72rem',
                                                            background: 'rgba(255,255,255,0.04)',
                                                            borderColor: 'rgba(255,255,255,0.1)',
                                                        }}
                                                        title="Revertir este mes a pendiente"
                                                    >
                                                        ↩ Deshacer
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMarcarPagadoRapido(mes, anioSeleccionado)}
                                                        className="btn btn-success"
                                                        style={{
                                                            flex: 1,
                                                            padding: '4px 6px',
                                                            fontSize: '0.72rem',
                                                            fontWeight: 600,
                                                        }}
                                                        title="Marcar como pagado con la cuota actual"
                                                    >
                                                        ✓ Marcar Pagó
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => abrirFormularioParaMes(mes)}
                                                    className="btn btn-secondary"
                                                    style={{
                                                        padding: '4px 8px',
                                                        fontSize: '0.72rem',
                                                        background: 'rgba(59,130,246,0.1)',
                                                        color: '#60a5fa',
                                                        borderColor: 'rgba(59,130,246,0.25)',
                                                    }}
                                                    title="Editar fecha o monto de este pago"
                                                >
                                                    ✏️
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ─── Tabla / Historial Detallado de Pagos Efectuados ─── */}
                    <div
                        style={{
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(34,197,94,0.12)',
                            borderRadius: 'var(--radius-md)',
                            padding: '1rem',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                            <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#f0fdf4', display: 'flex', alignItems: 'center', gap: 6 }}>
                                📜 Registro Histórico Completo de Pagos ({historialPagosRealizados.length})
                            </h4>
                            <span style={{ fontSize: '0.75rem', color: 'rgba(134,239,172,0.5)' }}>
                                Todos los pagos registrados de este alumno
                            </span>
                        </div>

                        {historialPagosRealizados.length === 0 ? (
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(134,239,172,0.4)', fontStyle: 'italic', textAlign: 'center', padding: '1rem 0' }}>
                                No se registran pagos previos para este alumno.
                            </p>
                        ) : (
                            <div style={{ overflowX: 'auto', maxHeight: 200, overflowY: 'auto' }}>
                                <table className="preview-table" style={{ fontSize: '0.8rem', width: '100%', margin: 0 }}>
                                    <thead>
                                        <tr>
                                            <th>Período</th>
                                            <th>Monto</th>
                                            <th>Fecha Abonado</th>
                                            <th>Estado</th>
                                            <th style={{ textAlign: 'right' }}>Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historialPagosRealizados.map((p) => (
                                            <tr key={`${p.anio}-${p.mes}`}>
                                                <td>
                                                    <strong>{MONTH_NAMES[p.mes - 1]} {p.anio}</strong>
                                                </td>
                                                <td>
                                                    <span style={{ color: '#4ade80', fontWeight: 600 }}>
                                                        {formatCurrency(p.monto)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span style={{ color: 'rgba(255,255,255,0.8)' }}>
                                                        {formatearFecha(p.fechaPago)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="badge pagado" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
                                                        ✓ Pagado
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMarcarPendiente(p.mes, p.anio)}
                                                        className="btn btn-secondary"
                                                        style={{
                                                            padding: '2px 8px',
                                                            fontSize: '0.7rem',
                                                            background: 'rgba(239,68,68,0.1)',
                                                            color: '#ef4444',
                                                            borderColor: 'rgba(239,68,68,0.25)',
                                                        }}
                                                        title="Deshacer pago"
                                                    >
                                                        ↩ Deshacer
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* ─── Footer del Modal ─── */}
                <div
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderTop: '1px solid rgba(34, 197, 94, 0.15)',
                        background: '#080c08',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                    }}
                >
                    <span style={{ fontSize: '0.8rem', color: 'rgba(134,239,172,0.5)' }}>
                        Mutantes Fight Team — Control de Cuotas
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn btn-secondary"
                        style={{ padding: '6px 18px', fontSize: '0.85rem' }}
                    >
                        Cerrar Historial
                    </button>
                </div>
            </div>
        </div>
    );
}
