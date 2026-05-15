-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Cambiar IDs de UUID a 6 dígitos numéricos
-- ═══════════════════════════════════════════════════════════════════════════
-- IMPORTANTE: Ejecutar este script en el SQL Editor de Supabase
-- ADVERTENCIA: Esto eliminará las tablas alumnos y pagos existentes
-- ═══════════════════════════════════════════════════════════════════════════

-- Paso 1: Eliminar tablas existentes (si existen)
DROP TABLE IF EXISTS pagos CASCADE;
DROP TABLE IF EXISTS alumnos CASCADE;

-- Paso 2: Crear función para generar ID de 6 dígitos
CREATE OR REPLACE FUNCTION generate_short_id() RETURNS TEXT AS $$
DECLARE
    new_id TEXT;
    done BOOL;
BEGIN
    done := FALSE;
    WHILE NOT done LOOP
        new_id := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
        -- Verificar que no exista en ninguna tabla
        BEGIN
            done := NOT EXISTS (SELECT 1 FROM alumnos WHERE id = new_id);
            IF done THEN
                done := NOT EXISTS (SELECT 1 FROM pagos WHERE id = new_id);
            END IF;
        EXCEPTION WHEN undefined_table THEN
            done := TRUE;
        END;
    END LOOP;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Paso 3: Crear tabla de Alumnos con ID de 6 dígitos
CREATE TABLE alumnos (
    id TEXT PRIMARY KEY DEFAULT generate_short_id(),
    nombre TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    plan TEXT NOT NULL CHECK (plan IN ('libre', '3x')),
    cuota INTEGER NOT NULL,
    dia_vencimiento INTEGER DEFAULT 10,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Paso 4: Crear tabla de Pagos con ID de 6 dígitos
CREATE TABLE pagos (
    id TEXT PRIMARY KEY DEFAULT generate_short_id(),
    alumno_id TEXT REFERENCES alumnos(id) ON DELETE CASCADE,
    mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
    anio INTEGER NOT NULL,
    monto INTEGER NOT NULL,
    estado TEXT NOT NULL CHECK (estado IN ('pendiente', 'pagado', 'vencido')),
    fecha_pago TIMESTAMPTZ,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(alumno_id, mes, anio)
);

-- Paso 5: Crear índices
CREATE INDEX idx_pagos_alumno ON pagos(alumno_id);
CREATE INDEX idx_pagos_periodo ON pagos(mes, anio);
CREATE INDEX idx_alumnos_activo ON alumnos(activo);

-- Paso 6: Habilitar RLS
ALTER TABLE alumnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

-- Paso 7: Crear políticas de acceso
DROP POLICY IF EXISTS "Service role full access alumnos" ON alumnos;
DROP POLICY IF EXISTS "Service role full access pagos" ON pagos;
CREATE POLICY "Service role full access alumnos" ON alumnos FOR ALL USING (true);
CREATE POLICY "Service role full access pagos" ON pagos FOR ALL USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- FIN DE LA MIGRACIÓN
-- Los nuevos alumnos tendrán IDs como: 123456, 789012, etc.
-- ═══════════════════════════════════════════════════════════════════════════
