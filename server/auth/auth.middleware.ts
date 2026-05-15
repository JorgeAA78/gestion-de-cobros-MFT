// ─── Middleware de autenticación ─────────────────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { TokenPayload } from './types.js';

dotenv.config();

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
