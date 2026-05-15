// ─── Controlador de autenticación ────────────────────────────────────────────
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { 
    buscarAdminPorEmail, 
    buscarAdminPorId, 
    crearAdmin, 
    actualizarAdmin 
} from './admin.store.js';
import {
    crearInvitacion,
    validarInvitacion,
    marcarInvitacionUsada,
    obtenerInvitaciones,
    obtenerInvitacionesActivas,
    eliminarInvitacion
} from './invitacion.store.js';
import { 
    generarToken4Digitos, 
    enviarEmailVerificacion, 
    enviarEmailBienvenida 
} from './email.service.js';
import { generarJWT, AuthRequest } from './auth.middleware.js';
import { Admin, RegistroRequest, LoginRequest, VerificarEmailRequest } from './types.js';

// ─── Generar ID único ────────────────────────────────────────────────────────
function generarId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ─── POST /api/auth/registro ─────────────────────────────────────────────────
// Registra un nuevo administrador con código de invitación
export async function registrarAdmin(req: Request, res: Response): Promise<void> {
    try {
        const { email, password, nombre, codigoInvitacion } = req.body;

        // Validaciones básicas
        if (!email || !password || !nombre || !codigoInvitacion) {
            res.status(400).json({ 
                error: 'Datos incompletos',
                mensaje: 'Email, contraseña, nombre y código de invitación son requeridos' 
            });
            return;
        }

        // Validar código de invitación
        const resultadoInvitacion = await validarInvitacion(codigoInvitacion);
        if (!resultadoInvitacion.valida) {
            res.status(400).json({ 
                error: 'Invitación inválida',
                mensaje: resultadoInvitacion.mensaje 
            });
            return;
        }

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            res.status(400).json({ 
                error: 'Email inválido',
                mensaje: 'El formato del email no es válido' 
            });
            return;
        }

        // Validar contraseña (mínimo 6 caracteres)
        if (password.length < 6) {
            res.status(400).json({ 
                error: 'Contraseña débil',
                mensaje: 'La contraseña debe tener al menos 6 caracteres' 
            });
            return;
        }

        // Verificar si el email ya existe
        const adminExistente = await buscarAdminPorEmail(email);
        if (adminExistente) {
            // Si existe pero no está verificado, permitir reenviar token
            if (!adminExistente.emailVerificado) {
                const token = generarToken4Digitos();
                const expiracion = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

                await actualizarAdmin(adminExistente.id, {
                    tokenVerificacion: token,
                    tokenExpiracion: expiracion.toISOString()
                });

                await enviarEmailVerificacion(email, adminExistente.nombre, token);

                res.status(200).json({ 
                    mensaje: 'Ya existe una cuenta con este email pendiente de verificación. Se ha enviado un nuevo código.',
                    requiereVerificacion: true
                });
                return;
            }

            res.status(409).json({ 
                error: 'Email en uso',
                mensaje: 'Ya existe una cuenta con este email' 
            });
            return;
        }

        // Hashear contraseña
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Generar token de verificación (4 dígitos)
        const token = generarToken4Digitos();
        const expiracion = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

        // Crear nuevo admin
        const nuevoAdmin: Admin = {
            id: generarId(),
            email: email.toLowerCase(),
            password: passwordHash,
            nombre,
            emailVerificado: false,
            tokenVerificacion: token,
            tokenExpiracion: expiracion.toISOString(),
            creadoEn: new Date().toISOString(),
            actualizadoEn: new Date().toISOString()
        };

        await crearAdmin(nuevoAdmin);

        // Marcar invitación como usada
        await marcarInvitacionUsada(codigoInvitacion, email);

        // Enviar email con token
        const emailEnviado = await enviarEmailVerificacion(email, nombre, token);

        if (!emailEnviado) {
            console.warn('⚠️ No se pudo enviar el email, pero el usuario fue creado');
        }

        console.log(`👤 Nuevo admin registrado: ${email} - Token: ${token} (Invitación: ${codigoInvitacion})`);

        res.status(201).json({ 
            mensaje: 'Registro exitoso. Revisa tu email para verificar tu cuenta.',
            requiereVerificacion: true,
            // En desarrollo, incluir el token para facilitar pruebas
            ...(process.env.NODE_ENV !== 'production' && { tokenDebug: token })
        });

    } catch (error) {
        console.error('❌ Error en registro:', error);
        res.status(500).json({ 
            error: 'Error interno',
            mensaje: 'Ocurrió un error al procesar el registro' 
        });
    }
}

// ─── POST /api/auth/verificar ────────────────────────────────────────────────
// Verifica el email con el token de 4 dígitos
export async function verificarEmail(req: Request, res: Response): Promise<void> {
    try {
        const { email, token } = req.body as VerificarEmailRequest;

        if (!email || !token) {
            res.status(400).json({ 
                error: 'Datos incompletos',
                mensaje: 'Email y token son requeridos' 
            });
            return;
        }

        // Validar que el token sea de 4 dígitos
        if (!/^\d{4}$/.test(token)) {
            res.status(400).json({ 
                error: 'Token inválido',
                mensaje: 'El token debe ser de 4 dígitos' 
            });
            return;
        }

        const admin = await buscarAdminPorEmail(email);

        if (!admin) {
            res.status(404).json({ 
                error: 'No encontrado',
                mensaje: 'No existe una cuenta con este email' 
            });
            return;
        }

        if (admin.emailVerificado) {
            res.status(400).json({ 
                error: 'Ya verificado',
                mensaje: 'Este email ya fue verificado. Puedes iniciar sesión.' 
            });
            return;
        }

        // Verificar token
        if (admin.tokenVerificacion !== token) {
            res.status(401).json({ 
                error: 'Token incorrecto',
                mensaje: 'El código de verificación no es correcto' 
            });
            return;
        }

        // Verificar expiración
        if (admin.tokenExpiracion && new Date(admin.tokenExpiracion) < new Date()) {
            res.status(401).json({ 
                error: 'Token expirado',
                mensaje: 'El código ha expirado. Solicita uno nuevo.' 
            });
            return;
        }

        // Marcar como verificado
        await actualizarAdmin(admin.id, {
            emailVerificado: true,
            tokenVerificacion: null,
            tokenExpiracion: null
        });

        // Enviar email de bienvenida
        await enviarEmailBienvenida(email, admin.nombre);

        console.log(`✅ Email verificado: ${email}`);

        res.status(200).json({ 
            mensaje: '¡Email verificado exitosamente! Ya puedes iniciar sesión.' 
        });

    } catch (error) {
        console.error('❌ Error en verificación:', error);
        res.status(500).json({ 
            error: 'Error interno',
            mensaje: 'Ocurrió un error al verificar el email' 
        });
    }
}

// ─── POST /api/auth/reenviar-token ───────────────────────────────────────────
// Reenvía el token de verificación
export async function reenviarToken(req: Request, res: Response): Promise<void> {
    try {
        const { email } = req.body;

        if (!email) {
            res.status(400).json({ 
                error: 'Datos incompletos',
                mensaje: 'El email es requerido' 
            });
            return;
        }

        const admin = await buscarAdminPorEmail(email);

        if (!admin) {
            res.status(404).json({ 
                error: 'No encontrado',
                mensaje: 'No existe una cuenta con este email' 
            });
            return;
        }

        if (admin.emailVerificado) {
            res.status(400).json({ 
                error: 'Ya verificado',
                mensaje: 'Este email ya fue verificado' 
            });
            return;
        }

        // Generar nuevo token
        const token = generarToken4Digitos();
        const expiracion = new Date(Date.now() + 15 * 60 * 1000);

        await actualizarAdmin(admin.id, {
            tokenVerificacion: token,
            tokenExpiracion: expiracion.toISOString()
        });

        await enviarEmailVerificacion(email, admin.nombre, token);

        console.log(`📧 Token reenviado a: ${email} - Token: ${token}`);

        res.status(200).json({ 
            mensaje: 'Se ha enviado un nuevo código a tu email.',
            ...(process.env.NODE_ENV !== 'production' && { tokenDebug: token })
        });

    } catch (error) {
        console.error('❌ Error reenviando token:', error);
        res.status(500).json({ 
            error: 'Error interno',
            mensaje: 'Ocurrió un error al reenviar el código' 
        });
    }
}

// ─── POST /api/auth/login ────────────────────────────────────────────────────
// Inicia sesión y devuelve JWT
export async function loginAdmin(req: Request, res: Response): Promise<void> {
    try {
        const { email, password } = req.body as LoginRequest;

        if (!email || !password) {
            res.status(400).json({ 
                error: 'Datos incompletos',
                mensaje: 'Email y contraseña son requeridos' 
            });
            return;
        }

        const admin = await buscarAdminPorEmail(email);

        if (!admin) {
            res.status(401).json({ 
                error: 'Credenciales inválidas',
                mensaje: 'Email o contraseña incorrectos' 
            });
            return;
        }

        // Verificar que el email esté verificado
        if (!admin.emailVerificado) {
            res.status(403).json({ 
                error: 'Email no verificado',
                mensaje: 'Debes verificar tu email antes de iniciar sesión',
                requiereVerificacion: true
            });
            return;
        }

        // Verificar contraseña
        const passwordValida = await bcrypt.compare(password, admin.password);

        if (!passwordValida) {
            res.status(401).json({ 
                error: 'Credenciales inválidas',
                mensaje: 'Email o contraseña incorrectos' 
            });
            return;
        }

        // Generar JWT
        const token = generarJWT({
            adminId: admin.id,
            email: admin.email
        });

        console.log(`🔐 Login exitoso: ${email}`);

        res.status(200).json({ 
            mensaje: 'Inicio de sesión exitoso',
            token,
            admin: {
                id: admin.id,
                email: admin.email,
                nombre: admin.nombre
            }
        });

    } catch (error) {
        console.error('❌ Error en login:', error);
        res.status(500).json({ 
            error: 'Error interno',
            mensaje: 'Ocurrió un error al iniciar sesión' 
        });
    }
}

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
// Obtiene datos del admin autenticado
export async function obtenerPerfil(req: AuthRequest, res: Response): Promise<void> {
    try {
        if (!req.admin) {
            res.status(401).json({ 
                error: 'No autenticado',
                mensaje: 'Debes iniciar sesión' 
            });
            return;
        }

        const admin = await buscarAdminPorId(req.admin.adminId);

        if (!admin) {
            res.status(404).json({ 
                error: 'No encontrado',
                mensaje: 'Administrador no encontrado' 
            });
            return;
        }

        res.status(200).json({
            id: admin.id,
            email: admin.email,
            nombre: admin.nombre,
            creadoEn: admin.creadoEn
        });

    } catch (error) {
        console.error('❌ Error obteniendo perfil:', error);
        res.status(500).json({ 
            error: 'Error interno',
            mensaje: 'Ocurrió un error al obtener el perfil' 
        });
    }
}

// ─── POST /api/auth/invitaciones ─────────────────────────────────────────────
// Genera un nuevo código de invitación (solo admin autenticado)
export async function generarInvitacion(req: AuthRequest, res: Response): Promise<void> {
    try {
        if (!req.admin) {
            res.status(401).json({ error: 'No autenticado' });
            return;
        }

        const { diasValidez = 7 } = req.body;
        
        const invitacion = await crearInvitacion(req.admin.adminId, diasValidez);
        
        console.log(`🎟️ Nueva invitación generada: ${invitacion.codigo} por ${req.admin.email}`);

        res.status(201).json({
            mensaje: 'Invitación generada exitosamente',
            invitacion: {
                codigo: invitacion.codigo,
                expiraEn: invitacion.expiraEn
            }
        });

    } catch (error) {
        console.error('❌ Error generando invitación:', error);
        res.status(500).json({ error: 'Error al generar invitación' });
    }
}

// ─── GET /api/auth/invitaciones ──────────────────────────────────────────────
// Lista todas las invitaciones (solo admin autenticado)
export async function listarInvitaciones(req: AuthRequest, res: Response): Promise<void> {
    try {
        if (!req.admin) {
            res.status(401).json({ error: 'No autenticado' });
            return;
        }

        const todas = await obtenerInvitaciones();
        const activas = await obtenerInvitacionesActivas();

        res.status(200).json({
            total: todas.length,
            activas: activas.length,
            invitaciones: todas.map(inv => ({
                id: inv.id,
                codigo: inv.codigo,
                creadoEn: inv.creadoEn,
                expiraEn: inv.expiraEn,
                usado: inv.usado,
                usadoPor: inv.usadoPor,
                usadoEn: inv.usadoEn,
                expirado: new Date(inv.expiraEn) < new Date()
            }))
        });

    } catch (error) {
        console.error('❌ Error listando invitaciones:', error);
        res.status(500).json({ error: 'Error al listar invitaciones' });
    }
}

// ─── DELETE /api/auth/invitaciones/:id ───────────────────────────────────────
// Elimina una invitación (solo admin autenticado)
export async function eliminarInvitacionHandler(req: AuthRequest, res: Response): Promise<void> {
    try {
        if (!req.admin) {
            res.status(401).json({ error: 'No autenticado' });
            return;
        }

        const id = req.params.id as string;
        const eliminada = await eliminarInvitacion(id);

        if (!eliminada) {
            res.status(404).json({ error: 'Invitación no encontrada' });
            return;
        }

        console.log(`🗑️ Invitación eliminada: ${id} por ${req.admin.email}`);

        res.status(200).json({ mensaje: 'Invitación eliminada' });

    } catch (error) {
        console.error('❌ Error eliminando invitación:', error);
        res.status(500).json({ error: 'Error al eliminar invitación' });
    }
}

// ─── GET /api/auth/invitaciones/validar/:codigo ──────────────────────────────
// Valida un código de invitación (público, para el formulario de registro)
export async function validarCodigoInvitacion(req: Request, res: Response): Promise<void> {
    try {
        const codigo = req.params.codigo as string;
        const resultado = await validarInvitacion(codigo);

        res.status(resultado.valida ? 200 : 400).json({
            valido: resultado.valida,
            mensaje: resultado.mensaje
        });

    } catch (error) {
        console.error('❌ Error validando invitación:', error);
        res.status(500).json({ error: 'Error al validar invitación' });
    }
}
