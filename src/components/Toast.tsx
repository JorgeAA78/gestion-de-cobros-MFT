import { useRef } from 'react';

interface ToastItem {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
}

let toastFn: ((msg: string, type?: ToastItem['type']) => void) | null = null;

export function showToast(msg: string, type: ToastItem['type'] = 'info') {
    toastFn?.(msg, type);
}

import { useState, useCallback, useEffect } from 'react';

export function ToastContainer() {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const idRef = useRef(0);

    const addToast = useCallback((msg: string, type: ToastItem['type'] = 'info') => {
        const id = ++idRef.current;
        setToasts((t) => [...t, { id, message: msg, type }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
    }, []);

    useEffect(() => {
        toastFn = addToast;
        return () => { toastFn = null; };
    }, [addToast]);

    const icons: Record<string, string> = {
        success: '✅', error: '❌', info: '💡', warning: '⚠️',
    };

    return (
        <div className="toast-container">
            {toasts.map((t) => (
                <div key={t.id} className={`toast ${t.type}`}>
                    <span className="toast-icon">{icons[t.type]}</span>
                    <span>{t.message}</span>
                </div>
            ))}
        </div>
    );
}
