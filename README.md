# 🥋 Mutantes Fight Team — Sistema de Cobros

Sistema de gestión de cuotas y recordatorios automáticos por WhatsApp para academia de Brazilian Jiu Jitsu.

## ✨ Características

- 📊 **Dashboard** con estadísticas de alumnos y pagos
- 👥 **Gestión de alumnos** con importación desde Excel
- 💰 **Control de pagos** mensuales por alumno
- 📱 **Recordatorios automáticos** por WhatsApp (Evolution API)
- 🔐 **Sistema de autenticación** con verificación por email
- ☁️ **Base de datos en la nube** con Supabase
- 🗑️ **Eliminación masiva** de alumnos

## 🛠️ Tecnologías

| Categoría | Tecnología |
|-----------|------------|
| Frontend | React 19 + TypeScript + Vite |
| Estado | Zustand (persistido en localStorage) |
| Backend | Express + node-cron |
| Base de datos | Supabase (PostgreSQL) |
| Autenticación | JWT + bcrypt |
| Email | Nodemailer (SMTP) |
| WhatsApp | Evolution API |
| Excel/CSV | SheetJS |

## 🚀 Instalación

```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/cobros-system-v2.git
cd cobros-system-v2

# Instalar dependencias (usar pnpm)
pnpm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Ejecutar en desarrollo
pnpm run dev
```

## 📁 Estructura del proyecto

```
src/
├── pages/           # Páginas de la aplicación
│   ├── Dashboard.tsx
│   ├── RegistrarAlumno.tsx
│   ├── CobrarCuota.tsx
│   ├── Recordatorios.tsx
│   ├── Configuracion.tsx
│   ├── Login.tsx
│   ├── Registro.tsx
│   └── VerificarEmail.tsx
├── components/      # Componentes reutilizables
├── store/           # Estado global (Zustand)
├── services/        # Servicios (API, WhatsApp, Excel)
└── types/           # Interfaces TypeScript

server/
├── index.ts         # API REST + cron automático
├── lib/
│   ├── supabase.ts      # Cliente Supabase
│   └── data.store.ts    # Store de datos
└── auth/            # Sistema de autenticación
    ├── admin.store.ts
    ├── invitacion.store.ts
    ├── auth.controller.ts
    ├── auth.routes.ts
    └── email.service.ts

supabase/
└── schema.sql       # Schema de base de datos
```

## ⚙️ Configuración

### Variables de entorno (.env)

```env
# Servidor
PORT=3001

# JWT
JWT_SECRET=tu-clave-secreta-muy-segura

# SMTP (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-contraseña-de-aplicacion
SMTP_FROM=tu-email@gmail.com

# Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# Evolution API (WhatsApp)
EVOLUTION_API_URL=https://tu-evolution-api.com
EVOLUTION_API_KEY=tu-api-key
EVOLUTION_INSTANCE=tu-instancia
```

### Supabase

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ejecutar `supabase/schema.sql` en el SQL Editor
3. Copiar URL y Service Role Key al `.env`

### Gmail SMTP

Crear una [Contraseña de aplicación](https://myaccount.google.com/apppasswords) para usar con Nodemailer.

## 📱 Recordatorios automáticos

El sistema envía recordatorios por WhatsApp de forma inteligente:

### Primer recordatorio (días 1-5)
```
¡Hola Juan! 👋

Te recordamos que la cuota de *Mayo* ya está disponible para abonar:

💰 Monto: *$15.000*
📋 Plan: *Libre*
📅 Fecha límite: 10 de Mayo
Alias: mutantesbjj
a nombre de: Pablo Sebastian Echazu Bloser

*Por favor, enviar comprobante al realizar el pago*

Te esperamos en el tatami!

_Mutantes Fight Team - BJJ_
```

### Segundo recordatorio (días 10-14)
Solo se envía a alumnos que **no pagaron** Y **ya vencieron** según su fecha individual.

```
¡Hola Juan! 👋

Te recordamos que la cuota de *Mayo* está pendiente:

💰 Monto: *$15.000*
📋 Plan: *Libre*

Alias: mutantesbjj
a nombre de: Pablo Sebastian Echazu Bloser

*Por favor, enviar comprobante al realizar el pago*

Te esperamos en el tatami!

_Mutantes Fight Team - BJJ_
```

### 🛡️ Protección anti-baneo
- ✅ Delay aleatorio de **20-40 segundos** entre mensajes
- ✅ Distribución de envíos en **5 días** (no todos el mismo día)
- ✅ Máximo ~30 mensajes por día
- ✅ Solo envía a alumnos con pagos pendientes

## 🔐 Autenticación

### Flujo de registro
1. Admin existente genera **código de invitación**
2. Nuevo admin se registra con el código
3. Sistema envía email con **token de 4 dígitos**
4. Admin verifica email e inicia sesión

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/registro` | Registrar con código de invitación |
| POST | `/api/auth/verificar` | Verificar email |
| POST | `/api/auth/login` | Iniciar sesión |
| GET | `/api/auth/me` | Obtener perfil |
| POST | `/api/auth/invitaciones` | Generar invitación |

## 📝 Scripts

```bash
pnpm run dev          # Frontend + Backend en paralelo
pnpm run dev:frontend # Solo React (puerto 5173)
pnpm run dev:server   # Solo Express (puerto 3001)
pnpm run build        # Build de producción
pnpm run lint         # Verificar código
```

## 📄 Licencia

MIT © Mutantes Fight Team
