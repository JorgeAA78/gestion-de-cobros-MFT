-- ═══════════════════════════════════════════════════════════════════════════
-- SCHEMA PARA COBROS-SYSTEM-V2 - SUPABASE
-- Ejecutar este script en el SQL Editor de Supabase
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Tabla de Administradores ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nombre TEXT NOT NULL,
    verificado BOOLEAN DEFAULT FALSE,
    token_verificacion TEXT,
    token_expiracion TIMESTAMPTZ,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Tabla de Invitaciones ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invitaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT UNIQUE NOT NULL,
    creado_por TEXT NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    expira_en TIMESTAMPTZ NOT NULL,
    usado BOOLEAN DEFAULT FALSE,
    usado_por TEXT,
    usado_en TIMESTAMPTZ
);

-- ─── Función para generar ID de 6 dígitos ─────────────────────────────────
CREATE OR REPLACE FUNCTION generate_short_id() RETURNS TEXT AS $$
DECLARE
    new_id TEXT;
    done BOOL;
BEGIN
    done := FALSE;
    WHILE NOT done LOOP
        new_id := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
        done := NOT EXISTS (SELECT 1 FROM alumnos WHERE id = new_id)
                AND NOT EXISTS (SELECT 1 FROM pagos WHERE id = new_id);
    END LOOP;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- ─── Tabla de Alumnos ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alumnos (
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

-- ─── Tabla de Pagos ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pagos (
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

-- ─── Tabla de Recordatorios Enviados ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recordatorios_enviados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alumno_id TEXT REFERENCES alumnos(id) ON DELETE CASCADE,
    mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
    anio INTEGER NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('manual', 'primer_recordatorio', 'segundo_recordatorio')),
    fecha_envio TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(alumno_id, mes, anio, tipo)
);

-- ─── Tabla de Actividad ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS actividad (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT NOT NULL CHECK (tipo IN ('sent', 'payment', 'register', 'config')),
    mensaje TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Tabla de Configuración ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS configuracion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clave TEXT UNIQUE NOT NULL,
    valor TEXT NOT NULL
);

-- ─── Índices para mejor rendimiento ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pagos_alumno ON pagos(alumno_id);
CREATE INDEX IF NOT EXISTS idx_pagos_periodo ON pagos(mes, anio);
CREATE INDEX IF NOT EXISTS idx_recordatorios_alumno ON recordatorios_enviados(alumno_id, mes, anio);
CREATE INDEX IF NOT EXISTS idx_invitaciones_codigo ON invitaciones(codigo);
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);

-- ─── Row Level Security (RLS) ───────────────────────────────────────────────
-- Habilitar RLS en todas las tablas
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE alumnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE actividad ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordatorios_enviados ENABLE ROW LEVEL SECURITY;

-- Políticas para service_role (backend) - acceso total
CREATE POLICY "Service role full access admins" ON admins FOR ALL USING (true);
CREATE POLICY "Service role full access invitaciones" ON invitaciones FOR ALL USING (true);
CREATE POLICY "Service role full access alumnos" ON alumnos FOR ALL USING (true);
CREATE POLICY "Service role full access pagos" ON pagos FOR ALL USING (true);
CREATE POLICY "Service role full access actividad" ON actividad FOR ALL USING (true);
CREATE POLICY "Service role full access configuracion" ON configuracion FOR ALL USING (true);
CREATE POLICY "Service role full access recordatorios" ON recordatorios_enviados FOR ALL USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- FIN DEL SCHEMA
-- ═══════════════════════════════════════════════════════════════════════════
