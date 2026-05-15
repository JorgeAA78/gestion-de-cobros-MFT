// ─── Store de Datos (Supabase + JSON fallback) ──────────────────────────────
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase, isSupabaseConfigured, DbAlumno, DbPago, DbActividad } from './supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, '..', 'data.json');

// ─── Generador de ID de 6 dígitos ────────────────────────────────────────────
function generateShortId(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── Tipos locales ──────────────────────────────────────────────────────────
export interface Alumno {
    id: string;
    nombre: string;
    whatsapp: string;
    plan: 'libre' | '3x';
    cuota: number;
    diaVencimiento?: number;
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
    enviosRealizados: { alumnoId?: string; mes: number; anio: number; fecha: string; tipo?: string }[];
}

// ─── Helpers de conversión ──────────────────────────────────────────────────
function dbToAlumno(db: DbAlumno): Alumno {
    return {
        id: db.id,
        nombre: db.nombre,
        whatsapp: db.whatsapp,
        plan: db.plan,
        cuota: db.cuota,
        diaVencimiento: db.dia_vencimiento
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
                dia_vencimiento: alumno.diaVencimiento || 5
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
            dia_vencimiento: a.diaVencimiento || 5
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
    if (isSupabaseConfigured() && supabase) {
        const entries = Object.entries(config);
        for (const [clave, valor] of entries) {
            await supabase
                .from('configuracion')
                .upsert({ clave, valor: String(valor) }, { onConflict: 'clave' });
        }
        return;
    }
    
    // Fallback JSON
    const store = readDataJSON();
    store.config = config;
    writeDataJSON(store);
}

// ─── Función para obtener todo (compatibilidad) ─────────────────────────────
export async function obtenerTodo(): Promise<DataStore> {
    if (isSupabaseConfigured() && supabase) {
        const [alumnos, pagos, activity, config] = await Promise.all([
            obtenerAlumnos(),
            obtenerPagos(),
            obtenerActividad(),
            obtenerConfig()
        ]);
        
        // mensajesEnviados y enviosRealizados se mantienen en JSON por ahora
        const jsonData = readDataJSON();
        
        return {
            alumnos,
            pagos,
            activity,
            config,
            mensajesEnviados: jsonData.mensajesEnviados,
            enviosRealizados: jsonData.enviosRealizados
        };
    }
    return readDataJSON();
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
        
        // Guardar mensajesEnviados y enviosRealizados en JSON
        const jsonData = readDataJSON();
        if (data.mensajesEnviados !== undefined) {
            jsonData.mensajesEnviados = data.mensajesEnviados;
        }
        if (data.enviosRealizados) {
            jsonData.enviosRealizados = data.enviosRealizados;
        }
        writeDataJSON(jsonData);
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
