// ─── Módulo de autenticación - Exportaciones ────────────────────────────────
export { default as authRoutes } from './auth.routes.js';
export { authMiddleware, generarJWT, verificarJWT } from './auth.middleware.js';
export type { AuthRequest } from './auth.middleware.js';
export * from './types.js';
export * from './admin.store.js';
export { verificarConexionSMTP } from './email.service.js';
