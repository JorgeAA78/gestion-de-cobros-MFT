import { useAuthStore } from '../store/authStore';

const API_BASE = (import.meta as any).env?.PROD ? '/api' : 'http://localhost:3001/api';

async function getAuthHeaders() {
    const token = useAuthStore.getState().token;
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
}

export async function sendWhatsApp(
    apiUrl: string,
    apiKey: string,
    instance: string,
    number: string,
    text: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/whatsapp/send`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ apiUrl, apiKey, instance, number, text }),
        });
        return await res.json();
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function testConnection(
    apiUrl: string,
    apiKey: string,
    instance: string
): Promise<{ connected: boolean; state?: string; error?: string }> {
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/whatsapp/test`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ apiUrl, apiKey, instance }),
        });
        return await res.json();
    } catch (e: any) {
        return { connected: false, error: e.message };
    }
}

export function formatWhatsApp(number: string): string {
    let clean = number.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = clean.substring(1);
    if (!clean.startsWith('54') && clean.length <= 10) clean = '54' + clean;
    return clean;
}

export function buildMessage(
    template: string,
    vars: Record<string, string>
): string {
    let msg = template;
    for (const [k, v] of Object.entries(vars)) {
        msg = msg.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return msg;
}

export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
    }).format(amount);
}

export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
