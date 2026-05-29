// ─── Almacenamiento de administradores (Supabase + JSON fallback) ────────────
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Admin } from './types.js';
import { supabase, isSupabaseConfigured, DbAdmin } from '../lib/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ADMINS_PATH = path.join(__dirname, '..', 'admins.json');

interface AdminStore {
    admins: Admin[];
}

// ─── Helpers para convertir entre formatos ──────────────────────────────────
function dbToAdmin(db: DbAdmin): Admin {
    return {
        id: db.id,
        email: db.email,
        password: db.password,
        nombre: db.nombre,
        emailVerificado: db.verificado,
        tokenVerificacion: db.token_verificacion,
        tokenExpiracion: db.token_expiracion,
        creadoEn: db.creado_en,
        actualizadoEn: db.creado_en
    };
}

function adminToDb(admin: Admin): Partial<DbAdmin> {
    return {
        id: admin.id,
        email: admin.email,
        password: admin.password,
        nombre: admin.nombre,
        verificado: admin.emailVerificado,
        token_verificacion: admin.tokenVerificacion,
        token_expiracion: admin.tokenExpiracion,
        creado_en: admin.creadoEn
    };
}

// ─── Fallback JSON (cuando Supabase no está configurado) ────────────────────
function readAdmins(): AdminStore {
    try {
        if (fs.existsSync(ADMINS_PATH)) {
            return JSON.parse(fs.readFileSync(ADMINS_PATH, 'utf-8'));
        }
        return { admins: [] };
    } catch {
        return { admins: [] };
    }
}

function writeAdmins(store: AdminStore): void {
    fs.writeFileSync(ADMINS_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

// ─── Funciones CRUD ──────────────────────────────────────────────────────────

export async function buscarAdminPorEmail(email: string): Promise<Admin | undefined> {
    if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
            .from('admins')
            .select('*')
            .ilike('email', email)
            .single();
        
        if (error || !data) return undefined;
        return dbToAdmin(data);
    }
    
    // Fallback JSON
    const store = readAdmins();
    return store.admins.find(a => a.email.toLowerCase() === email.toLowerCase());
}

export async function buscarAdminPorId(id: string): Promise<Admin | undefined> {
    if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
            .from('admins')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error || !data) return undefined;
        return dbToAdmin(data);
    }
    
    // Fallback JSON
    const store = readAdmins();
    return store.admins.find(a => a.id === id);
}

export async function crearAdmin(admin: Admin): Promise<Admin> {
    if (isSupabaseConfigured() && supabase) {
        // No enviar el ID, dejar que Supabase genere el UUID
        const { data, error } = await supabase
            .from('admins')
            .insert({
                email: admin.email,
                password: admin.password,
                nombre: admin.nombre,
                verificado: admin.emailVerificado,
                token_verificacion: admin.tokenVerificacion,
                token_expiracion: admin.tokenExpiracion
            })
            .select()
            .single();
        
        if (error) {
            console.error('Error creando admin en Supabase:', error);
            throw new Error('Error al crear administrador');
        }
        return dbToAdmin(data);
    }
    
    // Fallback JSON
    const store = readAdmins();
    store.admins.push(admin);
    writeAdmins(store);
    return admin;
}

export async function actualizarAdmin(id: string, datos: Partial<Admin>): Promise<Admin | null> {
    if (isSupabaseConfigured() && supabase) {
        const updateData: Record<string, unknown> = {};
        if (datos.email !== undefined) updateData.email = datos.email;
        if (datos.password !== undefined) updateData.password = datos.password;
        if (datos.nombre !== undefined) updateData.nombre = datos.nombre;
        if (datos.emailVerificado !== undefined) updateData.verificado = datos.emailVerificado;
        if (datos.tokenVerificacion !== undefined) updateData.token_verificacion = datos.tokenVerificacion;
        if (datos.tokenExpiracion !== undefined) updateData.token_expiracion = datos.tokenExpiracion;
        
        const { data, error } = await supabase
            .from('admins')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        
        if (error || !data) return null;
        return dbToAdmin(data);
    }
    
    // Fallback JSON
    const store = readAdmins();
    const index = store.admins.findIndex(a => a.id === id);
    
    if (index === -1) return null;
    
    store.admins[index] = {
        ...store.admins[index],
        ...datos,
        actualizadoEn: new Date().toISOString()
    };
    
    writeAdmins(store);
    return store.admins[index];
}

export async function eliminarAdmin(id: string): Promise<boolean> {
    if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase
            .from('admins')
            .delete()
            .eq('id', id);
        
        return !error;
    }
    
    // Fallback JSON
    const store = readAdmins();
    const index = store.admins.findIndex(a => a.id === id);
    
    if (index === -1) return false;
    
    store.admins.splice(index, 1);
    writeAdmins(store);
    return true;
}

export async function obtenerTodosLosAdmins(): Promise<Admin[]> {
    if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
            .from('admins')
            .select('*');
        
        if (error || !data) return [];
        return data.map(dbToAdmin);
    }
    
    // Fallback JSON
    const store = readAdmins();
    return store.admins;
}
