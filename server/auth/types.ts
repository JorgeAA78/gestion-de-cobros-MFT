// ─── Tipos para el sistema de autenticación ─────────────────────────────────

export interface Admin {
    id: string;
    email: string;
    password: string; // Hash bcrypt
    nombre: string;
    emailVerificado: boolean;
    tokenVerificacion: string | null;
    tokenExpiracion: string | null;
    creadoEn: string;
    actualizadoEn: string;
}

export interface TokenPayload {
    adminId: string;
    email: string;
}

export interface RegistroRequest {
    email: string;
    password: string;
    nombre: string;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface VerificarEmailRequest {
    email: string;
    token: string;
}

export interface ReenviarTokenRequest {
    email: string;
}

export interface Invitacion {
    id: string;
    codigo: string;
    creadoPor: string; // ID del admin que la creó
    creadoEn: string;
    expiraEn: string;
    usado: boolean;
    usadoPor: string | null; // Email del usuario que la usó
    usadoEn: string | null;
}
