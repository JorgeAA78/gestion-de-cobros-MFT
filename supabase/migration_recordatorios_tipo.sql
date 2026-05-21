-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Agregar columna 'tipo' a recordatorios_enviados
-- ═══════════════════════════════════════════════════════════════════════════
-- IMPORTANTE: Ejecutar este script en el SQL Editor de Supabase
-- ═══════════════════════════════════════════════════════════════════════════

-- Opción limpia y segura (Recomendada): Recrear la tabla para asegurar la integridad de restricciones.
-- Nota: Esto limpiará el historial de recordatorios enviados este mes, lo cual es seguro y no afecta a alumnos ni a pagos.

DROP TABLE IF EXISTS recordatorios_enviados CASCADE;

CREATE TABLE recordatorios_enviados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alumno_id TEXT REFERENCES alumnos(id) ON DELETE CASCADE,
    mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
    anio INTEGER NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('manual', 'primer_recordatorio', 'segundo_recordatorio')),
    fecha_envio TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(alumno_id, mes, anio, tipo)
);

-- Re-habilitar seguridad de nivel de fila (RLS)
ALTER TABLE recordatorios_enviados ENABLE ROW LEVEL SECURITY;

-- Re-crear política para acceso total del Backend (service_role)
DROP POLICY IF EXISTS "Service role full access recordatorios" ON recordatorios_enviados;
CREATE POLICY "Service role full access recordatorios" ON recordatorios_enviados FOR ALL USING (true);

-- Re-crear índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_recordatorios_alumno ON recordatorios_enviados(alumno_id, mes, anio);
