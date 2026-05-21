import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Alumno, PagoMensual, AppConfig, ActivityLog, RecordatorioMap, RecordatorioTipo } from '../types';

import { useAuthStore } from './authStore';

const API_BASE = (import.meta as any).env?.PROD ? '/api' : 'http://localhost:3001/api';

const RECORDATORIO_TIPOS: RecordatorioTipo[] = ['manual', 'primer_recordatorio', 'segundo_recordatorio'];

// ─── API sync helpers con Autenticación ────────────────────────
async function getAuthHeaders(): Promise<HeadersInit> {
    const token = useAuthStore.getState().token;
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
}

async function apiGet<T>(path: string): Promise<T | null> {
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}${path}`, { headers });
        if (res.ok) return res.json();
    } catch { }
    return null;
}

async function apiPost(path: string, body: any) {
    try {
        const headers = await getAuthHeaders();
        await fetch(`${API_BASE}${path}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
    } catch { }
}

async function apiPut(path: string, body: any) {
    try {
        const headers = await getAuthHeaders();
        await fetch(`${API_BASE}${path}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(body),
        });
    } catch { }
}

async function apiDelete(path: string) {
    try {
        const headers = await getAuthHeaders();
        await fetch(`${API_BASE}${path}`, { 
            method: 'DELETE',
            headers
        });
    } catch { }
}

function normalizeRecordatorios(data: any): RecordatorioMap {
    const map: RecordatorioMap = {};
    if (!data) return map;

    if (Array.isArray(data)) {
        data.forEach((item: any) => {
            if (!item) return;
            const key = item.key || (item.alumnoId && item.mes != null && item.anio != null
                ? `${item.alumnoId}_${item.mes}_${item.anio}`
                : undefined);
            const tipo = (item.tipo as RecordatorioTipo) || 'manual';
            const fecha = item.fecha || item.fecha_envio || (typeof item === 'string' ? item : undefined);
            if (!key || typeof fecha !== 'string') return;
            const current = map[key] || {};
            current[tipo] = fecha;
            map[key] = current;
        });
        return map;
    }

    Object.entries(data as Record<string, any>).forEach(([key, value]) => {
        if (!value) return;
        if (typeof value === 'string') {
            map[key] = { manual: value };
        } else if (typeof value === 'object') {
            const entry: Partial<Record<RecordatorioTipo, string>> = {};
            RECORDATORIO_TIPOS.forEach((tipo) => {
                const fecha = value[tipo];
                if (typeof fecha === 'string') entry[tipo] = fecha;
            });
            if (Object.keys(entry).length > 0) {
                map[key] = entry;
            }
        }
    });
    return map;
}

// ─── Store Interface ─────────────────────────────────────────
interface StoreState {
    alumnos: Alumno[];
    pagos: PagoMensual[];
    config: AppConfig;
    activity: ActivityLog[];
    mensajesEnviados: number;
    recordatoriosEnviados: RecordatorioMap;
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
    marcarRecordatorioEnviado: (alumnoId: string, mes: number, anio: number, tipo?: RecordatorioTipo) => void;
    toggleRecordatorioEnviado: (alumnoId: string, mes: number, anio: number, tipo?: RecordatorioTipo) => void;
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
                        recordatoriosEnviados: normalizeRecordatorios(data.recordatoriosEnviados),
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
                getAuthHeaders().then((headers) => {
                    fetch(`${API_BASE}/alumnos`, {
                        method: 'POST',
                        headers,
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
                });

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
            marcarRecordatorioEnviado: (alumnoId, mes, anio, tipo: RecordatorioTipo = 'manual') => {
                const key = `${alumnoId}_${mes}_${anio}`;
                const timestamp = new Date().toISOString();
                set((s) => {
                    const current = s.recordatoriosEnviados[key] ?? {};
                    return {
                        recordatoriosEnviados: {
                            ...s.recordatoriosEnviados,
                            [key]: { ...current, [tipo]: timestamp },
                        },
                    };
                });
                apiPost('/recordatorios', { alumnoId, mes, anio, tipo });
            },
            toggleRecordatorioEnviado: (alumnoId, mes, anio, tipo: RecordatorioTipo = 'manual') => {
                const key = `${alumnoId}_${mes}_${anio}`;
                const current = get().recordatoriosEnviados[key] ?? {};
                const wasSent = Boolean(current[tipo]);

                if (wasSent) {
                    set((s) => {
                        const entry = { ...(s.recordatoriosEnviados[key] ?? {}) } as Partial<Record<RecordatorioTipo, string>>;
                        delete entry[tipo];
                        const next = { ...s.recordatoriosEnviados };
                        if (Object.keys(entry).length === 0) {
                            delete next[key];
                        } else {
                            next[key] = entry;
                        }
                        return { recordatoriosEnviados: next };
                    });
                    apiDelete(`/recordatorios/${alumnoId}/${mes}/${anio}/${tipo}`);
                } else {
                    get().marcarRecordatorioEnviado(alumnoId, mes, anio, tipo);
                }
            },
        }),
        { name: 'mft-store' }
    )
);
