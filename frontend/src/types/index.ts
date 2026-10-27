export type EstadoAlumno = 'activo' | 'becado' | 'inactivo';

export type CategoriaAlumno = 'adulto' | 'kids';

export type RecordatorioTipo = 'manual' | 'primer_recordatorio' | 'segundo_recordatorio';

export type RecordatorioMap = Record<string, Partial<Record<RecordatorioTipo, string>>>;

export interface Alumno {
    id: string;
    nombre: string;
    whatsapp: string;
    email?: string;
    plan: 'libre' | '3x';
    cuota: number;
    nivel: 'blanco' | 'gris' | 'amarillo' | 'azul' | 'morado' | 'marron' | 'negro';
    estado: EstadoAlumno; // activo = recibe recordatorios, otros = no recibe
    categoria?: CategoriaAlumno; // 'adulto' | 'kids' (5-12 años)
    edad?: number;
    tutor?: string; // Nombre del padre / tutor
    notas?: string;
    fechaRegistro: string;
    diaVencimiento?: number; // día del mes en que vence su cuota (1-31). Si no se define, usa diaEnvio global.
}

export const ESTADO_LABELS: Record<EstadoAlumno, string> = {
    activo: '✅ Activo',
    becado: '🎓 Becado',
    inactivo: '❌ Inactivo',
};

export interface PagoMensual {
    alumnoId: string;
    mes: number;
    anio: number;
    estado: 'pagado' | 'pendiente' | 'vencido';
    fechaPago?: string;
    monto: number;
}

export interface AppConfig {
    ycloudApiKey: string;
    ycloudWhatsAppNumber: string;
    diaEnvio: number;
    mensajePlantilla: string;
    datosPago: string;
    datosPagoKids?: string;
}

export interface ActivityLog {
    type: 'sent' | 'pending' | 'failed' | 'payment' | 'register' | 'config';
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

export interface EnvioManualStatus {
    enProgreso: boolean;
    total: number;
    enviados: number;
    fallidos: number;
    alumnoActualId: string;
    resultados: Record<string, 'pending' | 'sending' | 'sent' | 'error'>;
    cancelRequest: boolean;
}
