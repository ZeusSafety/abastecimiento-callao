'use client';

import React from 'react';
import { useCallao } from '../context/CallaoContext';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export default function ToastContainer() {
    const { state, removeToast } = useCallao();

    const iconMap = {
        success: <CheckCircle className="w-4 h-4" />,
        error: <XCircle className="w-4 h-4" />,
        warning: <AlertCircle className="w-4 h-4" />,
        info: <Info className="w-4 h-4" />,
    };

    return (
        <div className="toast-container">
            {state.toasts.map(t => (
                <div key={t.id} className={`toast toast-${t.type}`}>
                    {iconMap[t.type]}
                    <span className="flex-1" style={{ fontSize: 12 }}>{t.message}</span>
                    <button onClick={() => removeToast(t.id)} className="ml-2 opacity-60 hover:opacity-100">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            ))}
        </div>
    );
}
