import { Capacitor } from '@capacitor/core';

// URL del backend en producción desplegado en Railway
export const PRODUCTION_API_URL = 'https://gestion-de-cobros-mft-production.up.railway.app';

export function getApiBaseUrl(): string {
    // 1. Si está explícitamente configurada en variables de entorno Vite
    const envUrl = (import.meta as any).env?.VITE_API_URL;
    if (envUrl) {
        return envUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');
    }

    // 2. Si se ejecuta como app nativa móvil (Android o iOS) con Capacitor
    if (Capacitor.isNativePlatform()) {
        return PRODUCTION_API_URL;
    }

    // 3. Si se ejecuta dentro del WebView de Capacitor (origin es https://localhost o capacitor://localhost)
    if (typeof window !== 'undefined') {
        const isCapacitorOrigin =
            window.location.protocol === 'capacitor:' ||
            (window.location.protocol === 'https:' && window.location.hostname === 'localhost');
        if (isCapacitorOrigin) {
            return PRODUCTION_API_URL;
        }
    }

    // 4. Si es producción web alojada en Railway (usar ruta relativa)
    if ((import.meta as any).env?.PROD) {
        return '';
    }

    // 5. Entorno local de desarrollo
    return 'http://localhost:3001';
}

export const API_URL = getApiBaseUrl();
export const API_BASE = `${API_URL}/api`;
