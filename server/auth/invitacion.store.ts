// ─── Almacenamiento de invitaciones (Supabase + JSON fallback) ───────────────
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Invitacion } from './types.js';
import { supabase, isSupabaseConfigured, DbInvitacion } from '../lib/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INVITACIONES_PATH = path.join(__dirname, '..', 'invitaciones.json');

interface InvitacionStore {
    invitaciones: Invitacion[];
}

// ─── Helpers para convertir entre formatos ──────────────────────────────────
function dbToInvitacion(db: DbInvitacion): Invitacion {
    return {
        id: db.id,
        codigo: db.codigo,
        creadoPor: db.creado_por,
        creadoEn: db.creado_en,
        expiraEn: db.expira_en,
        usado: db.usado,
        usadoPor: db.usado_por,
        usadoEn: db.usado_en
    };
}

// ─── Fallback JSON ──────────────────────────────────────────────────────────
function readInvitaciones(): InvitacionStore {
    try {
        if (fs.existsSync(INVITACIONES_PATH)) {
            return JSON.parse(fs.readFileSync(INVITACIONES_PATH, 'utf-8'));
        }
        return { invitaciones: [] };
    } catch {
        return { invitaciones: [] };
    }
}

function writeInvitaciones(store: InvitacionStore): void {
    fs.writeFileSync(INVITACIONES_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

// ─── Generar código de invitación único ──────────────────────────────────────
function generarCodigoInvitacion(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin I, O, 0, 1 para evitar confusión
    let codigo = '';
    for (let i = 0; i < 8; i++) {
        codigo += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return codigo;
}

// ─── Funciones CRUD ──────────────────────────────────────────────────────────

export async function crearInvitacion(adminId: string, diasValidez: number = 7): Promise<Invitacion> {
    const ahora = new Date();
    const expiracion = new Date(ahora.getTime() + diasValidez * 24 * 60 * 60 * 1000);

    if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
            .from('invitaciones')
            .insert({
                codigo: generarCodigoInvitacion(),
                creado_por: adminId,
                expira_en: expiracion.toISOString(),
                usado: false
            })
            .select()
            .single();

        if (error) {
            console.error('Error creando invitación en Supabase:', error);
            throw new Error('Error al crear invitación');
        }
        return dbToInvitacion(data);
    }

    // Fallback JSON
    const store = readInvitaciones();
    const invitacion: Invitacion = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        codigo: generarCodigoInvitacion(),
        creadoPor: adminId,
        creadoEn: ahora.toISOString(),
        expiraEn: expiracion.toISOString(),
        usado: false,
        usadoPor: null,
        usadoEn: null,
    };

    store.invitaciones.push(invitacion);
    writeInvitaciones(store);
    return invitacion;
}

export async function buscarInvitacionPorCodigo(codigo: string): Promise<Invitacion | undefined> {
    if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
            .from('invitaciones')
            .select('*')
            .ilike('codigo', codigo)
            .single();

        if (error || !data) return undefined;
        return dbToInvitacion(data);
    }

    // Fallback JSON
    const store = readInvitaciones();
    return store.invitaciones.find(i => i.codigo.toUpperCase() === codigo.toUpperCase());
}

export async function validarInvitacion(codigo: string): Promise<{ valida: boolean; mensaje: string; invitacion?: Invitacion }> {
    const invitacion = await buscarInvitacionPorCodigo(codigo);

    if (!invitacion) {
        return { valida: false, mensaje: 'Código de invitación no válido' };
    }

    if (invitacion.usado) {
        return { valida: false, mensaje: 'Este código de invitación ya fue utilizado' };
    }

    if (new Date(invitacion.expiraEn) < new Date()) {
        return { valida: false, mensaje: 'Este código de invitación ha expirado' };
    }

    return { valida: true, mensaje: 'Código válido', invitacion };
}

export async function marcarInvitacionUsada(codigo: string, email: string): Promise<boolean> {
    if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase
            .from('invitaciones')
            .update({
                usado: true,
                usado_por: email,
                usado_en: new Date().toISOString()
            })
            .ilike('codigo', codigo);

        return !error;
    }

    // Fallback JSON
    const store = readInvitaciones();
    const index = store.invitaciones.findIndex(i => i.codigo.toUpperCase() === codigo.toUpperCase());

    if (index === -1) return false;

    store.invitaciones[index].usado = true;
    store.invitaciones[index].usadoPor = email;
    store.invitaciones[index].usadoEn = new Date().toISOString();

    writeInvitaciones(store);
    return true;
}

export async function obtenerInvitaciones(): Promise<Invitacion[]> {
    if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
            .from('invitaciones')
            .select('*')
            .order('creado_en', { ascending: false });

        if (error || !data) return [];
        return data.map(dbToInvitacion);
    }

    // Fallback JSON
    const store = readInvitaciones();
    return store.invitaciones;
}

export async function obtenerInvitacionesActivas(): Promise<Invitacion[]> {
    if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
            .from('invitaciones')
            .select('*')
            .eq('usado', false)
            .gt('expira_en', new Date().toISOString());

        if (error || !data) return [];
        return data.map(dbToInvitacion);
    }

    // Fallback JSON
    const store = readInvitaciones();
    const ahora = new Date();
    return store.invitaciones.filter(i =>
        !i.usado && new Date(i.expiraEn) > ahora
    );
}

export async function eliminarInvitacion(id: string): Promise<boolean> {
    if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase
            .from('invitaciones')
            .delete()
            .eq('id', id);

        return !error;
    }

    // Fallback JSON
    const store = readInvitaciones();
    const index = store.invitaciones.findIndex(i => i.id === id);

    if (index === -1) return false;

    store.invitaciones.splice(index, 1);
    writeInvitaciones(store);
    return true;
}
