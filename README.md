# 🥋 Mutantes Fight Team — Sistema de Cobros

Sistema monorepo de gestión de cuotas y recordatorios automáticos por WhatsApp utilizando la API oficial de **YCloud** para academia de Brazilian Jiu Bitsu.

🌐 **Demo:** [gestion-de-cobros-mft-production.up.railway.app](https://gestion-de-cobros-mft-production.up.railway.app/)

## ✨ Características

- 📊 **Dashboard** con estadísticas de alumnos y pagos en tiempo real.
- 👥 **Gestión de alumnos** con importación flexible desde hojas de cálculo de Excel.
- 💰 **Control de pagos** mensuales por alumno de forma simplificada.
- 📱 **Mensajería Oficial YCloud**: Envío estructurado de WhatsApp mediante plantillas pre-aprobadas por Meta (`bienvenida`, `disponible`, `recordatorio`).
- 🔐 **Sistema de autenticación robusto** con token OTP de verificación por email.
- 🛡️ **Seguridad Auditada & Hardening**:
  - Rate limiting estricto en autenticación.
  - Proxies seguros en el servidor que impiden la exposición de API Keys en el cliente.
  - **Base de Datos Ultra Segura**: Supabase RLS fortificado únicamente para accesos restringidos `TO service_role`, denegando por completo accesos no autorizados a través de la API REST externa con llaves públicas `anon`.
- 🗑️ **Acciones masivas** como eliminación en lote de alumnos y generación/envío de cobros.
- 📱 **Diseño responsivo y dinámico** adaptado a dispositivos móviles, tablets y desktops.
- 🎓 **Estados de alumno** (activo, becado, suspendido, inactivo).

## 🛠️ Tecnologías

| Categoría | Tecnología |
|-----------|------------|
| Arquitectura | Monorepo Workspace con `pnpm` |
| Frontend | React 19 + TypeScript + Vite |
| Estado | Zustand |
| Backend | Express 5 + node-cron (con carga priorizada desde `.env`) |
| Base de datos | Supabase (PostgreSQL) con RLS estricto `TO service_role` |
| Autenticación | JWT + bcrypt |
| Email | EmailJS (API HTTP) |
| WhatsApp | API Oficial YCloud (WhatsApp Business API) |
| Excel/CSV | SheetJS |
| Deploy | Railway |

## 🚀 Instalación y Desarrollo

```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/cobros-system-v2.git
cd cobros-system-v2

# Instalar dependencias usando pnpm
pnpm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env e ingresar tus credenciales y API Keys

# Ejecutar el monorepo en desarrollo (Frontend y Backend concurrentes)
pnpm run dev
```

## 📁 Estructura del Monorepo

```
cobros-system-v2/
├── backend/            # Aplicación Servidora (Express + data store)
│   ├── index.ts        # API REST + cron de envío automático
│   ├── auth/           # Sistema de autenticación de administradores
│   ├── lib/
│   │   ├── supabase.ts # Inicialización del cliente Supabase
│   │   └── data.store.ts # Repositorio de datos unificado
│   ├── tsconfig.json
│   └── package.json
│
├── frontend/           # Aplicación Cliente (React Single Page App)
│   ├── src/
│   │   ├── pages/      # Vistas y formularios del dashboard
│   │   ├── components/ # Componentes compartidos de UI
│   │   ├── services/   # Clientes de API, Sanitización y YCloud
│   │   ├── store/      # Estado global (Zustand)
│   │   └── types/      # Interfaces de TypeScript
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── supabase/           # Scripts y políticas de base de datos
│   └── schema.sql      # Definición de tablas y políticas RLS
│
├── package.json        # Gestión de scripts globales del monorepo
├── pnpm-workspace.yaml # Definición de paquetes del workspace
└── nixpacks.toml       # Orquestación de deploy en Railway
```

## ⚙️ Configuración

### Variables de entorno (.env)

```env
# Servidor
PORT=3001
NODE_ENV=development

# JWT
# ¡ATENCIÓN! En producción, el servidor fallará de inmediato al iniciar si JWT_SECRET no está configurado o conserva su valor por defecto.
JWT_SECRET=tu-clave-secreta-muy-segura

# EmailJS (https://www.emailjs.com/)
EMAILJS_SERVICE_ID=service_xxxxx
EMAILJS_TEMPLATE_ID=template_xxxxx
EMAILJS_PUBLIC_KEY=tu-public-key

# Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# YCloud API (WhatsApp Oficial)
YCLOUD_API_KEY=tu-ycloud-api-key
YCLOUD_WHATSAPP_NUMBER=tu-numero-remitente-ycloud

# Resend (Opcional para emails del backend)
RESEND_API_KEY=re_xxxxx
```

### Supabase RLS Hardening

1. Crear el proyecto en [supabase.com](https://supabase.com).
2. Ejecutar `supabase/schema.sql` en el SQL Editor.
3. El esquema viene pre-configurado para habilitar Row Level Security (RLS) en todas las tablas y restringe el acceso únicamente `TO service_role`. De esta forma, si tus llaves públicas de Supabase llegaran a exponerse, los atacantes tendrán acceso denegado total, protegiendo tus datos.

## 📱 Plantillas de Mensajes YCloud

Para cumplir con las normativas de Meta de WhatsApp Business API, se utilizan plantillas pre-aprobadas que se envían utilizando los componentes de parámetros de YCloud:

### 1. Plantilla de Recordatorio (`recordatorio`)
*Componentes del mensaje:*
```
¡Hola {{1}}! 👋 

Te recordamos que la cuota de {{2}} está pendiente:

💰 Monto: {{3}}
📋 Plan: {{4}}

Alias: mutantesbjj
a nombre de: Pablo Sebastian Echazu Bloser

Por favor, enviar comprobante al realizar el pago

¡Te esperamos en el tatami! 💪 

Mutantes Fight Team - BJJ
```

### 2. Plantilla de Cuota Disponible (`disponible`)
*Componentes del mensaje:*
```
¡Hola {{1}}! 👋 

Te recordamos que la cuota de {{2}} ya está disponible para abonar:

💰 Monto: {{3}}
📋 Plan: {{4}}
📅 Fecha límite: {{5}}

Alias: mutantesbjj
a nombre de: Pablo Sebastian Echazu Bloser

Por favor, enviar comprobante al realizar el pago

¡Te esperamos en el tatami! 💪 

Mutantes Fight Team - BJJ
```

### 3. Plantilla de Bienvenida (`bienvenida`)
*Componentes del mensaje:*
```
¡Hola {{1}}! 👋

Te damos la bienvenida oficial a Mutantes Fight Team - BJJ 🥋

Tu registro ha sido completado con éxito:
📋 Plan: {{2}}
💰 Cuota Mensual: {{3}}
📅 Día de vencimiento: {{4}} de cada mes

¡Nos vemos en el tatami! 💪
```

## 🛡️ Seguridad & Hardening (Producción)

- 🛡️ **Protección contra Fuerza Bruta**: Rate limiting estricto de un máximo de **5 peticiones por minuto** para los endpoints sensibles de autenticación (`/api/auth/login` y `/api/auth/verificar`).
- 🧹 **Sanitización de Datos**: El cliente web del frontend y las APIs del backend aplican sanitización y validaciones automáticas contra ataques de inyección HTML e inyecciones XSS.
- 🔑 **No Exposición de Credenciales**: Las claves API de YCloud nunca son expuestas al frontend. Toda comunicación se orquesta de manera segura mediante endpoints y proxies del servidor Express protegidos por tokens JWT.
- 🎲 **Seguridad Criptográfica**: Las contraseñas se hashean con `bcrypt`, y la generación de códigos OTP utiliza el módulo criptográfico nativo `crypto` de Node.js.

## 📝 Scripts del Monorepo

```bash
pnpm run dev          # Inicia el Frontend y Backend concurrentemente en desarrollo
pnpm run build:all    # Compila tanto la aplicación cliente (Vite) como el servidor (TSC)
pnpm run build        # Compila solo el cliente (Vite)
pnpm run build:server # Compila solo el backend (TypeScript)
pnpm run start        # Arranca el servidor Express en producción
```

## 🚀 Deploy en Railway

La orquestación de la compilación e inicio en producción está configurada en `nixpacks.toml` y `railway.json`.

1. Conectar tu repositorio de GitHub a tu proyecto en Railway.
2. Configurar las variables de entorno en el panel de Railway (¡Importante! Asegúrate de actualizar los nombres de las variables reemplazando las de Evolution API por las de YCloud).
3. El despliegue se realizará de forma automática con cada `git push` a la rama configurada.

---

## 📄 Licencia

MIT © Mutantes Fight Team
