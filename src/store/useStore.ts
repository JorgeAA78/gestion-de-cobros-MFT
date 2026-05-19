import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Alumno, PagoMensual, AppConfig, ActivityLog } from '../types';

const API_BASE = (import.meta as any).env?.PROD ? '/api' : 'http://localhost:3001/api';

// ─── API sync helpers ────────────────────────────────────────
async function apiGet<T>(path: string): Promise<T | null> {
    try {
        const res = await fetch(`${API_BASE}${path}`);
        if (res.ok) return res.json();
    } catch { }
    return null;
}

async function apiPost(path: string, body: any) {
    try {
        await fetch(`${API_BASE}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    } catch { }
}

async function apiPut(path: string, body: any) {
    try {
        await fetch(`${API_BASE}${path}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    } catch { }
}

async function apiDelete(path: string) {
    try {
        await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
    } catch { }
}

// ─── Store Interface ─────────────────────────────────────────
interface StoreState {
    alumnos: Alumno[];
    pagos: PagoMensual[];
    config: AppConfig;
    activity: ActivityLog[];
    mensajesEnviados: number;
    recordatoriosEnviados: Record<string, string>;
    synced: boolean;

    // Init
    syncFromServer: () => Promise<void>;
    pushToServer: () => void;

    // Alumnos
    addAlumno: (alumno: Omit<Alumno, 'id' | 'fechaRegistro'>) => Alumno;
    updateAlumno: (id: string, data: Partial<Alumno>) => void;
    removeAlumno: (id: string) => void;
    importAlumnos: (alumnos: Omit<Alumno, 'id' | 'fechaRegistro'>[]) => number;

    // Pagos
    registrarPago: (alumnoId: string, mes: number, anio: number, monto: number) => void;
    marcarPagado: (alumnoId: string, mes: number, anio: number) => void;
    marcarPendiente: (alumnoId: string, mes: number, anio: number) => void;
    getEstadoPago: (alumnoId: string, mes: number, anio: number) => 'pagado' | 'pendiente' | 'vencido';
    getAlumnosPendientes: (mes: number, anio: number) => Alumno[];

    // Config
    updateConfig: (data: Partial<AppConfig>) => void;

    // Activity
    addActivity: (type: ActivityLog['type'], message: string) => void;

    // Stats
    getStats: () => { totalAlumnos: number; mensajesEnviados: number; cuotasPendientes: number; totalRecaudado: number; };
    incrementMensajes: (count?: number) => void;
    
    // Recordatorios
    marcarRecordatorioEnviado: (alumnoId: string, mes: number, anio: number) => void;
}

const DEFAULT_PLANTILLA = `¡Hola {nombre}! 👋🥋

Te recordamos que la cuota de *{mes}* está pendiente de pago:

💰 Monto: *{monto}*
📋 Plan: *{plan}*

{datos_pago}

¡Te esperamos en el tatami! 💪🔥

_Mutantes Fight Team - Brazilian Jiu Jitsu_`;

export const useStore = create<StoreState>()(
    persist(
        (set, get) => ({
            alumnos: [],
            pagos: [],
            config: {
                evolutionApiUrl: '',
                evolutionApiKey: '',
                evolutionInstance: '',
                diaEnvio: 5,
                mensajePlantilla: DEFAULT_PLANTILLA,
                datosPago: '',
            },
            activity: [],
            mensajesEnviados: 0,
            recordatoriosEnviados: {},
            synced: false,

            // ─── Sync with server ─────────────────────────
            syncFromServer: async () => {
                const data = await apiGet<any>('/data');
                if (data) {
                    set({
                        alumnos: data.alumnos || [],
                        pagos: data.pagos || [],
                        config: data.config || get().config,
                        activity: data.activity || [],
                        mensajesEnviados: data.mensajesEnviados || 0,
                        synced: true,
                    });
                }
            },

            pushToServer: () => {
                const { alumnos, pagos, config, activity, mensajesEnviados } = get();
                apiPut('/data', { alumnos, pagos, config, activity, mensajesEnviados });
            },

            // ─── Alumnos ──────────────────────────────────
            addAlumno: (data) => {
                const tempId = `ALU-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                const alumno: Alumno = {
                    ...data,
                    estado: data.estado || 'activo',
                    id: tempId,
                    fechaRegistro: new Date().toISOString(),
                };
                set((s) => ({ alumnos: [...s.alumnos, alumno] }));

                // Sincronizar el ID real de Supabase para que delete/update funcionen
                fetch(`${API_BASE}/alumnos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(alumno),
                })
                    .then((res) => res.json())
                    .then((result) => {
                        if (result.alumno?.id && result.alumno.id !== tempId) {
                            set((s) => ({
                                alumnos: s.alumnos.map((a) =>
                                    a.id === tempId ? { ...a, id: result.alumno.id } : a
                                ),
                            }));
                        }
                    })
                    .catch(() => { });

                return alumno;
            },

            updateAlumno: (id, data) => {
                set((s) => ({
                    alumnos: s.alumnos.map((a) => (a.id === id ? { ...a, ...data } : a)),
                }));
                apiPut(`/alumnos/${id}`, data);
            },

            removeAlumno: (id) => {
                set((s) => ({
                    alumnos: s.alumnos.filter((a) => a.id !== id),
                    pagos: s.pagos.filter((p) => p.alumnoId !== id),
                }));
                apiDelete(`/alumnos/${id}`);
            },

            importAlumnos: (list) => {
                const newAlumnos: Alumno[] = list.map((data, i) => ({
                    ...data,
                    estado: data.estado || 'activo',
                    id: `ALU-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
                    fechaRegistro: new Date().toISOString(),
                }));
                set((s) => ({ alumnos: [...s.alumnos, ...newAlumnos] }));

                // Sincronizar IDs reales de Supabase después de importar
                apiPost('/alumnos/import', { alumnos: newAlumnos })
                    .then(() => get().syncFromServer());

                return newAlumnos.length;
            },

            // ─── Pagos ────────────────────────────────────

            registrarPago: (alumnoId, mes, anio, monto) => {
                set((s) => {
                    const existing = s.pagos.findIndex(
                        (p) => p.alumnoId === alumnoId && p.mes === mes && p.anio === anio
                    );
                    if (existing >= 0) {
                        const updated = [...s.pagos];
                        updated[existing] = { ...updated[existing], estado: 'pagado', fechaPago: new Date().toISOString(), monto };
                        return { pagos: updated };
                    }
                    return {
                        pagos: [...s.pagos, { alumnoId, mes, anio, estado: 'pagado' as const, fechaPago: new Date().toISOString(), monto }],
                    };
                });
                apiPost('/pagos', { alumnoId, mes, anio, estado: 'pagado', monto });
            },

            marcarPagado: (alumnoId, mes, anio) => {
                const alumno = get().alumnos.find((a) => a.id === alumnoId);
                if (alumno) get().registrarPago(alumnoId, mes, anio, alumno.cuota);
            },

            marcarPendiente: (alumnoId, mes, anio) => {
                set((s) => {
                    const existing = s.pagos.findIndex(
                        (p) => p.alumnoId === alumnoId && p.mes === mes && p.anio === anio
                    );
                    if (existing >= 0) {
                        const updated = [...s.pagos];
                        updated[existing] = { ...updated[existing], estado: 'pendiente', fechaPago: undefined };
                        return { pagos: updated };
                    }
                    return s;
                });
                apiPost('/pagos', { alumnoId, mes, anio, estado: 'pendiente', monto: 0 });
            },

            getEstadoPago: (alumnoId, mes, anio) => {
                const pago = get().pagos.find((p) => p.alumnoId === alumnoId && p.mes === mes && p.anio === anio);
                return pago ? pago.estado : 'pendiente';
            },

            getAlumnosPendientes: (mes, anio) => {
                const { alumnos, pagos } = get();
                return alumnos.filter((a) => {
                    // Solo alumnos activos reciben recordatorios
                    if (a.estado !== 'activo') return false;
                    const pago = pagos.find((p) => p.alumnoId === a.id && p.mes === mes && p.anio === anio);
                    return !pago || pago.estado !== 'pagado';
                });
            },

            // ─── Config ───────────────────────────────────
            updateConfig: (data) => {
                set((s) => ({ config: { ...s.config, ...data } }));
                const newConfig = { ...get().config, ...data };
                apiPut('/config', newConfig);
            },

            // ─── Activity ─────────────────────────────────
            addActivity: (type, message) => {
                const entry = { type, message, timestamp: new Date().toISOString() };
                set((s) => ({ activity: [entry, ...s.activity].slice(0, 50) }));
                apiPost('/activity', entry);
            },

            // ─── Stats ────────────────────────────────────
            incrementMensajes: (count = 1) => {
                set((s) => ({ mensajesEnviados: s.mensajesEnviados + count }));
                apiPost('/mensajes/increment', { count: count || 1 });
            },

            getStats: () => {
                const state = get();
                const now = new Date();
                const mes = now.getMonth() + 1;
                const anio = now.getFullYear();
                const pendientes = state.getAlumnosPendientes(mes, anio);
                const totalRecaudado = state.pagos
                    .filter((p) => p.estado === 'pagado')
                    .reduce((sum, p) => sum + p.monto, 0);
                return {
                    totalAlumnos: state.alumnos.length,
                    mensajesEnviados: state.mensajesEnviados,
                    cuotasPendientes: pendientes.length,
                    totalRecaudado,
                };
            },
            
            // ─── Recordatorios ────────────────────────────
            marcarRecordatorioEnviado: (alumnoId, mes, anio) => {
                set((s) => ({
                    recordatoriosEnviados: {
                        ...s.recordatoriosEnviados,
                        [`${alumnoId}_${mes}_${anio}`]: new Date().toISOString(),
                    }
                }));
            },
        }),
        { name: 'mft-store' }
    )
);
