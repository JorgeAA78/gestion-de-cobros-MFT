// ─── Store de Datos (Supabase + JSON fallback) ──────────────────────────────
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { supabase, isSupabaseConfigured, DbAlumno, DbPago, DbActividad, DbRecordatorioEnviado } from './supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, '..', 'data.json');
const MENSAJES_CONFIG_KEY = 'mensajesEnviados';

// ─── Generador de ID de 6 dígitos ────────────────────────────────────────────
function generateShortId(): string {
    return crypto.randomInt(100000, 1000000).toString();
}

// ─── Tipos locales ──────────────────────────────────────────────────────────
export interface Alumno {
    id: string;
    nombre: string;
    whatsapp: string;
    plan: 'libre' | '3x';
    cuota: number;
    diaVencimiento?: number;
    estado: 'activo' | 'becado' | 'suspendido' | 'inactivo';
    notas?: string;
}

export interface Pago {
    id: string;
    alumnoId: string;
    mes: number;
    anio: number;
    monto: number;
    estado: 'pendiente' | 'pagado' | 'vencido';
    fechaPago?: string;
}

export interface Activity {
    type: 'sent' | 'payment' | 'register' | 'config';
    message: string;
    timestamp: string;
}

export interface Config {
    evolutionApiUrl: string;
    evolutionApiKey: string;
    evolutionInstance: string;
    diaEnvio: number;
    mensajePlantilla: string;
    datosPago: string;
}

export interface DataStore {
    alumnos: Alumno[];
    pagos: Pago[];
    config: Config;
    activity: Activity[];
    mensajesEnviados: number;
    enviosRealizados: { alumnoId?: string; mes: number; anio: number; fecha: string; tipo?: 'manual' | 'primer_recordatorio' | 'segundo_recordatorio' }[];
}

export type RecordatorioTipo = 'manual' | 'primer_recordatorio' | 'segundo_recordatorio';

export type RecordatoriosMap = Record<string, Partial<Record<RecordatorioTipo, string>>>;

// ─── Helpers de conversión ──────────────────────────────────────────────────
function dbToAlumno(db: DbAlumno): Alumno {
    return {
        id: db.id,
        nombre: db.nombre,
        whatsapp: db.whatsapp,
        plan: db.plan,
        cuota: db.cuota,
        diaVencimiento: db.dia_vencimiento,
        estado: db.estado || 'activo',
        notas: db.notas || undefined
    };
}

function dbToPago(db: DbPago): Pago {
    return {
        id: db.id,
        alumnoId: db.alumno_id,
        mes: db.mes,
        anio: db.anio,
        monto: db.monto,
        estado: db.estado,
        fechaPago: db.fecha_pago || undefined
    };
}

function dbToActivity(db: DbActividad): Activity {
    return {
        type: db.tipo,
        message: db.mensaje,
        timestamp: db.timestamp
    };
}

// ─── Fallback JSON ──────────────────────────────────────────────────────────
function readDataJSON(): DataStore {
    try {
        return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    } catch {
        return {
            alumnos: [], pagos: [], activity: [], mensajesEnviados: 0,
            enviosRealizados: [],
            config: {
                evolutionApiUrl: '', evolutionApiKey: '', evolutionInstance: '',
                diaEnvio: 5, mensajePlantilla: '', datosPago: '',
            },
        };
    }
}

function writeDataJSON(data: DataStore) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Funciones de Alumnos ───────────────────────────────────────────────────
export async function obtenerAlumnos(): Promise<Alumno[]> {
    if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
            .from('alumnos')
            .select('*')
            .eq('activo', true)
            .order('nombre');
        
        if (error) {
            console.error('Error obteniendo alumnos:', error);
            return [];
        }
        return data.map(dbToAlumno);
    }
    return readDataJSON().alumnos;
}

export async function crearAlumno(alumno: Omit<Alumno, 'id'>): Promise<Alumno> {
    if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
            .from('alumnos')
            .insert({
                nombre: alumno.nombre,
                whatsapp: alumno.whatsapp,
                plan: alumno.plan,
                cuota: alumno.cuota,
                dia_vencimiento: alumno.diaVencimiento || 5,
                estado: alumno.estado || 'activo',
                notas: alumno.notas
            })
            .select()
            .single();
        
        if (error) {
            console.error('Error creando alumno:', error);
            throw new Error('Error al crear alumno');
        }
        return dbToAlumno(data);
    }
    
    // Fallback JSON
    const store = readDataJSON();
    const nuevoAlumno: Alumno = {
        id: generateShortId(),
        ...alumno
    };
    store.alumnos.push(nuevoAlumno);
    writeDataJSON(store);
    return nuevoAlumno;
}

export async function crearAlumnosBulk(alumnos: Omit<Alumno, 'id'>[]): Promise<Alumno[]> {
    if (isSupabaseConfigured() && supabase) {
        const insertData = alumnos.map(a => ({
            nombre: a.nombre,
            whatsapp: a.whatsapp,
            plan: a.plan,
            cuota: a.cuota,
            dia_vencimiento: a.diaVencimiento || 5,
            estado: a.estado || 'activo',
            notas: a.notas
        }));
        
        const { data, error } = await supabase
            .from('alumnos')
            .insert(insertData)
            .select();
        
        if (error) {
            console.error('Error creando alumnos en bulk:', error);
            throw new Error('Error al crear alumnos');
        }
        return data.map(dbToAlumno);
    }
    
    // Fallback JSON
    const store = readDataJSON();
    const nuevosAlumnos = alumnos.map(a => ({
        id: generateShortId(),
        ...a
    }));
    store.alumnos.push(...nuevosAlumnos);
    writeDataJSON(store);
    return nuevosAlumnos;
}

export async function eliminarAlumno(id: string): Promise<boolean> {
    if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase
            .from('alumnos')
            .update({ activo: false })
            .eq('id', id);
        
        return !error;
    }
    
    // Fallback JSON
    const store = readDataJSON();
    const index = store.alumnos.findIndex(a => a.id === id);
    if (index === -1) return false;
    store.alumnos.splice(index, 1);
    writeDataJSON(store);
    return true;
}

export async function eliminarAlumnosBulk(ids: string[]): Promise<boolean> {
    if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase
            .from('alumnos')
            .update({ activo: false })
            .in('id', ids);
        
        return !error;
    }
    
    // Fallback JSON
    const store = readDataJSON();
    store.alumnos = store.alumnos.filter(a => !ids.includes(a.id));
    writeDataJSON(store);
    return true;
}

// ─── Funciones de Actualización de Alumno ───────────────────────────────────
export async function actualizarAlumno(id: string, data: Partial<Omit<Alumno, 'id'>>): Promise<boolean> {
    if (isSupabaseConfigured() && supabase) {
        const updateData: Record<string, any> = {};
        if (data.nombre !== undefined) updateData.nombre = data.nombre;
        if (data.whatsapp !== undefined) updateData.whatsapp = data.whatsapp;
        if (data.plan !== undefined) updateData.plan = data.plan;
        if (data.cuota !== undefined) updateData.cuota = data.cuota;
        if (data.diaVencimiento !== undefined) updateData.dia_vencimiento = data.diaVencimiento;
        if (data.estado !== undefined) updateData.estado = data.estado;
        if (data.notas !== undefined) updateData.notas = data.notas;

        const { error } = await supabase
            .from('alumnos')
            .update(updateData)
            .eq('id', id);
        
        if (error) {
            console.error('Error actualizando alumno:', error);
            return false;
        }
        return true;
    }

    // Fallback JSON
    const store = readDataJSON();
    const index = store.alumnos.findIndex(a => a.id === id);
    if (index === -1) return false;
    store.alumnos[index] = { ...store.alumnos[index], ...data };
    writeDataJSON(store);
    return true;
}

// ─── Funciones de Pagos ─────────────────────────────────────────────────────
export async function obtenerPagos(): Promise<Pago[]> {
    if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
            .from('pagos')
            .select('*');
        
        if (error) {
            console.error('Error obteniendo pagos:', error);
            return [];
        }
        return data.map(dbToPago);
    }
    return readDataJSON().pagos;
}

export async function marcarPagado(alumnoId: string, mes: number, anio: number, monto: number): Promise<Pago> {
    if (isSupabaseConfigured() && supabase) {
        // Upsert: actualizar si existe, crear si no
        const { data, error } = await supabase
            .from('pagos')
            .upsert({
                alumno_id: alumnoId,
                mes,
                anio,
                monto,
                estado: 'pagado',
                fecha_pago: new Date().toISOString()
            }, { onConflict: 'alumno_id,mes,anio' })
            .select()
            .single();
        
        if (error) {
            console.error('Error marcando pago:', error);
            throw new Error('Error al marcar pago');
        }
        return dbToPago(data);
    }
    
    // Fallback JSON
    const store = readDataJSON();
    const existente = store.pagos.find(p => p.alumnoId === alumnoId && p.mes === mes && p.anio === anio);
    if (existente) {
        existente.estado = 'pagado';
        existente.fechaPago = new Date().toISOString();
        writeDataJSON(store);
        return existente;
    }
    const nuevoPago: Pago = {
        id: Date.now().toString(36),
        alumnoId, mes, anio, monto,
        estado: 'pagado',
        fechaPago: new Date().toISOString()
    };
    store.pagos.push(nuevoPago);
    writeDataJSON(store);
    return nuevoPago;
}

export async function marcarPendiente(alumnoId: string, mes: number, anio: number): Promise<boolean> {
    if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase
            .from('pagos')
            .update({ estado: 'pendiente', fecha_pago: null })
            .eq('alumno_id', alumnoId)
            .eq('mes', mes)
            .eq('anio', anio);
        
        return !error;
    }
    
    // Fallback JSON
    const store = readDataJSON();
    const pago = store.pagos.find(p => p.alumnoId === alumnoId && p.mes === mes && p.anio === anio);
    if (pago) {
        pago.estado = 'pendiente';
        pago.fechaPago = undefined;
        writeDataJSON(store);
    }
    return true;
}

// ─── Funciones de Actividad ─────────────────────────────────────────────────
export async function obtenerActividad(): Promise<Activity[]> {
    if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
            .from('actividad')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(50);
        
        if (error) {
            console.error('Error obteniendo actividad:', error);
            return [];
        }
        return data.map(dbToActivity);
    }
    return readDataJSON().activity;
}

export async function agregarActividad(activity: Activity): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
        await supabase
            .from('actividad')
            .insert({
                tipo: activity.type,
                mensaje: activity.message,
                timestamp: activity.timestamp
            });
        return;
    }
    
    // Fallback JSON
    const store = readDataJSON();
    store.activity.unshift(activity);
    writeDataJSON(store);
}

// ─── Funciones de Configuración ─────────────────────────────────────────────
export async function obtenerConfig(): Promise<Config> {
    if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
            .from('configuracion')
            .select('*');
        
        if (error || !data || data.length === 0) {
            return {
                evolutionApiUrl: '', evolutionApiKey: '', evolutionInstance: '',
                diaEnvio: 5, mensajePlantilla: '', datosPago: '',
            };
        }
        
        const config: Config = {
            evolutionApiUrl: '', evolutionApiKey: '', evolutionInstance: '',
            diaEnvio: 5, mensajePlantilla: '', datosPago: '',
        };
        
        for (const row of data) {
            if (row.clave in config) {
                (config as any)[row.clave] = row.clave === 'diaEnvio' ? parseInt(row.valor) : row.valor;
            }
        }
        return config;
    }
    return readDataJSON().config;
}

export async function guardarConfig(config: Config): Promise<void> {
    const currentConfig = await obtenerConfig();
    const finalConfig = { ...config };
    if (finalConfig.evolutionApiKey === '••••••••') {
        finalConfig.evolutionApiKey = currentConfig.evolutionApiKey;
    }

    if (isSupabaseConfigured() && supabase) {
        const entries = Object.entries(finalConfig);
        for (const [clave, valor] of entries) {
            await supabase
                .from('configuracion')
                .upsert({ clave, valor: String(valor) }, { onConflict: 'clave' });
        }
        return;
    }
    
    // Fallback JSON
    const store = readDataJSON();
    store.config = finalConfig;
    writeDataJSON(store);
}

// ─── Funciones de Recordatorios Enviados ────────────────────────────────────
export async function obtenerRecordatoriosEnviados(): Promise<RecordatoriosMap> {
    if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
            .from('recordatorios_enviados')
            .select('*');
        if (error) {
            console.error('Error obteniendo recordatorios:', error);
            return {};
        }
        const map: RecordatoriosMap = {};
        for (const r of data) {
            const key = `${r.alumno_id}_${r.mes}_${r.anio}`;
            const tipo = (r.tipo as RecordatorioTipo) || 'manual';
            const entry = map[key] || {};
            entry[tipo] = r.fecha_envio;
            map[key] = entry;
        }
        return map;
    }
    // Fallback JSON
    const store = readDataJSON();
    const map: RecordatoriosMap = {};
    for (const r of store.enviosRealizados || []) {
        if (!r.alumnoId) continue;
        const key = `${r.alumnoId}_${r.mes}_${r.anio}`;
        const tipo: RecordatorioTipo = r.tipo || 'manual';
        const entry = map[key] || {};
        entry[tipo] = r.fecha;
        map[key] = entry;
    }
    return map;
}

export async function registrarRecordatorioEnviado(alumnoId: string, mes: number, anio: number, tipo: RecordatorioTipo): Promise<void> {
    const fecha_envio = new Date().toISOString();
    if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase
            .from('recordatorios_enviados')
            .upsert({ alumno_id: alumnoId, mes, anio, tipo, fecha_envio }, { onConflict: 'alumno_id,mes,anio,tipo' });
        if (error) console.error('Error registrando recordatorio:', error);
        return;
    }
    const store = readDataJSON();
    if (!store.enviosRealizados) store.enviosRealizados = [];
    const index = store.enviosRealizados.findIndex(r => r.alumnoId === alumnoId && r.mes === mes && r.anio === anio && (r.tipo || 'manual') === tipo);
    if (index >= 0) {
        store.enviosRealizados[index].fecha = fecha_envio;
    } else {
        store.enviosRealizados.push({ alumnoId, mes, anio, fecha: fecha_envio, tipo });
    }
    writeDataJSON(store);
}

export async function eliminarRecordatorioEnviado(alumnoId: string, mes: number, anio: number, tipo: RecordatorioTipo = 'manual'): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.from('recordatorios_enviados')
            .delete()
            .eq('alumno_id', alumnoId)
            .eq('mes', mes)
            .eq('anio', anio)
            .eq('tipo', tipo);
        if (error) console.error('Error eliminando recordatorio:', error);
        return;
    }
    const store = readDataJSON();
    if (!store.enviosRealizados) return;
    store.enviosRealizados = store.enviosRealizados.filter(r => !(r.alumnoId === alumnoId && r.mes === mes && r.anio === anio && (r.tipo || 'manual') === tipo));
    writeDataJSON(store);
}

export async function obtenerMensajesEnviados(): Promise<number> {
    if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
            .from('configuracion')
            .select('valor')
            .eq('clave', MENSAJES_CONFIG_KEY)
            .maybeSingle();
        if (error) {
            console.error('Error obteniendo mensajes enviados:', error);
            return 0;
        }
        const valor = data?.valor ? parseInt(data.valor, 10) : 0;
        return Number.isNaN(valor) ? 0 : valor;
    }
    const store = readDataJSON();
    return store.mensajesEnviados ?? 0;
}

export async function incrementarMensajesEnviados(count: number): Promise<number> {
    if (isSupabaseConfigured() && supabase) {
        const current = await obtenerMensajesEnviados();
        const next = Math.max(0, current + count);
        const { error } = await supabase
            .from('configuracion')
            .upsert({ clave: MENSAJES_CONFIG_KEY, valor: String(next) }, { onConflict: 'clave' });
        if (error) {
            console.error('Error incrementando mensajes enviados:', error);
            return current;
        }
        return next;
    }
    const store = readDataJSON();
    const next = Math.max(0, (store.mensajesEnviados ?? 0) + count);
    store.mensajesEnviados = next;
    writeDataJSON(store);
    return next;
}

// ─── Función para obtener todo (compatibilidad) ─────────────────────────────
export async function obtenerTodo(): Promise<any> {
    if (isSupabaseConfigured() && supabase) {
        const [alumnos, pagos, activity, config, recordatoriosEnviados, mensajesEnviados] = await Promise.all([
            obtenerAlumnos(),
            obtenerPagos(),
            obtenerActividad(),
            obtenerConfig(),
            obtenerRecordatoriosEnviados(),
            obtenerMensajesEnviados()
        ]);
        
        const maskedConfig = {
            ...config,
            evolutionApiKey: config.evolutionApiKey ? '••••••••' : ''
        };
        
        return {
            alumnos,
            pagos,
            activity,
            config: maskedConfig,
            mensajesEnviados,
            enviosRealizados: [],
            recordatoriosEnviados
        };
    }
    const data = readDataJSON();
    if (data.config) {
        data.config.evolutionApiKey = data.config.evolutionApiKey ? '••••••••' : '';
    }
    const recordatoriosEnviados: RecordatoriosMap = {};
    for (const r of data.enviosRealizados || []) {
        if (!r.alumnoId) continue;
        const key = `${r.alumnoId}_${r.mes}_${r.anio}`;
        const entry = recordatoriosEnviados[key] || {};
        const tipo: RecordatorioTipo = r.tipo || 'manual';
        entry[tipo] = r.fecha;
        recordatoriosEnviados[key] = entry;
    }
    return { ...data, recordatoriosEnviados };
}

// ─── Función para sincronizar todo (compatibilidad) ─────────────────────────
export async function sincronizarTodo(data: Partial<DataStore>): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
        // Sincronizar alumnos
        if (data.alumnos) {
            // Obtener alumnos actuales
            const actuales = await obtenerAlumnos();
            const actualesIds = new Set(actuales.map(a => a.id));
            
            // Nuevos alumnos (los que no tienen UUID válido son nuevos)
            const nuevos = data.alumnos.filter(a => !actualesIds.has(a.id) && !a.id.includes('-'));
            if (nuevos.length > 0) {
                await crearAlumnosBulk(nuevos);
            }
        }
        
        // Sincronizar config
        if (data.config) {
            await guardarConfig(data.config);
        }
        
        // Actividad se maneja individualmente
        
        return;
    }
    
    // Fallback JSON
    const current = readDataJSON();
    const merged: DataStore = {
        alumnos: data.alumnos ?? current.alumnos,
        pagos: data.pagos ?? current.pagos,
        config: data.config ?? current.config,
        activity: data.activity ?? current.activity,
        mensajesEnviados: data.mensajesEnviados ?? current.mensajesEnviados,
        enviosRealizados: current.enviosRealizados,
    };
    writeDataJSON(merged);
}
