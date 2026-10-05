import dotenv from 'dotenv';
dotenv.config();

import { supabase } from '../lib/supabase.js';

async function regularizar() {
    if (!supabase) {
        console.error('No hay cliente supabase');
        return;
    }

    console.log('Consultando alumnos...');
    const { data: alumnos, error: errAlumnos } = await supabase
        .from('alumnos')
        .select('*');

    if (errAlumnos || !alumnos) {
        console.error('Error al obtener alumnos:', errAlumnos);
        return;
    }

    console.log(`Total alumnos encontrados: ${alumnos.length}`);
    const activos = alumnos.filter(a => a.activo !== false && (a.estado || 'activo') === 'activo');
    console.log(`Alumnos activos a procesar: ${activos.length}`);

    const meses = [1, 2, 3, 4]; // Enero, Febrero, Marzo, Abril
    const anio = 2026;
    const upsertData: any[] = [];

    for (const a of activos) {
        for (const m of meses) {
            const mm = m < 10 ? `0${m}` : `${m}`;
            upsertData.push({
                alumno_id: a.id,
                mes: m,
                anio: anio,
                monto: typeof a.cuota === 'number' && a.cuota > 0 ? a.cuota : 25000,
                estado: 'pagado',
                fecha_pago: `${anio}-${mm}-10T12:00:00.000Z`
            });
        }
    }

    console.log(`Total cuotas a registrar (Ene, Feb, Mar, Abr 2026): ${upsertData.length}`);

    // Insertar en lotes de 100
    let totalInsertados = 0;
    const batchSize = 100;
    for (let i = 0; i < upsertData.length; i += batchSize) {
        const batch = upsertData.slice(i, i + batchSize);
        const { error } = await supabase
            .from('pagos')
            .upsert(batch, { onConflict: 'alumno_id,mes,anio' });
        
        if (error) {
            console.error(`Error en lote ${i}-${i + batch.length}:`, error);
        } else {
            totalInsertados += batch.length;
            console.log(`Progreso: ${totalInsertados}/${upsertData.length} cuotas procesadas...`);
        }
    }

    console.log(`\n✅ Proceso completado exitosamente: ${totalInsertados} cuotas marcadas como 'pagado' para ${activos.length} alumnos activos.`);
}

regularizar();
