# 🥋 Mutantes Fight Team — Sistema de Cobros

Sistema de gestión de cuotas y recordatorios automáticos por WhatsApp para academia de Brazilian Jiu Jitsu.

🌐 **Demo:** [gestion-de-cobros-mft-production.up.railway.app](https://gestion-de-cobros-mft-production.up.railway.app/)

## ✨ Características

- 📊 **Dashboard** con estadísticas de alumnos y pagos
- 👥 **Gestión de alumnos** con importación desde Excel
- 💰 **Control de pagos** mensuales por alumno
- 📱 **Recordatorios automáticos** por WhatsApp (Evolution API)
- 🔐 **Sistema de autenticación robusto** con verificación por email (OTP de un uso)
- 🛡️ **Seguridad auditada & Hardening** (Rate limiting, proxies de WhatsApp, entropía criptográfica fuerte)
- ☁️ **Base de datos en la nube** con Supabase
- 🗑️ **Eliminación masiva** de alumnos
- 📱 **Diseño responsivo** (móvil, tablet, desktop)
- 🎓 **Estados de alumno** (activo, becado, suspendido, inactivo)

## 🛠️ Tecnologías

| Categoría | Tecnología |
|-----------|------------|
| Frontend | React 19 + TypeScript + Vite |
| Estado | Zustand |
| Backend | Express 5 + node-cron |
| Base de datos | Supabase (PostgreSQL) |
| Autenticación | JWT + bcrypt |
| Email | EmailJS (API HTTP) |
| WhatsApp | Evolution API |
| Excel/CSV | SheetJS |
| Deploy | Railway |

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
# ¡ATENCIÓN! En producción (NODE_ENV=production), el servidor fallará al iniciar de inmediato si JWT_SECRET no está definido o conserva el valor por defecto de desarrollo.
JWT_SECRET=tu-clave-secreta-muy-segura

# EmailJS (https://www.emailjs.com/)
EMAILJS_SERVICE_ID=service_xxxxx
EMAILJS_TEMPLATE_ID=template_xxxxx
EMAILJS_PUBLIC_KEY=tu-public-key

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

### EmailJS

1. Crear cuenta en [emailjs.com](https://www.emailjs.com/)
2. Agregar Email Service (Gmail)
3. Crear Template con variables: `{{to_email}}`, `{{nombre}}`, `{{token}}`
4. En Security, habilitar "Allow EmailJS API for non-browser applications"
5. Copiar Service ID, Template ID y Public Key al `.env`

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
- ✅ Delay aleatorio de **120-240 segundos** entre mensajes
- ✅ Pausa extra de **5-8 minutos** cada 10 envíos
- ✅ Distribución de envíos en **5 días** (no todos el mismo día)
- ✅ Máximo ~20 mensajes por lote
- ✅ Solo envía a alumnos **activos** con pagos pendientes

### 🎓 Estados de alumno
| Estado | Recibe recordatorios |
|--------|---------------------|
| ✅ Activo | Sí |
| 🎓 Becado | No |
| ⏸️ Suspendido | No |
| ❌ Inactivo | No |

## 🛡️ Seguridad & Hardening (Producción)

El sistema ha sido auditado e incluye medidas de seguridad avanzadas para proteger la confidencialidad e integridad de la academia:

- 🛡️ **Protección contra Fuerza Bruta (Rate Limiting)**: Límite estricto de **5 peticiones por minuto** para los endpoints sensibles de autenticación (`/api/auth/login` y `/api/auth/verificar`).
- 🔑 **Enmascaramiento de Credenciales**: La API Key de WhatsApp (`evolutionApiKey`) nunca viaja expuesta hacia el cliente (se devuelve enmascarada como `••••••••`). El servidor utiliza proxies seguros en el backend para testear y enviar mensajes.
- 🎲 **Entropía Criptográfica Fuerte**: Generación de tokens OTP, IDs de alumnos y códigos de invitación utilizando el módulo nativo `crypto` de Node.js en lugar de generadores pseudo-aleatorios inseguros (`Math.random`).
- 🔐 **Protección Total de Endpoints**: Todos los endpoints de negocio y proxies de WhatsApp (`/api/*`) requieren autenticación JWT en las cabeceras (`Authorization: Bearer <token>`).
- ⚠️ **Validación de Arranque de Producción**: El servidor se apaga automáticamente si detecta configuraciones inseguras (como no definir la clave secreta o usar la contraseña de desarrollo en producción).

## 📊 Importar alumnos desde Excel

### Columnas requeridas (mínimo)
| Columna | Ejemplo |
|---------|---------|
| **Nombre** | Juan Pérez |
| **WhatsApp** | 1123456789 |

### Columnas opcionales
| Columna | Valores válidos | Default |
|---------|-----------------|---------|
| **Apellido** | Pérez | - |
| **Plan** | `libre`, `3x` | `libre` |
| **Cuota** | `25000` | `0` |
| **Nivel** | `blanco`, `azul`, `morado`, `marron`, `negro` | `blanco` |
| **Estado** | `activo`, `becado`, `suspendido`, `inactivo` | `activo` |
| **Email** | juan@email.com | - |
| **Notas** | Observaciones | - |

### Nombres de columna aceptados
- **Nombre:** `nombre`, `name`, `alumno`, `nombre completo`, `socio`, `cliente`
- **Apellido:** `apellido`, `apellidos`, `surname`, `last name`
- **WhatsApp:** `whatsapp`, `telefono`, `celular`, `phone`, `tel`, `contacto`
- **Plan:** `plan`, `tipo de plan`, `categoria`, `modalidad`
- **Cuota:** `cuota`, `monto`, `precio`, `valor`, `mensualidad`
- **Estado:** `estado`, `situacion`, `status`
- **Nivel:** `nivel`, `cinturon`, `belt`, `grado`

> 💡 El sistema detecta automáticamente las columnas por nombre, no importa el orden.

## 🔐 Autenticación

### Flujo de registro
1. Admin existente genera **código de invitación**
2. Nuevo admin se registra con el código
3. Sistema envía email con **token de 4 dígitos**
4. Admin verifica email e inicia sesión

### Endpoints de Autenticación

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/registro` | Registrar con código de invitación (limite 5 peticiones/min) |
| POST | `/api/auth/verificar` | Verificar email (OTP) (limite 5 peticiones/min) |
| POST | `/api/auth/login` | Iniciar sesión (limite 5 peticiones/min) |
| GET | `/api/auth/me` | Obtener perfil administrador |
| POST | `/api/auth/invitaciones` | Generar código de invitación (requiere JWT) |

### Endpoints de Negocio y Proxy (Protegidos por JWT)

Todos los endpoints que modifican o consultan alumnos, cuotas, configuraciones y llamadas directas de WhatsApp a través del backend requieren el encabezado HTTP:
`Authorization: Bearer <token_jwt>`

## 📝 Scripts

```bash
pnpm run dev          # Frontend + Backend en paralelo
pnpm run dev:frontend # Solo React (puerto 5173)
pnpm run dev:server   # Solo Express (puerto 3001)
pnpm run build        # Build de producción
pnpm run lint         # Verificar código
```

## 🚀 Deploy en Railway

1. Conectar repositorio de GitHub
2. Agregar variables de entorno en Railway
3. El deploy es automático con cada push a `main`

```bash
# Build commands (configurados en nixpacks.toml)
pnpm install --force
pnpm run build:all

# Start command
pnpm run start
```

## 📄 Licencia

MIT © Mutantes Fight Team
