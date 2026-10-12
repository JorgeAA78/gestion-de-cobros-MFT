# 🥋 Mutantes Fight Team — Sistema de Cobros

Sistema integral de gestión de cuotas escolares/deportivas, historial de pagos y recordatorios automáticos por WhatsApp utilizando la API oficial de **YCloud** para academia de Brazilian Jiu-Jitsu.

🌐 **Producción Web:** [gestion-de-cobros-mft-production.up.railway.app](https://gestion-de-cobros-mft-production.up.railway.app/)  
📦 **Repositorio Oficial:** [JorgeAA78/gestion-de-cobros-MFT](https://github.com/JorgeAA78/gestion-de-cobros-MFT)

---

## ✨ Características Principales

- 📊 **Dashboard en Tiempo Real:** Estadísticas de recaudación, cuotas pendientes, alumnos activos y mensajes enviados.
- 👥 **Gestión Completa de Alumnos:**
  - Registro manual con planes (`libre`, `3x`), cuota personalizada y día de vencimiento.
  - Importación masiva e inteligente desde archivos Excel (`.xlsx`, `.xls`, `.csv`).
  - Edición rápida con pestañas y estados (`activo`, `becado`, `suspendido`, `inactivo`).
  - Eliminación individual y masiva (bulk delete).
- 💰 **Control e Historial de Pagos Avanzado:**
  - Marcado rápido en 1 toque (Pagó / Deshacer a Pendiente).
  - Modal de historial interactivo por alumno con navegación anual.
  - Registro de pagos con montos personalizados y fechas históricas retroactivas.
  - **Paginación Automática Supabase:** Arquitectura con `fetchAllRows` capaz de sincronizar miles de pagos y alumnos sin cortes por el límite por defecto de 1.000 filas de PostgREST.
- 📱 **Aplicación Móvil Android (Capacitor):**
  - APK nativa optimizada con ícono y splash screen oficiales de Mutantes Fight Team.
  - Modo **Live App**: Carga y sincronización continua desde producción sin necesidad de reinstalar la APK tras cada cambio web.
  - Interfaz móvil adaptativa (diseño en tarjetas 2x2, safe-area insets para barra de navegación por gestos).
- 💬 **Mensajería Oficial por WhatsApp (YCloud):**
  - Envío individual y masivo con plantillas aprobadas por Meta (`recordatorio`, `disponible`, `bienvenida`).
  - Control de envíos duplicados por mes y tipo de recordatorio.
  - Cronjob automático diario a las 09:00 AM para notificación de vencimientos.
- 🔐 **Autenticación y Seguridad:**
  - Inicio de sesión con JWT y contraseñas cifradas con `bcrypt`.
  - Verificación de administradores mediante código OTP por correo electrónico.
  - Rate limiting estricto (5 intentos/min) para mitigar ataques de fuerza bruta.
  - **Supabase Hardening**: Acceso restringido exclusivamente a `service_role`, impidiendo accesos no autorizados a través de la clave pública `anon`.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Monorepo** | Workspace administrado con `pnpm` |
| **Frontend** | React 19, TypeScript, Vite, CSS Vanilla moderno |
| **Estado Global** | Zustand (con persistencia local y sincronización optimista) |
| **Backend** | Node.js 22, Express 5, node-cron |
| **Móvil** | Capacitor 8 (Android SDK 36, AndroidX) |
| **Base de Datos** | Supabase (PostgreSQL) con RLS estricto y consultas paginadas |
| **WhatsApp API** | YCloud API Oficial (Meta Business Cloud API) |
| **Correos / OTP** | SMTP (Nodemailer / Gmail) & Resend |
| **Despliegue** | Railway (Nixpacks) con CI/CD automatizado |

---

## 📁 Estructura del Proyecto

```
cobros-system-v2/
├── backend/                  # Servidor Express y Lógica de Negocio
│   ├── index.ts              # Endpoints API REST + Cron diario
│   ├── auth/                 # Controladores y middlewares de autenticación
│   │   ├── admin.store.ts    # Repositorio de administradores
│   │   └── auth.middleware.ts# Validación JWT y Rate Limiter
│   ├── lib/
│   │   ├── supabase.ts       # Cliente Supabase seguro (service_role)
│   │   └── data.store.ts     # CRUD y paginación para Alumnos, Pagos y Recordatorios
│   └── scripts/              # Utilidades de mantenimiento y regularización
│
├── frontend/                 # Aplicación Cliente React + SPA
│   ├── android/              # Proyecto nativo Android (Capacitor)
│   ├── capacitor.config.ts   # Configuración de Live App y esquemas nativos
│   ├── src/
│   │   ├── components/       # Modales (HistorialPagos, AlumnoEdit, ImportarExcel, etc.)
│   │   ├── pages/            # Vistas (Dashboard, Recordatorios, Login, Registro, etc.)
│   │   ├── store/            # Estado global reactivo con Zustand (`useStore.ts`)
│   │   ├── config/           # Configuración de URLs para Dev y Producción
│   │   └── types/            # Definiciones de TypeScript
│   └── index.html
│
├── supabase/                 # Esquemas SQL y Políticas
│   └── schema.sql            # Tablas, índices, llaves foráneas y reglas RLS
│
├── nixpacks.toml             # Configuración del motor de construcción en Railway
├── package.json              # Scripts del monorepo
└── pnpm-workspace.yaml       # Configuración del espacio de trabajo
```

---

## 🚀 Instalación y Puesta en Marcha

### Prerrequisitos
- Node.js 22+
- `pnpm` (`npm install -g pnpm`)

### 1. Clonar el repositorio
```bash
git clone https://github.com/JorgeAA78/gestion-de-cobros-MFT.git
cd gestion-de-cobros-MFT
```

### 2. Instalar dependencias
```bash
pnpm install
```

### 3. Configurar variables de entorno
Crea un archivo `.env` en la raíz copiando el ejemplo:
```bash
cp .env.example .env
```

Configura tus credenciales:
```env
PORT=3001
NODE_ENV=development
JWT_SECRET=tu_clave_secreta_jwt

# Base de Datos (Supabase)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# WhatsApp Oficial (YCloud)
YCLOUD_API_KEY=tu_api_key_ycloud
YCLOUD_WHATSAPP_NUMBER=+549XXXXXXXXXX

# Envío de Emails (OTP / Verificación)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-contraseña-de-aplicacion
SMTP_FROM=tu-email@gmail.com

# URL Pública de API
VITE_API_URL=https://gestion-de-cobros-mft-production.up.railway.app/api
```

### 4. Iniciar en modo desarrollo
Inicia concurrentemente el servidor backend (puerto 3001) y el frontend de Vite (puerto 5173):
```bash
pnpm run dev
```

---

## 📱 Compilación para Móvil (Android)

El proyecto utiliza Capacitor para generar la aplicación de Android:

```bash
# 1. Compilar la aplicación web
pnpm run build

# 2. Sincronizar activos y plugins con el proyecto Android
pnpm run cap:sync

# 3. Abrir el proyecto en Android Studio
pnpm run cap:open
```

Desde Android Studio, puedes generar el APK de lanzamiento (`Build > Build Bundle(s) / APK(s) > Build APK(s)`).

---

## 📜 Scripts Disponibles

```bash
pnpm run dev          # Inicia Frontend y Backend simultáneamente en desarrollo
pnpm run build:all    # Compila cliente web (Vite) y servidor (TypeScript)
pnpm run build        # Compila solo el Frontend
pnpm run build:server # Compila solo el Backend
pnpm run start        # Inicia el servidor de producción
pnpm run cap:sync     # Sincroniza el Frontend con la app nativa de Capacitor
pnpm run cap:open     # Abre el proyecto nativo en Android Studio
```

---

## 🚢 Despliegue en Railway

El proyecto está preparado para desplegarse automáticamente en [Railway](https://railway.app):
1. Conecta el repositorio de GitHub a tu proyecto en Railway.
2. Agrega las variables de entorno en la pestaña **Variables** del servicio.
3. El archivo `nixpacks.toml` detecta automáticamente Node.js 22, instala las dependencias con `pnpm`, compila todo el proyecto (`pnpm run build:all`) y ejecuta el servidor (`pnpm run start`).

---

## 📄 Licencia

MIT © Mutantes Fight Team - Brazilian Jiu-Jitsu. Todos los derechos reservados.
