-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Soporte Alumnos Kids (5 a 12 años) y Limpieza de Estados
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Normalizar alumnos históricos con estado 'suspendido' a 'inactivo'
UPDATE alumnos 
SET estado = 'inactivo' 
WHERE estado = 'suspendido';

-- 2. Agregar columna categoria a la tabla alumnos ('adulto' por defecto)
ALTER TABLE alumnos 
ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT 'adulto' 
CHECK (categoria IN ('adulto', 'kids'));

-- 3. Agregar columnas opcionales de edad y tutor responsable
ALTER TABLE alumnos 
ADD COLUMN IF NOT EXISTS edad INTEGER,
ADD COLUMN IF NOT EXISTS tutor TEXT;

-- 4. Índice para optimizar consultas filtradas por categoría
CREATE INDEX IF NOT EXISTS idx_alumnos_categoria ON alumnos(categoria);

-- 5. Insertar valor por defecto para datos_pago_kids en configuracion (si no existe)
INSERT INTO configuracion (clave, valor)
VALUES ('datosPagoKids', '')
ON CONFLICT (clave) DO NOTHING;
