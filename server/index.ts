// Ignorar errores de certificado SSL únicamente en desarrollo
if (process.env.NODE_ENV !== 'production') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { authRoutes } from './auth/index.js';
import {
    obtenerTodo,
    sincronizarTodo,
    crearAlumno,
    crearAlumnosBulk,
    eliminarAlumno,
    eliminarAlumnosBulk,
    actualizarAlumno,
    marcarPagado,
    marcarPendiente,
    agregarActividad,
    obtenerConfig,
    guardarConfig,
    registrarRecordatorioEnviado,
    eliminarRecordatorioEnviado,
    obtenerRecordatoriosEnviados,
    obtenerMensajesEnviados,
    incrementarMensajesEnviados,
    type DataStore,
    type Alumno,
    type Pago,
    type RecordatoriosMap,
    type RecordatorioTipo
} from './lib/data.store.js';

dotenv.config();

// ─── Data Store ──────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, 'data.json');

// Funciones legacy para compatibilidad con cron (usa JSON local para enviosRealizados)
function readDataLocal(): DataStore {
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

function writeDataLocal(data: DataStore) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── WhatsApp Helpers ────────────────────────────────────────
const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

async function sendWhatsApp(apiUrl: string, apiKey: string, instance: string, number: string, text: string) {
    try {
        const res = await fetch(`${apiUrl}/message/sendText/${instance}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: apiKey },
            body: JSON.stringify({ number, text }),
        });
        return res.ok ? { success: true } : { success: false, error: `HTTP ${res.status}` };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

function buildMessage(template: string, vars: Record<string, string>) {
    let msg = template;
    for (const [k, v] of Object.entries(vars)) {
        msg = msg.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return msg;
}

function formatCurrency(n: number) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n);
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function randomDelay(index: number) {
    // Cada 10 mensajes, pausa más larga (5-8 min)
    if (index > 0 && index % 10 === 0) {
        const sec = Math.floor(Math.random() * (480 - 300 + 1)) + 300;
        console.log(`  ⏸️ Pausa larga entre lotes... (${Math.round(sec/60)} min)`);
        return delay(sec * 1000);
    }
    // Delay normal entre mensajes
    const sec = Math.floor(Math.random() * (240 - 120 + 1)) + 120;
    console.log(`  ⏳ Esperando ${sec}s antes del próximo mensaje...`);
    return delay(sec * 1000);
}

// ─── Cron: Envío Automático ─────────────────────────────────
// Primer recordatorio: Días 1-5 (aviso de cuota disponible)
// Segundo recordatorio: Días 10-14 (solo a los que no pagaron Y ya vencieron)
const DIAS_PRIMER_ENVIO = [1, 2, 3, 4, 5];
const DIAS_SEGUNDO_ENVIO = [10, 11, 12, 13, 14];
const DIA_VENCIMIENTO_DEFAULT = 10; // La mayoría vence el 10

function getPendientes(alumnos: Alumno[], pagos: Pago[], mes: number, anio: number) {
    return alumnos.filter((a) => {
        // Solo alumnos activos reciben recordatorios
        if (a.estado && a.estado !== 'activo') return false;
        const pago = pagos.find((p) => p.alumnoId === a.id && p.mes === mes && p.anio === anio);
        return !pago || pago.estado !== 'pagado';
    });
}

// Divide alumnos en grupos para cada día de envío
function getAlumnosParaHoy(alumnos: Alumno[], diaActual: number, diasEnvio: number[]): Alumno[] {
    if (!diasEnvio.includes(diaActual)) {
        return []; // No es día de envío
    }

    const totalAlumnos = alumnos.length;
    const totalDias = diasEnvio.length;
    const alumnosPorDia = Math.ceil(totalAlumnos / totalDias);

    // Índice del día actual
    const indiceDia = diasEnvio.indexOf(diaActual);

    // Calcular rango de alumnos para hoy
    const inicio = indiceDia * alumnosPorDia;
    const fin = Math.min(inicio + alumnosPorDia, totalAlumnos);

    return alumnos.slice(inicio, fin);
}

// Templates de mensajes
const TEMPLATE_PRIMER_RECORDATORIO = `¡Hola {nombre}! 👋

Te recordamos que la cuota de *{mes}* ya está disponible para abonar:

💰 Monto: *{monto}*
📋 Plan: *{plan}*
📅 Fecha límite: {fecha}
Alias: mutantesbjj
a nombre de: Pablo Sebastian Echazu Bloser

*Por favor, enviar comprobante al realizar el pago*

Te esperamos en el tatami!

_Mutantes Fight Team - BJJ_`;

const TEMPLATE_SEGUNDO_RECORDATORIO = `¡Hola {nombre}! 👋

Te recordamos que la cuota de *{mes}* está pendiente:

💰 Monto: *{monto}*
📋 Plan: *{plan}*

Alias: mutantesbjj
a nombre de: Pablo Sebastian Echazu Bloser

*Por favor, enviar comprobante al realizar el pago*

Te esperamos en el tatami!

_Mutantes Fight Team - BJJ_`;

async function envioAutomatico() {
    const data = await obtenerTodo();
    // Obtener la configuración no enmascarada para evitar usar '••••••••' en las peticiones reales
    const config = await obtenerConfig();

    if (!config.evolutionApiUrl || !config.evolutionApiKey || !config.evolutionInstance) {
        console.log('⏭️  [CRON] Evolution API no configurada, saltando...');
        return;
    }

    const now = new Date();
    const dia = now.getDate();
    const mes = now.getMonth() + 1;
    const anio = now.getFullYear();

    console.log(`⏰ [CRON] ${now.toLocaleString('es-AR')} — Día ${dia} del mes`);

    // Determinar si es primer o segundo envío
    const esPrimerEnvio = DIAS_PRIMER_ENVIO.includes(dia);
    const esSegundoEnvio = DIAS_SEGUNDO_ENVIO.includes(dia);

    if (!esPrimerEnvio && !esSegundoEnvio) {
        console.log(`⏭️  [CRON] Hoy es día ${dia}. Los envíos son del 1-5 y 10-14. Saltando...`);
        return;
    }

    const tipoEnvio = esPrimerEnvio ? 'primer_recordatorio' : 'segundo_recordatorio';
    const diasEnvio = esPrimerEnvio ? DIAS_PRIMER_ENVIO : DIAS_SEGUNDO_ENVIO;

    // Obtener todos los pendientes del mes (SOLO los que NO pagaron)
    let todosPendientes = getPendientes(data.alumnos, data.pagos, mes, anio);

    if (todosPendientes.length === 0) {
        console.log(`✅ [CRON] No hay alumnos con pagos pendientes este mes.`);
        return;
    }

    // Para el SEGUNDO recordatorio: solo enviar a los que YA VENCIERON
    if (esSegundoEnvio) {
        const pendientesVencidos = todosPendientes.filter((a) => {
            const diaVenc = a.diaVencimiento ?? DIA_VENCIMIENTO_DEFAULT;
            const yaVencio = dia >= diaVenc;
            if (!yaVencio) {
                console.log(`  ⏭️ ${a.nombre} — Vence el día ${diaVenc}, aún no venció. Saltando.`);
            }
            return yaVencio;
        });

        console.log(`📋 [CRON] Alumnos pendientes: ${todosPendientes.length}, Ya vencidos: ${pendientesVencidos.length}`);
        todosPendientes = pendientesVencidos;

        if (todosPendientes.length === 0) {
            console.log(`✅ [CRON] Ningún alumno tiene cuota vencida aún.`);
            return;
        }
    }

    // Filtrar los que ya recibieron ESTE TIPO de mensaje este mes
    const recordatoriosMap = (data.recordatoriosEnviados ?? {}) as RecordatoriosMap;
    const pendientesSinNotificar = todosPendientes.filter((a) => {
        const key = `${a.id}_${mes}_${anio}`;
        const enviados = recordatoriosMap[key];
        if (!enviados) return true;
        if (enviados[tipoEnvio as RecordatorioTipo]) return false;
        // Si se envió manualmente, también evitamos duplicar
        if (enviados.manual) return false;
        return true;
    });

    if (pendientesSinNotificar.length === 0) {
        const tipoTexto = esPrimerEnvio ? 'primer' : 'segundo';
        console.log(`✅ [CRON] Todos los alumnos pendientes ya recibieron el ${tipoTexto} recordatorio.`);
        return;
    }

    // Obtener solo los alumnos que corresponden a hoy
    const alumnosHoy = getAlumnosParaHoy(pendientesSinNotificar, dia, diasEnvio);

    if (alumnosHoy.length === 0) {
        console.log(`✅ [CRON] No hay alumnos asignados para enviar hoy (día ${dia}).`);
        return;
    }

    const totalPendientes = pendientesSinNotificar.length;
    const alumnosPorDia = Math.ceil(totalPendientes / diasEnvio.length);
    const tipoTexto = esPrimerEnvio ? '1er RECORDATORIO' : '2do RECORDATORIO';

    console.log(`📊 [CRON] ${tipoTexto}: ${totalPendientes} alumnos ÷ ${diasEnvio.length} días = ~${alumnosPorDia} por día`);
    console.log(`📱 [CRON] Día ${dia}: Enviando a ${alumnosHoy.length} alumnos...`);

    // Seleccionar template según tipo de envío
    const template = esPrimerEnvio
        ? (config.mensajePlantilla || TEMPLATE_PRIMER_RECORDATORIO)
        : TEMPLATE_SEGUNDO_RECORDATORIO;

    let sent = 0, failed = 0;

    for (let i = 0; i < alumnosHoy.length; i++) {
        const a = alumnosHoy[i];

        // Usar el día de vencimiento individual del alumno
        const diaVenc = a.diaVencimiento ?? DIA_VENCIMIENTO_DEFAULT;

        let msg = buildMessage(template, {
            nombre: a.nombre,
            monto: formatCurrency(a.cuota),
            mes: MONTHS[mes - 1],
            plan: a.plan === 'libre' ? 'Libre' : '3 Veces por Semana',
            fecha: `${diaVenc} de ${MONTHS[mes - 1]}`
        });

        const res = await sendWhatsApp(config.evolutionApiUrl, config.evolutionApiKey, config.evolutionInstance, a.whatsapp, msg);

        if (res.success) {
            sent++;
            console.log(`  ✅ ${a.nombre} — Enviado`);
            await registrarRecordatorioEnviado(a.id, mes, anio, tipoEnvio as RecordatorioTipo);
        } else {
            failed++;
            console.log(`  ❌ ${a.nombre} — Error: ${res.error}`);
        }

        // Delay anti-spam entre mensajes
        if (i < alumnosHoy.length - 1) await randomDelay(i + 1);
    }

    if (sent > 0) {
        await incrementarMensajesEnviados(sent);
    }

    await agregarActividad({
        type: 'sent',
        message: `🤖 [AUTO] ${tipoTexto} ${MONTHS[mes - 1]}: ${sent} enviados, ${failed} fallidos`,
        timestamp: now.toISOString(),
    });

    console.log(`✅ [CRON] Completado: ${sent} enviados, ${failed} con error`);
}

// ─── Estado del Envío Manual Asíncrono en Segundo Plano ─────
let statusEnvioManual = {
    enProgreso: false,
    total: 0,
    enviados: 0,
    fallidos: 0,
    alumnoActualId: '',
    resultados: {} as Record<string, 'pending' | 'sending' | 'sent' | 'error'>,
    cancelRequest: false,
};

// ─── Express Server ─────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// Importar middleware de autenticación
import { authMiddleware } from './auth/index.js';

// ─── Rutas de Autenticación ─────────────────────────────────
app.use('/api/auth', authRoutes);

// --- API Routes (Protegidas por JWT) ---

// GET all data
app.get('/api/data', authMiddleware, async (_req, res) => {
    try {
        const data = await obtenerTodo();
        res.json(data);
    } catch (error) {
        console.error('Error obteniendo datos:', error);
        res.status(500).json({ error: 'Error al obtener datos' });
    }
});

// PUT full sync (frontend pushes state)
app.put('/api/data', authMiddleware, async (req, res) => {
    try {
        await sincronizarTodo(req.body);
        res.json({ ok: true });
    } catch (error) {
        console.error('Error sincronizando datos:', error);
        res.status(500).json({ error: 'Error al sincronizar datos' });
    }
});

// POST alumno
app.post('/api/alumnos', authMiddleware, async (req, res) => {
    try {
        const alumno = await crearAlumno(req.body);
        res.json({ ok: true, alumno });
    } catch (error) {
        console.error('Error creando alumno:', error);
        res.status(500).json({ error: 'Error al crear alumno' });
    }
});

// POST import alumnos
app.post('/api/alumnos/import', authMiddleware, async (req, res) => {
    try {
        const list = req.body.alumnos || [];
        const alumnos = await crearAlumnosBulk(list);
        res.json({ ok: true, count: alumnos.length });
    } catch (error) {
        console.error('Error importando alumnos:', error);
        res.status(500).json({ error: 'Error al importar alumnos' });
    }
});

// PUT alumno (update individual fields like estado)
app.put('/api/alumnos/:id', authMiddleware, async (req, res) => {
    try {
        const ok = await actualizarAlumno(req.params.id as string, req.body);
        if (ok) {
            res.json({ ok: true });
        } else {
            res.status(404).json({ error: 'Alumno no encontrado' });
        }
    } catch (error) {
        console.error('Error actualizando alumno:', error);
        res.status(500).json({ error: 'Error al actualizar alumno' });
    }
});

// DELETE alumno
app.delete('/api/alumnos/:id', authMiddleware, async (req, res) => {
    try {
        await eliminarAlumno(req.params.id as string);
        res.json({ ok: true });
    } catch (error) {
        console.error('Error eliminando alumno:', error);
        res.status(500).json({ error: 'Error al eliminar alumno' });
    }
});

// DELETE multiple alumnos
app.post('/api/alumnos/delete-bulk', authMiddleware, async (req, res) => {
    try {
        const ids = req.body.ids || [];
        await eliminarAlumnosBulk(ids);
        res.json({ ok: true, count: ids.length });
    } catch (error) {
        console.error('Error eliminando alumnos:', error);
        res.status(500).json({ error: 'Error al eliminar alumnos' });
    }
});

// POST pago
app.post('/api/pagos', authMiddleware, async (req, res) => {
    try {
        const { alumnoId, mes, anio, estado, monto } = req.body;
        if (estado === 'pagado') {
            await marcarPagado(alumnoId, mes, anio, monto);
        } else {
            await marcarPendiente(alumnoId, mes, anio);
        }
        res.json({ ok: true });
    } catch (error) {
        console.error('Error actualizando pago:', error);
        res.status(500).json({ error: 'Error al actualizar pago' });
    }
});

// PUT config
app.put('/api/config', authMiddleware, async (req, res) => {
    try {
        const currentConfig = await obtenerConfig();
        await guardarConfig({ ...currentConfig, ...req.body });
        res.json({ ok: true });
    } catch (error) {
        console.error('Error guardando config:', error);
        res.status(500).json({ error: 'Error al guardar configuración' });
    }
});

// POST activity
app.post('/api/activity', authMiddleware, async (req, res) => {
    try {
        await agregarActividad(req.body);
        res.json({ ok: true });
    } catch (error) {
        console.error('Error agregando actividad:', error);
        res.status(500).json({ error: 'Error al agregar actividad' });
    }
});

// POST increment messages
app.post('/api/mensajes/increment', authMiddleware, async (req, res) => {
    try {
        const total = await incrementarMensajesEnviados(req.body.count || 1);
        res.json({ ok: true, total });
    } catch (error) {
        console.error('Error incrementando mensajes:', error);
        res.status(500).json({ error: 'Error al actualizar contador de mensajes' });
    }
});

// POST recordatorios
app.post('/api/recordatorios', authMiddleware, async (req, res) => {
    try {
        const { alumnoId, mes, anio } = req.body;
        const tipo = (req.body.tipo as RecordatorioTipo) || 'manual';
        await registrarRecordatorioEnviado(alumnoId, mes, anio, tipo);
        if (tipo !== 'manual') {
            await incrementarMensajesEnviados(1);
        }
        const total = await obtenerMensajesEnviados();
        res.json({ ok: true, total });
    } catch (error) {
        console.error('Error registrando recordatorio:', error);
        res.status(500).json({ error: 'Error al registrar recordatorio' });
    }
});

// DELETE recordatorios
app.delete('/api/recordatorios/:alumnoId/:mes/:anio/:tipo', authMiddleware, async (req, res) => {
    try {
        const alumnoId = req.params.alumnoId as string;
        const mes = req.params.mes as string;
        const anio = req.params.anio as string;
        const tipoRaw = (req.params as { tipo?: string }).tipo;
        const tipoParam: RecordatorioTipo = (tipoRaw as RecordatorioTipo) || 'manual';
        await eliminarRecordatorioEnviado(alumnoId, parseInt(mes), parseInt(anio), tipoParam);
        res.json({ ok: true });
    } catch (error) {
        console.error('Error eliminando recordatorio:', error);
        res.status(500).json({ error: 'Error al eliminar recordatorio' });
    }
});

// GET status del envío manual asíncrono
app.get('/api/recordatorios/status-manual', authMiddleware, (_req, res) => {
    res.json(statusEnvioManual);
});

// POST iniciar envío manual en segundo plano
app.post('/api/recordatorios/send-manual', authMiddleware, async (req, res) => {
    try {
        const { alumnoIds, template, mes, anio } = req.body;
        
        if (!alumnoIds || !Array.isArray(alumnoIds) || alumnoIds.length === 0) {
            return res.status(400).json({ error: 'Lista de alumnos inválida' });
        }
        
        if (statusEnvioManual.enProgreso) {
            return res.status(400).json({ error: 'Ya hay un envío de recordatorios en progreso' });
        }
        
        // Inicializar el estado
        const resultados: Record<string, 'pending' | 'sending' | 'sent' | 'error'> = {};
        alumnoIds.forEach((id) => {
            resultados[id] = 'pending';
        });
        
        statusEnvioManual = {
            enProgreso: true,
            total: alumnoIds.length,
            enviados: 0,
            fallidos: 0,
            alumnoActualId: '',
            resultados,
            cancelRequest: false,
        };
        
        // Responder inmediatamente al frontend
        res.json({ ok: true, mensaje: 'Envío de recordatorios iniciado en segundo plano' });
        
        // Ejecutar el proceso en segundo plano asíncronamente
        (async () => {
            console.log(`\n🚀 [MANUAL BACKGROUND] Iniciando envío de ${alumnoIds.length} recordatorios...`);
            let mensajesIntentados = 0;
            try {
                const config = await obtenerConfig();
                
                if (!config.evolutionApiUrl || !config.evolutionApiKey || !config.evolutionInstance) {
                    console.error('❌ [MANUAL BACKGROUND] Evolution API no configurada en el servidor');
                    statusEnvioManual.enProgreso = false;
                    return;
                }
                
                for (let i = 0; i < alumnoIds.length; i++) {
                    // Verificar si se solicitó cancelación antes de procesar el elemento
                    if (statusEnvioManual.cancelRequest) {
                        console.log('🛑 [MANUAL BACKGROUND] Envío cancelado por el usuario.');
                        break;
                    }
                    
                    const alumnoId = alumnoIds[i];
                    statusEnvioManual.alumnoActualId = alumnoId;
                    statusEnvioManual.resultados[alumnoId] = 'sending';
                    
                    // Obtener datos frescos de la DB/JSON en cada paso para evitar duplicar
                    const freshData = await obtenerTodo();
                    const a = freshData.alumnos.find((x: Alumno) => x.id === alumnoId);
                    
                    if (!a) {
                        console.log(`  ⏭️ [MANUAL BACKGROUND] Alumno ${alumnoId} no encontrado. Omitiendo.`);
                        statusEnvioManual.resultados[alumnoId] = 'error';
                        statusEnvioManual.fallidos++;
                        continue;
                    }
                    
                    // Validar estado de actividad
                    if (a.estado !== 'activo') {
                        console.log(`  ⏭️ [MANUAL BACKGROUND] Alumno ${a.nombre} no activo (${a.estado}). Omitiendo.`);
                        statusEnvioManual.resultados[alumnoId] = 'sent';
                        continue;
                    }
                    
                    // Validar si ya pagó
                    const pago = freshData.pagos.find((p: Pago) => p.alumnoId === alumnoId && p.mes === mes && p.anio === anio);
                    if (pago && pago.estado === 'pagado') {
                        console.log(`  ⏭️ [MANUAL BACKGROUND] Alumno ${a.nombre} ya pagó cuota de ${MONTHS[mes - 1]}. Omitiendo.`);
                        statusEnvioManual.resultados[alumnoId] = 'sent';
                        continue;
                    }
                    
                    // Validar si ya recibió recordatorio
                    const recordatorioKey = `${alumnoId}_${mes}_${anio}`;
                    const envios = freshData.recordatoriosEnviados[recordatorioKey];
                    if (envios && (envios.manual || envios.primer_recordatorio || envios.segundo_recordatorio)) {
                        console.log(`  ⏭️ [MANUAL BACKGROUND] Alumno ${a.nombre} ya recibió recordatorio. Omitiendo.`);
                        statusEnvioManual.resultados[alumnoId] = 'sent';
                        continue;
                    }
                    
                    // Construir mensaje personalizado
                    const msg = buildMessage(template, {
                        nombre: a.nombre,
                        monto: formatCurrency(a.cuota),
                        mes: MONTHS[mes - 1],
                        plan: a.plan === 'libre' ? 'Libre' : '3 Veces por Semana',
                        datos_pago: config.datosPago || '',
                    });
                    
                    mensajesIntentados++;
                    console.log(`  📤 [MANUAL BACKGROUND] Enviando mensaje a ${a.nombre} (+${a.whatsapp})...`);
                    const resSend = await sendWhatsApp(config.evolutionApiUrl, config.evolutionApiKey, config.evolutionInstance, a.whatsapp, msg);
                    
                    if (resSend.success) {
                        statusEnvioManual.enviados++;
                        statusEnvioManual.resultados[alumnoId] = 'sent';
                        // Registrar en la BD
                        await registrarRecordatorioEnviado(a.id, mes, anio, 'manual');
                        console.log(`  ✅ [MANUAL BACKGROUND] Mensaje enviado a ${a.nombre}`);
                    } else {
                        statusEnvioManual.fallidos++;
                        statusEnvioManual.resultados[alumnoId] = 'error';
                        console.error(`  ❌ [MANUAL BACKGROUND] Error enviando a ${a.nombre}:`, resSend.error);
                    }
                    
                    // Retardo anti-spam únicamente si no es el último elemento y el envío no fue cancelado
                    if (i < alumnoIds.length - 1 && !statusEnvioManual.cancelRequest) {
                        await randomDelay(mensajesIntentados);
                    }
                }
                
                // Finalización del lote
                if (statusEnvioManual.enviados > 0) {
                    await incrementarMensajesEnviados(statusEnvioManual.enviados);
                }
                
                const now = new Date();
                const canceladoTexto = statusEnvioManual.cancelRequest ? ' (Cancelado)' : '';
                await agregarActividad({
                    type: 'sent',
                    message: `Recordatorios ${MONTHS[mes - 1]}${canceladoTexto}: ${statusEnvioManual.enviados} enviados, ${statusEnvioManual.fallidos} fallidos`,
                    timestamp: now.toISOString(),
                });
                
                console.log(`✅ [MANUAL BACKGROUND] Envío finalizado. Enviados: ${statusEnvioManual.enviados}, Fallidos: ${statusEnvioManual.fallidos}${canceladoTexto}\n`);
                
            } catch (err) {
                console.error('❌ [MANUAL BACKGROUND] Error crítico durante el envío:', err);
            } finally {
                statusEnvioManual.enProgreso = false;
                statusEnvioManual.alumnoActualId = '';
            }
        })();
        
    } catch (error) {
        console.error('Error iniciando envío manual:', error);
        res.status(500).json({ error: 'Error al iniciar el envío manual' });
    }
});

// POST cancelar el envío manual activo
app.post('/api/recordatorios/cancel-manual', authMiddleware, (req, res) => {
    if (!statusEnvioManual.enProgreso) {
        return res.status(400).json({ error: 'No hay ningún envío manual en progreso' });
    }
    console.log('🛑 [MANUAL] Cancelación del envío solicitada por el usuario');
    statusEnvioManual.cancelRequest = true;
    res.json({ ok: true, mensaje: 'Solicitud de cancelación recibida' });
});

// GET envios realizados (for frontend info)
app.get('/api/envios', authMiddleware, async (_req, res) => {
    const map = await obtenerRecordatoriosEnviados();
    res.json(map);
});

// POST force cron (manual trigger)
app.post('/api/cron/trigger', authMiddleware, async (_req, res) => {
    console.log('🔧 [MANUAL] Trigger de cron recibido');
    await envioAutomatico();
    res.json({ ok: true });
});

// ─── Evolution API Proxy (evita CORS) ────────────────────────
// POST test connection
app.post('/api/whatsapp/test', authMiddleware, async (req, res) => {
    const { apiUrl, apiKey, instance } = req.body;

    // Limpiar URL (quitar /manager si existe)
    const cleanUrl = apiUrl.replace(/\/manager\/?$/, '').replace(/\/$/, '');
    const testUrl = `${cleanUrl}/instance/connectionState/${instance}`;

    console.log(`🔍 [WhatsApp Test] URL: ${testUrl}`);

    // Resolver API key si es enmascarada
    let realApiKey = apiKey;
    if (apiKey === '••••••••') {
        const config = await obtenerConfig();
        realApiKey = config.evolutionApiKey;
    }

    try {
        const response = await fetch(testUrl, {
            headers: { apikey: realApiKey },
        });

        const text = await response.text();
        console.log(`🔍 [WhatsApp Test] Response: ${response.status} - ${text.substring(0, 200)}`);

        if (response.ok) {
            try {
                const data = JSON.parse(text);
                res.json({ connected: true, state: data.instance?.state || data.state || 'ok' });
            } catch {
                res.json({ connected: false, error: 'Respuesta no es JSON válido' });
            }
        } else {
            res.json({ connected: false, error: `HTTP ${response.status}: ${text.substring(0, 100)}` });
        }
    } catch (e: any) {
        console.error(`❌ [WhatsApp Test] Error:`, e.message);
        res.json({ connected: false, error: e.message });
    }
});

// POST send whatsapp message
app.post('/api/whatsapp/send', authMiddleware, async (req, res) => {
    const { apiUrl, apiKey, instance, number, text } = req.body;

    // Limpiar URL (quitar /manager si existe)
    const cleanUrl = apiUrl.replace(/\/manager\/?$/, '').replace(/\/$/, '');
    const sendUrl = `${cleanUrl}/message/sendText/${instance}`;

    console.log(`📤 [WhatsApp Send] URL: ${sendUrl}`);
    console.log(`📤 [WhatsApp Send] To: ${number}`);

    // Resolver API key si es enmascarada
    let realApiKey = apiKey;
    if (apiKey === '••••••••') {
        const config = await obtenerConfig();
        realApiKey = config.evolutionApiKey;
    }

    try {
        const response = await fetch(sendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: realApiKey },
            body: JSON.stringify({ number, text }),
        });

        const responseText = await response.text();
        console.log(`📤 [WhatsApp Send] Response: ${response.status} - ${responseText.substring(0, 200)}`);

        if (response.ok) {
            res.json({ success: true });
        } else {
            res.json({ success: false, error: `HTTP ${response.status}: ${responseText.substring(0, 100)}` });
        }
    } catch (e: any) {
        console.error(`❌ [WhatsApp Send] Error:`, e.message);
        res.json({ success: false, error: e.message });
    }
});

// DELETE clear data (solo limpia JSON local, no Supabase)
app.delete('/api/data', authMiddleware, (_req, res) => {
    writeDataLocal({
        alumnos: [], pagos: [], activity: [], mensajesEnviados: 0,
        enviosRealizados: [],
        config: {
            evolutionApiUrl: '', evolutionApiKey: '', evolutionInstance: '',
            diaEnvio: 5, mensajePlantilla: '', datosPago: '',
        },
    });
    res.json({ ok: true });
});

// ─── Servir frontend en producción ──────────────────────────
if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, '..', 'dist');
    app.use(express.static(distPath));
    // Express 5 requiere sintaxis diferente para catch-all
    app.get('/{*path}', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

// ─── Start ──────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`\n🥋 Mutantes Fight Team — Backend`);
    console.log(`   Servidor: http://localhost:${PORT}`);
    console.log(`   API:      http://localhost:${PORT}/api/data`);
    console.log(`   Cron:     Todos los días a las 09:00`);
    console.log(`   Entorno:  ${process.env.NODE_ENV || 'development'}\n`);

    // Schedule: every day at 9:00 AM
    cron.schedule('0 9 * * *', () => {
        console.log('\n⏰ [CRON] Ejecutando revisión diaria...');
        envioAutomatico();
    });

    // Run once on startup (in case server restarts after 9am)
    const now = new Date();
    if (now.getHours() >= 9) {
        console.log('🔄 [STARTUP] Verificando envíos pendientes...');
        envioAutomatico();
    }
});
