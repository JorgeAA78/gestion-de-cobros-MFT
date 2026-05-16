// ─── Servicio de envío de emails ─────────────────────────────────────────────
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Verificar configuración SMTP
// Railway bloquea puerto 587, usamos 465 (SSL) que suele estar permitido
const SMTP_CONFIG = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true, // Puerto 465 requiere SSL
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM,
};

// Log de configuración (sin mostrar contraseña completa)
console.log('📧 Configuración SMTP:');
console.log(`   Host: ${SMTP_CONFIG.host}:${SMTP_CONFIG.port}`);
console.log(`   Usuario: ${SMTP_CONFIG.user || '⚠️ NO CONFIGURADO'}`);
console.log(`   Contraseña: ${SMTP_CONFIG.pass ? '✓ Configurada' : '⚠️ NO CONFIGURADA'}`);
console.log(`   From: ${SMTP_CONFIG.from || '⚠️ NO CONFIGURADO'}`);

if (!SMTP_CONFIG.user || !SMTP_CONFIG.pass) {
    console.warn('\n⚠️  ADVERTENCIA: Credenciales SMTP no configuradas.');
    console.warn('   Los emails NO se enviarán. El token se mostrará en consola.');
    console.warn('   Configura SMTP_USER y SMTP_PASS en el archivo .env\n');
}

// Configuración del transportador de email
// Puerto 465 con SSL directo (no STARTTLS)
const transporter = nodemailer.createTransport({
    host: SMTP_CONFIG.host,
    port: SMTP_CONFIG.port,
    secure: SMTP_CONFIG.secure,
    auth: {
        user: SMTP_CONFIG.user,
        pass: SMTP_CONFIG.pass,
    },
    tls: {
        rejectUnauthorized: false
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
} as any);

const FROM_EMAIL = SMTP_CONFIG.from || SMTP_CONFIG.user || 'noreply@mutantesfightteam.com';
const APP_NAME = 'Mutantes Fight Team - Sistema de Cobros';
const LOGO_URL = 'https://res.cloudinary.com/dydeai3gg/image/upload/v1775909710/logo_mutantes_jzabrb.jpg';

// ─── Generar token de 4 dígitos ──────────────────────────────────────────────
export function generarToken4Digitos(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// ─── Email de verificación de cuenta ─────────────────────────────────────────
export async function enviarEmailVerificacion(
    email: string,
    nombre: string,
    token: string
): Promise<boolean> {
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; background: #1a1a2e;">
            <div style="text-align: center; margin-bottom: 30px;">
                <img src="${LOGO_URL}" alt="Mutantes Fight Team" style="width: 100px; height: 100px; border-radius: 12px; margin-bottom: 15px;" />
                <h1 style="color: #86efac; margin: 0; font-size: 1.2rem;">${APP_NAME}</h1>
            </div>
            
            <h2 style="color: #fff;">¡Hola ${nombre}!</h2>
            
            <p style="color: #ccc; font-size: 16px;">
                Gracias por registrarte en nuestro sistema de administración. 
                Para completar tu registro, ingresa el siguiente código de verificación:
            </p>
            
            <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); 
                        padding: 25px; 
                        text-align: center; 
                        border-radius: 12px; 
                        margin: 25px 0;">
                <span style="font-size: 42px; 
                             font-weight: bold; 
                             letter-spacing: 12px; 
                             color: white;
                             text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">
                    ${token}
                </span>
            </div>
            
            <p style="color: #888; font-size: 14px; text-align: center;">
                ⏰ Este código expira en <strong style="color: #86efac;">15 minutos</strong>.
            </p>
            
            <hr style="border: none; border-top: 1px solid #333; margin: 30px 0;">
            
            <p style="color: #666; font-size: 12px; text-align: center;">
                Si no solicitaste este registro, puedes ignorar este email de forma segura.
            </p>
            
            <p style="color: #666; font-size: 12px; text-align: center;">
                © ${new Date().getFullYear()} ${APP_NAME}
            </p>
        </div>
    `;

    const textContent = `
¡Hola ${nombre}!

Gracias por registrarte en ${APP_NAME}.

Tu código de verificación es: ${token}

Este código expira en 15 minutos.

Si no solicitaste este registro, ignora este email.
    `;

    // Si no hay credenciales SMTP, solo mostrar en consola
    if (!SMTP_CONFIG.user || !SMTP_CONFIG.pass) {
        console.log('\n' + '='.repeat(50));
        console.log(`📧 EMAIL NO ENVIADO (SMTP no configurado)`);
        console.log(`   Para: ${email}`);
        console.log(`   Nombre: ${nombre}`);
        console.log(`   🔐 CÓDIGO DE VERIFICACIÓN: ${token}`);
        console.log('='.repeat(50) + '\n');
        return true; // Retornamos true para que el flujo continúe
    }

    try {
        await transporter.sendMail({
            from: `"${APP_NAME}" <${FROM_EMAIL}>`,
            to: email,
            subject: `🔐 Código de verificación: ${token}`,
            text: textContent,
            html: htmlContent,
        });
        
        console.log(`📧 Email de verificación enviado a ${email}`);
        console.log(`   🔐 Token: ${token}`);
        return true;
    } catch (error: any) {
        console.error('\n❌ Error enviando email de verificación:');
        console.error(`   Mensaje: ${error.message}`);
        if (error.code) console.error(`   Código: ${error.code}`);
        if (error.response) console.error(`   Respuesta: ${error.response}`);
        console.log(`\n   🔐 CÓDIGO DE VERIFICACIÓN (backup): ${token}\n`);
        return false;
    }
}

// ─── Email de bienvenida (después de verificar) ──────────────────────────────
export async function enviarEmailBienvenida(
    email: string,
    nombre: string
): Promise<boolean> {
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; background: #1a1a2e;">
            <div style="text-align: center; margin-bottom: 30px;">
                <img src="${LOGO_URL}" alt="Mutantes Fight Team" style="width: 100px; height: 100px; border-radius: 12px; margin-bottom: 15px;" />
                <h1 style="color: #86efac; margin: 0; font-size: 1.2rem;">${APP_NAME}</h1>
            </div>
            
            <h2 style="color: #22c55e;">¡Bienvenido/a ${nombre}! 🎉</h2>
            
            <p style="color: #ccc; font-size: 16px;">
                Tu cuenta ha sido verificada exitosamente. Ya puedes acceder al panel 
                de administración con tu email y contraseña.
            </p>
            
            <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid #22c55e; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #86efac;">
                    <strong>📧 Email:</strong> ${email}
                </p>
            </div>
            
            <p style="color: #ccc; font-size: 14px;">
                Desde el panel podrás gestionar alumnos, pagos y configuraciones del sistema.
            </p>
            
            <hr style="border: none; border-top: 1px solid #333; margin: 30px 0;">
            
            <p style="color: #666; font-size: 12px; text-align: center;">
                © ${new Date().getFullYear()} ${APP_NAME}
            </p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: `"${APP_NAME}" <${FROM_EMAIL}>`,
            to: email,
            subject: `✅ ¡Bienvenido/a a ${APP_NAME}!`,
            text: `¡Hola ${nombre}! Tu cuenta ha sido verificada exitosamente.`,
            html: htmlContent,
        });
        
        console.log(`📧 Email de bienvenida enviado a ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Error enviando email de bienvenida:', error);
        return false;
    }
}

// ─── Verificar conexión SMTP ─────────────────────────────────────────────────
export async function verificarConexionSMTP(): Promise<boolean> {
    try {
        await transporter.verify();
        console.log('✅ Conexión SMTP verificada correctamente');
        return true;
    } catch (error) {
        console.error('❌ Error verificando conexión SMTP:', error);
        return false;
    }
}
