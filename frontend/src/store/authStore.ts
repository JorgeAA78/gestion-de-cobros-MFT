// ─── Store de autenticación con Zustand ──────────────────────────────────────
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Admin {
    id: string;
    email: string;
    nombre: string;
}

interface AuthState {
    token: string | null;
    admin: Admin | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    
    // Acciones
    setAuth: (token: string, admin: Admin) => void;
    logout: () => void;
    setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            admin: null,
            isAuthenticated: false,
            isLoading: true,

            setAuth: (token, admin) => set({
                token,
                admin,
                isAuthenticated: true,
                isLoading: false,
            }),

            logout: () => set({
                token: null,
                admin: null,
                isAuthenticated: false,
                isLoading: false,
            }),

            setLoading: (loading) => set({ isLoading: loading }),
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                token: state.token,
                admin: state.admin,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);
