// ─── Servicio de autenticación para el frontend ──────────────────────────────

const API_URL = (import.meta as any).env?.PROD ? '' : 'http://localhost:3001';

interface RegistroData {
    email: string;
    password: string;
    nombre: string;
    codigoInvitacion: string;
}

interface LoginData {
    email: string;
    password: string;
}

interface VerificarData {
    email: string;
    token: string;
}

interface AuthResponse {
    mensaje: string;
    token?: string;
    admin?: {
        id: string;
        email: string;
        nombre: string;
    };
    requiereVerificacion?: boolean;
    tokenDebug?: string;
    error?: string;
}

// ─── Registro de nuevo administrador ─────────────────────────────────────────
export async function registrarAdmin(data: RegistroData): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/api/auth/registro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return response.json();
}

// ─── Verificar email con token ───────────────────────────────────────────────
export async function verificarEmail(data: VerificarData): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/api/auth/verificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return response.json();
}

// ─── Reenviar token de verificación ──────────────────────────────────────────
export async function reenviarToken(email: string): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/api/auth/reenviar-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    return response.json();
}

// ─── Login ───────────────────────────────────────────────────────────────────
export async function loginAdmin(data: LoginData): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return response.json();
}

// ─── Obtener perfil del admin autenticado ────────────────────────────────────
export async function obtenerPerfil(token: string): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/api/auth/me`, {
        method: 'GET',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
    });
    return response.json();
}

// ─── Validar código de invitación ────────────────────────────────────────────
export async function validarCodigoInvitacion(codigo: string): Promise<{ valido: boolean; mensaje: string }> {
    const response = await fetch(`${API_URL}/api/auth/invitaciones/validar/${codigo}`);
    return response.json();
}

// ─── Gestión de invitaciones (requiere autenticación) ────────────────────────
export async function generarInvitacion(token: string, diasValidez: number = 7): Promise<any> {
    const response = await fetch(`${API_URL}/api/auth/invitaciones`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ diasValidez }),
    });
    return response.json();
}

export async function listarInvitaciones(token: string): Promise<any> {
    const response = await fetch(`${API_URL}/api/auth/invitaciones`, {
        headers: { 
            'Authorization': `Bearer ${token}`
        },
    });
    return response.json();
}

export async function eliminarInvitacion(token: string, id: string): Promise<any> {
    const response = await fetch(`${API_URL}/api/auth/invitaciones/${id}`, {
        method: 'DELETE',
        headers: { 
            'Authorization': `Bearer ${token}`
        },
    });
    return response.json();
}

// ─── Utilidades de token ─────────────────────────────────────────────────────
export function guardarToken(token: string): void {
    localStorage.setItem('auth_token', token);
}

export function obtenerToken(): string | null {
    return localStorage.getItem('auth_token');
}

export function eliminarToken(): void {
    localStorage.removeItem('auth_token');
}

export function estaAutenticado(): boolean {
    return !!obtenerToken();
}
