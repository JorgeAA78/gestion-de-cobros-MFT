// ─── Middleware de autenticación ─────────────────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { TokenPayload } from './types.js';

dotenv.config();

// En producción, exigir que JWT_SECRET esté definido y no sea el valor por defecto
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'mutantes-fight-team-secret-key-2024')) {
    console.error('FATAL: JWT_SECRET environment variable is missing or insecure in production!');
    console.error(`JWT_SECRET status: ${process.env.JWT_SECRET ? `DEFINED (Length: ${process.env.JWT_SECRET.length})` : 'UNDEFINED OR EMPTY'}`);
    if (process.env.JWT_SECRET === 'mutantes-fight-team-secret-key-2024') {
        console.error('Error: JWT_SECRET has the default insecure value ("mutantes-fight-team-secret-key-2024"). Please change it in the Railway dashboard to a secure custom string.');
    }
    process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET || 'mutantes-fight-team-secret-key-2024';

// Extender Request para incluir datos del admin autenticado
export interface AuthRequest extends Request {
    admin?: TokenPayload;
}

// ─── Middleware para verificar JWT ───────────────────────────────────────────
export const authMiddleware = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ 
            error: 'Acceso no autorizado',
            mensaje: 'Token no proporcionado' 
        });
        return;
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
        req.admin = decoded;
        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            res.status(401).json({ 
                error: 'Sesión expirada',
                mensaje: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.' 
            });
        } else {
            res.status(401).json({ 
                error: 'Token inválido',
                mensaje: 'El token de autenticación no es válido.' 
            });
        }
    }
};

// ─── Generar JWT ─────────────────────────────────────────────────────────────
export function generarJWT(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

// ─── Verificar JWT (sin middleware) ──────────────────────────────────────────
export function verificarJWT(token: string): TokenPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch {
        return null;
    }
}

// ─── Rate Limiter en Memoria para Fuerza Bruta ──────────────────────────────
interface RateLimitInfo {
    count: number;
    resetTime: number;
}

const rateLimits = new Map<string, RateLimitInfo>();

export const rateLimiter = (limit: number, windowMs: number) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        const info = rateLimits.get(ip);

        if (!info || now > info.resetTime) {
            rateLimits.set(ip, {
                count: 1,
                resetTime: now + windowMs,
            });
            next();
            return;
        }

        info.count++;
        if (info.count > limit) {
            const retryAfter = Math.ceil((info.resetTime - now) / 1000);
            res.set('Retry-After', String(retryAfter));
            res.status(429).json({
                error: 'Too Many Requests',
                mensaje: `Demasiadas peticiones. Intenta de nuevo en ${retryAfter} segundos.`
            });
            return;
        }

        next();
    };
};
