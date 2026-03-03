'use client';

import React, { useState, useEffect } from 'react';
import { Menu, Bell, Package } from 'lucide-react';
import { useMalvinas } from '../context/MalvinasContext';

interface HeaderProps {
    onToggleSidebar: () => void;
    sidebarOpen: boolean;
}

export default function Header({ onToggleSidebar }: HeaderProps) {
    const { state } = useMalvinas();
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

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

                {/* Title badge */}
                <div className="flex items-center gap-2">
                    <div
                        className="px-3 py-1 rounded-full text-xs font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, #002D5A, #0056b3)', fontSize: 11 }}
                    >
                        ALMACÉN MALVINAS
                    </div>
                    <span style={{ color: '#d1d5db', fontSize: 12 }}>|</span>
                    <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>
                        {fmtTime(currentTime)}
                    </span>
                </div>
            </div>

            {/* RIGHT */}
            <div className="flex items-center gap-2">
                {/* Product count badge */}
                <div
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-bold"
                    style={{ background: '#198754', fontSize: 11 }}
                >
                    <Package className="w-3.5 h-3.5" />
                    <span>Productos: {state.productos.length}</span>
                </div>

                {/* Entradas counter */}
                <div
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                    style={{ background: '#dbeafe', color: '#1e40af', fontSize: 11 }}
                >
                    <span>Entradas: {state.entradas.length}</span>
                </div>

                {/* Salidas counter */}
                <div
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                    style={{ background: '#fce7f3', color: '#9d174d', fontSize: 11 }}
                >
                    <span>Salidas: {state.salidas.length}</span>
                </div>

                {/* Bell */}
                <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
                    <Bell className="w-4.5 h-4.5 text-gray-500" />
                </button>
            </div>
        </header>
    );
}
