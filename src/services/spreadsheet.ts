import * as XLSX from 'xlsx';
import type { Alumno } from '../types';

type RawRow = Record<string, string | number | undefined>;

const COLUMN_MAP: Record<string, keyof Omit<Alumno, 'id' | 'fechaRegistro'> | 'apellido'> = {
    // Nombre completo (cuando viene todo junto)
    alumno: 'nombre', 'nombre completo': 'nombre', 'apellido y nombre': 'nombre',
    'nombre y apellido': 'nombre', 'nombre apellido': 'nombre',
    socio: 'nombre', cliente: 'nombre', estudiante: 'nombre', integrante: 'nombre',
    // Nombre (solo nombre de pila)
    nombre: 'nombre', name: 'nombre', 'first name': 'nombre', firstname: 'nombre',
    first_name: 'nombre', nombres: 'nombre',
    // Apellido (columna separada)
    apellido: 'apellido', apellidos: 'apellido', surname: 'apellido',
    'last name': 'apellido', lastname: 'apellido', last_name: 'apellido',
    // WhatsApp
    whatsapp: 'whatsapp', telefono: 'whatsapp', 'teléfono': 'whatsapp',
    tel: 'whatsapp', celular: 'whatsapp', phone: 'whatsapp',
    movil: 'whatsapp', 'móvil': 'whatsapp', contacto: 'whatsapp',
    numero: 'whatsapp', 'número': 'whatsapp',
    'numero de telefono': 'whatsapp', 'número de teléfono': 'whatsapp',
    'tel/cel': 'whatsapp', cel: 'whatsapp', 'num': 'whatsapp',
    // Email
    email: 'email', correo: 'email', mail: 'email',
    'correo electronico': 'email', 'correo electrónico': 'email',
    // Plan
    plan: 'plan', 'tipo de plan': 'plan', categoria: 'plan',
    'categoría': 'plan', modalidad: 'plan',
    // Cuota
    cuota: 'cuota', monto: 'cuota', precio: 'cuota', valor: 'cuota',
    importe: 'cuota', tarifa: 'cuota', mensualidad: 'cuota',
    'valor cuota': 'cuota', 'monto cuota': 'cuota',
    // Nivel
    nivel: 'nivel', cinturon: 'nivel', 'cinturón': 'nivel',
    belt: 'nivel', grado: 'nivel', faja: 'nivel',
    // Notas
    notas: 'notas', observaciones: 'notas', notes: 'notas',
    comentarios: 'notas', descripcion: 'notas', obs: 'notas',
};

function mapColumnName(raw: string): string | null {
    const lower = raw.toLowerCase().trim();
    return COLUMN_MAP[lower] || null;
}

function normalizePlan(val: string): 'libre' | '3x' {
    const l = val.toLowerCase().trim();
    if (l.includes('3') || l.includes('tres') || l.includes('semana')) return '3x';
    return 'libre';
}

function normalizeNivel(val: string): Alumno['nivel'] {
    const l = val.toLowerCase().trim();
    if (l.includes('gris') || l.includes('gray') || l.includes('grey')) return 'gris';
    if (l.includes('amar') || l.includes('yellow')) return 'amarillo';
    if (l.includes('azul') || l.includes('blue')) return 'azul';
    if (l.includes('mora') || l.includes('morad') || l.includes('purple') ||
        l.includes('purp') || l.includes('violet') || l.includes('viola')) return 'morado';
    if (l.includes('marr') || l.includes('brown')) return 'marron';
    if (l.includes('negr') || l.includes('black')) return 'negro';
    return 'blanco';
}

export function parseExcelFile(
    file: File
): Promise<{ headers: string[]; rows: RawRow[]; mapped: Omit<Alumno, 'id' | 'fechaRegistro'>[] }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target!.result as ArrayBuffer);
                const wb = XLSX.read(data, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const json: RawRow[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

                if (json.length === 0) {
                    reject(new Error('El archivo está vacío'));
                    return;
                }

                const headers = Object.keys(json[0]);
                const mapped = json
                    .map((row) => {
                        const alumno: Record<string, any> = {
                            nombre: '',
                            whatsapp: '',
                            plan: 'libre',
                            cuota: 0,
                            nivel: 'blanco',
                        };
                        let apellido = '';

                        for (const [rawKey, value] of Object.entries(row)) {
                            const mappedKey = mapColumnName(rawKey);
                            if (mappedKey && value !== undefined && value !== '') {
                                if (mappedKey === 'cuota') {
                                    alumno.cuota = parseInt(String(value).replace(/\D/g, ''), 10) || 0;
                                } else if (mappedKey === 'plan') {
                                    alumno.plan = normalizePlan(String(value));
                                } else if (mappedKey === 'nivel') {
                                    alumno.nivel = normalizeNivel(String(value));
                                } else if (mappedKey === 'whatsapp') {
                                    alumno.whatsapp = String(value).replace(/\D/g, '');
                                } else if (mappedKey === 'apellido') {
                                    apellido = String(value).trim();
                                } else {
                                    alumno[mappedKey] = String(value);
                                }
                            }
                        }

                        // Combinar nombre y apellido si ambos existen
                        if (apellido && alumno.nombre) {
                            alumno.nombre = `${alumno.nombre.trim()} ${apellido}`;
                        } else if (apellido && !alumno.nombre) {
                            alumno.nombre = apellido;
                        }

                        return alumno as Omit<Alumno, 'id' | 'fechaRegistro'>;
                    })
                    .filter((a) => a.nombre && a.whatsapp);

                resolve({ headers, rows: json, mapped });
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Error leyendo archivo'));
        reader.readAsArrayBuffer(file);
    });
}

export function parseCSVText(
    text: string
): Omit<Alumno, 'id' | 'fechaRegistro'>[] {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim());
    const result: Omit<Alumno, 'id' | 'fechaRegistro'>[] = [];

    for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map((v) => v.trim());
        if (vals.length !== headers.length) continue;

        const alumno: Record<string, any> = {
            nombre: '',
            whatsapp: '',
            plan: 'libre',
            cuota: 0,
            nivel: 'blanco',
        };
        let apellido = '';

        headers.forEach((h, idx) => {
            const key = mapColumnName(h);
            if (key && vals[idx]) {
                if (key === 'cuota')
                    alumno.cuota = parseInt(vals[idx].replace(/\D/g, ''), 10) || 0;
                else if (key === 'plan') alumno.plan = normalizePlan(vals[idx]);
                else if (key === 'nivel') alumno.nivel = normalizeNivel(vals[idx]);
                else if (key === 'whatsapp')
                    alumno.whatsapp = vals[idx].replace(/\D/g, '');
                else if (key === 'apellido')
                    apellido = vals[idx].trim();
                else alumno[key] = vals[idx];
            }
        });

        // Combinar nombre y apellido si ambos existen
        if (apellido && alumno.nombre) {
            alumno.nombre = `${alumno.nombre.trim()} ${apellido}`;
        } else if (apellido && !alumno.nombre) {
            alumno.nombre = apellido;
        }

        if (alumno.nombre && alumno.whatsapp) {
            result.push(alumno as Omit<Alumno, 'id' | 'fechaRegistro'>);
        }
    }

    return result;
}
