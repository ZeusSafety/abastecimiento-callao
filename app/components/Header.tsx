'use client';

import React, { useState, useEffect } from 'react';
import { Menu, Bell, Package } from 'lucide-react';
import { useMalvinas } from '../context/MalvinasContext';
import NotificationModal from './NotificationModal';

interface HeaderProps {
    onToggleSidebar: () => void;
    sidebarOpen: boolean;
}

export default function Header({ onToggleSidebar }: HeaderProps) {
    const { state } = useMalvinas();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const unreadCount = state.notifications.filter(n => !n.read).length;

    const fmtTime = (d: Date) =>
        d.toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short' }) +
        ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    return (
        <header
            className="sticky top-0 z-[1020] flex items-center justify-between px-5 py-0 border-b border-gray-200 bg-white"
            style={{ height: 60, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
            {/* LEFT */}
            <div className="flex items-center gap-3">
                {/* Hamburger */}
                <button
                    onClick={onToggleSidebar}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    aria-label="Toggle sidebar"
                >
                    <Menu className="w-5 h-5 text-gray-600" />
                </button>

                {/* Title branding */}
                <div className="flex items-center text-center">
                    <h2 className="font-extrabold tracking-tight text-[#002D5A] m-0" style={{ fontSize: '13px', letterSpacing: '0.05em' }}>
                        SISTEMA DE ABASTECIMIENTO
                    </h2>
                </div>
                <div className="hidden lg:block">
                    <span style={{ color: '#e5e7eb', fontSize: 12, margin: '0 12px' }}>|</span>
                    <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, letterSpacing: '0.1em' }}>
                        {fmtTime(currentTime).toUpperCase()}
                    </span>
                </div>
            </div>

            {/* RIGHT */}
            <div className="flex items-center gap-2">
                {/* Product count badge */}
                <div
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-bold"
                    style={{ background: '#198754', fontSize: 10 }}
                >
                    <Package className="w-3.5 h-3.5" />
                    <span>Productos: {state.productos.length}</span>
                </div>

                {/* Entradas counter - hidden on mobile small */}
                <div
                    className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                    style={{ background: '#dbeafe', color: '#1e40af', fontSize: 10 }}
                >
                    <span>Entradas: {state.entradas.length}</span>
                </div>

                {/* Salidas counter - hidden on mobile small */}
                <div
                    className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                    style={{ background: '#fce7f3', color: '#9d174d', fontSize: 10 }}
                >
                    <span>Salidas: {state.salidas.length}</span>
                </div>

                {/* Bell */}
                <button
                    onClick={() => setIsNotificationOpen(true)}
                    className="relative p-2 rounded-xl bg-gray-50 border border-gray-100 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all group shadow-sm active:scale-90"
                >
                    <Bell className="w-4.5 h-4.5 text-gray-500 group-hover:text-blue-600 transition-colors" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[8px] font-black rounded-lg flex items-center justify-center border-2 border-white shadow-sm animate-bounce">
                            {unreadCount > 9 ? '+9' : unreadCount}
                        </span>
                    )}
                </button>
            </div>

            <NotificationModal
                isOpen={isNotificationOpen}
                onClose={() => setIsNotificationOpen(false)}
            />
        </header>
    );
}
