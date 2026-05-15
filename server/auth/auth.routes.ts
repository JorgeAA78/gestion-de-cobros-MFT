// ─── Rutas de autenticación ──────────────────────────────────────────────────
import { Router } from 'express';
import { 
    registrarAdmin, 
    verificarEmail, 
    reenviarToken, 
    loginAdmin, 
    obtenerPerfil,
    generarInvitacion,
    listarInvitaciones,
    eliminarInvitacionHandler,
    validarCodigoInvitacion
} from './auth.controller.js';
import { authMiddleware } from './auth.middleware.js';

const router = Router();

// ─── Rutas públicas (no requieren autenticación) ─────────────────────────────

// POST /api/auth/registro - Registrar nuevo administrador (requiere código de invitación)
router.post('/registro', registrarAdmin);

// POST /api/auth/verificar - Verificar email con token de 4 dígitos
router.post('/verificar', verificarEmail);

// POST /api/auth/reenviar-token - Reenviar código de verificación
router.post('/reenviar-token', reenviarToken);

// POST /api/auth/login - Iniciar sesión
router.post('/login', loginAdmin);

// GET /api/auth/invitaciones/validar/:codigo - Validar código de invitación (público)
router.get('/invitaciones/validar/:codigo', validarCodigoInvitacion);

// ─── Rutas protegidas (requieren autenticación) ──────────────────────────────

// GET /api/auth/me - Obtener perfil del admin autenticado
router.get('/me', authMiddleware, obtenerPerfil);

// POST /api/auth/invitaciones - Generar nueva invitación
router.post('/invitaciones', authMiddleware, generarInvitacion);

// GET /api/auth/invitaciones - Listar todas las invitaciones
router.get('/invitaciones', authMiddleware, listarInvitaciones);

// DELETE /api/auth/invitaciones/:id - Eliminar una invitación
router.delete('/invitaciones/:id', authMiddleware, eliminarInvitacionHandler);

export default router;
