'use client';

import React, { useState } from 'react';
import { X, Bell, PackagePlus, PackageMinus, RefreshCw, Layers, Check } from 'lucide-react';
import { useCallao, NotificationItem } from '../context/CallaoContext';

interface NotificationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function NotificationModal({ isOpen, onClose }: NotificationModalProps) {
    const { state, markNotificationsAsRead } = useCallao();
    const [activeTab, setActiveTab] = useState<'todos' | 'entrada' | 'salida' | 'cambio' | 'abastecimiento'>('todos');

    if (!isOpen) return null;

    const filtered = state.notifications.filter(n =>
        activeTab === 'todos' ? true : n.type === activeTab
    );

    const getIcon = (type: NotificationItem['type']) => {
        switch (type) {
            case 'entrada': return <PackagePlus className="w-4 h-4 text-emerald-500" />;
            case 'salida': return <PackageMinus className="w-4 h-4 text-rose-500" />;
            case 'cambio': return <RefreshCw className="w-4 h-4 text-amber-500" />;
            case 'abastecimiento': return <Layers className="w-4 h-4 text-blue-500" />;
            default: return <Bell className="w-4 h-4 text-gray-500" />;
        }
    };

    const getBg = (type: NotificationItem['type']) => {
        switch (type) {
            case 'entrada': return 'bg-emerald-50';
            case 'salida': return 'bg-rose-50';
            case 'cambio': return 'bg-amber-50';
            case 'abastecimiento': return 'bg-blue-50';
            default: return 'bg-gray-50';
        }
    };

    return (
        <div
            className="fixed inset-0 z-[2000] flex items-start justify-end p-4 sm:p-6 bg-black/20 backdrop-blur-sm animate-in fade-in duration-300"
        >
            <div
                className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-right-8 duration-500"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-[#002D5A] rounded-xl shadow-lg shadow-blue-900/20">
                            <Bell className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-black text-gray-900 text-base leading-none uppercase tracking-tight">Notificaciones</h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Historial de actividades recientes</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { markNotificationsAsRead(); }}
                            className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-xl transition-all group"
                            title="Marcar todas como leídas"
                        >
                            <Check className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 text-gray-400 rounded-xl transition-all">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-6 py-3 border-b border-gray-50 bg-gray-50/30 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {(['todos', 'entrada', 'salida', 'cambio', 'abastecimiento'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab
                                    ? 'bg-[#002D5A] text-white shadow-md shadow-blue-900/10'
                                    : 'bg-white text-gray-400 border border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* List */}
                <div className="overflow-y-auto max-h-[calc(100vh-250px)] divide-y divide-gray-50 scrollbar-thin">
                    {filtered.length > 0 ? (
                        filtered.map(n => (
                            <div key={n.id} className={`p-5 hover:bg-gray-50 transition-colors flex gap-4 ${!n.read ? 'bg-blue-50/20' : ''}`}>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${getBg(n.type)}`}>
                                    {getIcon(n.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <h4 className="text-[11px] font-black text-gray-900 uppercase tracking-tight truncate">{n.title}</h4>
                                        {!n.read && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1 shadow-sm shadow-blue-500/30" />}
                                    </div>
                                    <p className="text-[11px] font-medium text-gray-600 leading-relaxed mb-2 line-clamp-2">
                                        {n.message}
                                    </p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">{n.timestamp}</span>
                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tighter ${n.type === 'entrada' ? 'text-emerald-500 bg-emerald-50' :
                                                n.type === 'salida' ? 'text-rose-500 bg-rose-50' :
                                                    n.type === 'cambio' ? 'text-amber-500 bg-amber-50' :
                                                        'text-blue-500 bg-blue-50'
                                            }`}>
                                            {n.type}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="px-6 py-20 text-center">
                            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-100">
                                <Bell className="w-8 h-8 text-gray-200" />
                            </div>
                            <h5 className="text-xs font-black text-gray-400 uppercase tracking-widest">No hay notificaciones</h5>
                            <p className="text-[10px] text-gray-300 mt-2 font-medium">Las actividades recientes aparecerán aquí</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 text-center">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest italic opacity-60">Sistema de Abastecimiento Callao v1.0</p>
                </div>
            </div>
        </div>
    );
}
