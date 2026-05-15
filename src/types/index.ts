export interface Alumno {
    id: string;
    nombre: string;
    whatsapp: string;
    email?: string;
    plan: 'libre' | '3x';
    cuota: number;
    nivel: 'blanco' | 'gris' | 'amarillo' | 'azul' | 'morado' | 'marron' | 'negro';
    notas?: string;
    fechaRegistro: string;
    diaVencimiento?: number; // día del mes en que vence su cuota (1-31). Si no se define, usa diaEnvio global.
}

export interface PagoMensual {
    alumnoId: string;
    mes: number;
    anio: number;
    estado: 'pagado' | 'pendiente' | 'vencido';
    fechaPago?: string;
    monto: number;
}

export interface AppConfig {
    evolutionApiUrl: string;
    evolutionApiKey: string;
    evolutionInstance: string;
    diaEnvio: number;
    mensajePlantilla: string;
    datosPago: string;
}

export interface ActivityLog {
    type: 'sent' | 'pending' | 'failed';
    message: string;
    timestamp: string;
}

export const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const MONTH_SHORT = [
    'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
    'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC',
];
