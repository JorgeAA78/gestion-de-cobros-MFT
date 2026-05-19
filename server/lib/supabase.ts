// ─── Cliente Supabase para el Backend ───────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env desde la raíz del proyecto
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('⚠️ Variables de Supabase no configuradas. Usando almacenamiento local.');
    console.warn('   SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
    console.warn('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
} else {
    console.log('✅ Supabase configurado:', supabaseUrl);
}

// Cliente con service_role para operaciones del backend (bypasses RLS)
export const supabase = supabaseUrl && supabaseServiceKey 
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
    : null;

export const isSupabaseConfigured = (): boolean => {
    return supabase !== null;
};

// ─── Tipos de la base de datos ──────────────────────────────────────────────
export interface DbAdmin {
    id: string;
    email: string;
    password: string;
    nombre: string;
    verificado: boolean;
    token_verificacion: string | null;
    token_expiracion: string | null;
    creado_en: string;
}

export interface DbInvitacion {
    id: string;
    codigo: string;
    creado_por: string;
    creado_en: string;
    expira_en: string;
    usado: boolean;
    usado_por: string | null;
    usado_en: string | null;
}

export interface DbAlumno {
    id: string;
    nombre: string;
    whatsapp: string;
    plan: 'libre' | '3x';
    cuota: number;
    dia_vencimiento: number;
    estado: 'activo' | 'becado' | 'suspendido' | 'inactivo';
    activo: boolean;
    creado_en: string;
    actualizado_en: string;
}

export interface DbPago {
    id: string;
    alumno_id: string;
    mes: number;
    anio: number;
    monto: number;
    estado: 'pendiente' | 'pagado' | 'vencido';
    fecha_pago: string | null;
    creado_en: string;
}

export interface DbActividad {
    id: string;
    tipo: 'sent' | 'payment' | 'register' | 'config';
    mensaje: string;
    timestamp: string;
}

export interface DbRecordatorioEnviado {
    id: string;
    alumno_id: string;
    mes: number;
    anio: number;
    fecha_envio: string;
}
