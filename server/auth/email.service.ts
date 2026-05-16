// ─── Servicio de envío de emails ─────────────────────────────────────────────
// Usamos Resend (API HTTP) porque Railway bloquea SMTP saliente
import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

// Configuración de Resend
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || 'onboarding@resend.dev';

// Log de configuración
console.log('📧 Configuración Email (Resend):');
console.log(`   API Key: ${RESEND_API_KEY ? '✓ Configurada' : '⚠️ NO CONFIGURADA'}`);
console.log(`   From: ${FROM_EMAIL}`);

if (!RESEND_API_KEY) {
    console.warn('\n⚠️  ADVERTENCIA: RESEND_API_KEY no configurada.');
    console.warn('   Los emails NO se enviarán. El token se mostrará en consola.');
    console.warn('   Obtén tu API key gratis en: https://resend.com\n');
}

// Inicializar Resend
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const APP_NAME = 'Mutantes Fight Team - Sistema de Cobros';
const LOGO_URL = 'https://gestion-de-cobros-mft-production.up.railway.app/escudo26.png';

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

    // Si no hay API key de Resend, solo mostrar en consola
    if (!resend) {
        console.log('\n' + '='.repeat(50));
        console.log(`📧 EMAIL NO ENVIADO (Resend no configurado)`);
        console.log(`   Para: ${email}`);
        console.log(`   Nombre: ${nombre}`);
        console.log(`   🔐 CÓDIGO DE VERIFICACIÓN: ${token}`);
        console.log('='.repeat(50) + '\n');
        return true; // Retornamos true para que el flujo continúe
    }

    try {
        const { error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: `🔐 Código de verificación: ${token}`,
            html: htmlContent,
        });

        if (error) {
            throw error;
        }
        
        console.log(`📧 Email de verificación enviado a ${email}`);
        console.log(`   🔐 Token: ${token}`);
        return true;
    } catch (error: any) {
        console.error('\n❌ Error enviando email de verificación:');
        console.error(`   Mensaje: ${error.message || JSON.stringify(error)}`);
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

    if (!resend) {
        console.log(`📧 Email de bienvenida no enviado (Resend no configurado)`);
        return true;
    }

    try {
        const { error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: `✅ ¡Bienvenido/a a ${APP_NAME}!`,
            html: htmlContent,
        });

        if (error) {
            throw error;
        }
        
        console.log(`📧 Email de bienvenida enviado a ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Error enviando email de bienvenida:', error);
        return false;
    }
}

// ─── Verificar conexión (ya no necesario con API) ────────────────────────────
export async function verificarConexionSMTP(): Promise<boolean> {
    if (!resend) {
        console.log('⚠️ Resend no configurado');
        return false;
    }
    console.log('✅ Resend API configurada correctamente');
    return true;
}
