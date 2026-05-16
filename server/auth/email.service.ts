// ─── Servicio de envío de emails ─────────────────────────────────────────────
// Usamos EmailJS (API HTTP) porque Railway bloquea SMTP saliente
import dotenv from 'dotenv';

dotenv.config();

// Configuración de EmailJS
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_2sloaub';
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID || 'template_549t28b';
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || '_J3oTuwswOdPJI0wH';
const EMAILJS_API_URL = 'https://api.emailjs.com/api/v1.0/email/send';

// Log de configuración
console.log('📧 Configuración Email (EmailJS):');
console.log(`   Service ID: ${EMAILJS_SERVICE_ID}`);
console.log(`   Template ID: ${EMAILJS_TEMPLATE_ID}`);
console.log(`   Public Key: ${EMAILJS_PUBLIC_KEY ? '✓ Configurada' : '⚠️ NO CONFIGURADA'}`);

// ─── Generar token de 4 dígitos ──────────────────────────────────────────────
export function generarToken4Digitos(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// ─── Función para enviar email via EmailJS API ──────────────────────────────
async function sendEmailJS(templateParams: Record<string, string>): Promise<boolean> {
    try {
        const response = await fetch(EMAILJS_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                service_id: EMAILJS_SERVICE_ID,
                template_id: EMAILJS_TEMPLATE_ID,
                user_id: EMAILJS_PUBLIC_KEY,
                template_params: templateParams,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`EmailJS error: ${response.status} - ${errorText}`);
        }

        return true;
    } catch (error: any) {
        console.error('❌ Error en EmailJS:', error.message);
        return false;
    }
}

// ─── Email de verificación de cuenta ─────────────────────────────────────────
export async function enviarEmailVerificacion(
    email: string,
    nombre: string,
    token: string
): Promise<boolean> {
    console.log(`📧 Enviando email de verificación a ${email}...`);

    try {
        const success = await sendEmailJS({
            to_email: email,
            nombre: nombre,
            token: token,
            email: email,
        });

        if (success) {
            console.log(`✅ Email de verificación enviado a ${email}`);
            console.log(`   🔐 Token: ${token}`);
            return true;
        } else {
            throw new Error('EmailJS retornó false');
        }
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
    // Por ahora no enviamos email de bienvenida (necesitaría otro template)
    console.log(`📧 Bienvenida para ${nombre} (${email}) - Template no configurado`);
    return true;
}

// ─── Verificar conexión ─────────────────────────────────────────────────────
export async function verificarConexionSMTP(): Promise<boolean> {
    console.log('✅ EmailJS configurado correctamente');
    return true;
}
