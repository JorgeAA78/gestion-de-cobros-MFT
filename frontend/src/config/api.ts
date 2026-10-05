// URL oficial del backend en producción en Railway
export const PRODUCTION_API_URL = 'https://gestion-de-cobros-mft-production.up.railway.app';

// En desarrollo local apunta a localhost:3001; en cualquier versión compilada (web o móvil) apunta a Railway
export const API_URL = (import.meta as any).env?.DEV
    ? 'http://localhost:3001'
    : PRODUCTION_API_URL;

export const API_BASE = `${API_URL}/api`;
