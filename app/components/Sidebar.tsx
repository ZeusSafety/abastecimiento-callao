'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
    PackagePlus,
    PackageMinus,
    LayoutDashboard,
    TrendingUp,
    History,
    ClipboardList,
    BarChart2,
    X,
} from 'lucide-react';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const navItems = [
    {
        group: 'PRINCIPAL',
        items: [
            { id: 'dashboard', label: 'Stock Total', href: '/malvinas', icon: LayoutDashboard },
        ],
    },
    {
        group: 'MOVIMIENTOS',
        items: [
            { id: 'entradas', label: 'Entradas', href: '/malvinas/entradas', icon: PackagePlus },
            { id: 'salidas', label: 'Salidas', href: '/malvinas/salidas', icon: PackageMinus },
        ],
    },
    {
        group: 'HISTORIAL',
        items: [
            { id: 'historial-entradas', label: 'Historial Entradas', href: '/malvinas/historial-entradas', icon: History },
            { id: 'historial-salidas', label: 'Historial Salidas', href: '/malvinas/historial-salidas', icon: ClipboardList },
            { id: 'cambios-entrada', label: 'Cambios Entrada', href: '/malvinas/cambios-entrada', icon: TrendingUp },
            { id: 'cambios-salida', label: 'Cambios Salida', href: '/malvinas/cambios-salida', icon: TrendingUp },
        ],
    },
    {
        group: 'ABASTECIMIENTO',
        items: [
            { id: 'abastecimiento', label: 'Abastecer', href: '/malvinas/abastecimiento', icon: BarChart2 },
            { id: 'historial-carga', label: 'Historial por Carga', href: '/malvinas/historial-carga', icon: History },
            { id: 'historial-general', label: 'Historial General', href: '/malvinas/historial-general', icon: ClipboardList },
        ],
    },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const router = useRouter();
    const pathname = usePathname();

    const handleNav = (href: string) => {
        router.push(href);
    };

    return (
        <>
            {/* Overlay móvil */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
          fixed inset-y-0 left-0 z-[1030]
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
                style={{
                    width: '240px',
                    background: 'white',
                    boxShadow: '2px 0 8px rgba(0,0,0,0.08), 1px 0 2px rgba(0,0,0,0.04)',
                }}
            >
                {/* Logo */}
                <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <div
                            className="flex items-center justify-center rounded-xl text-white font-black text-lg"
                            style={{ width: 38, height: 38, background: 'linear-gradient(135deg, #002D5A, #0056b3)' }}
                        >
                            Z
                        </div>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#002D5A', lineHeight: 1.2 }}>
                                ZEUS SAFETY
                            </div>
                            <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 500 }}>
                                Almacén Malvinas
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-3 px-2" style={{ scrollbarWidth: 'thin' }}>
                    {navItems.map((group) => (
                        <div key={group.group} className="mb-4">
                            <div
                                className="px-3 mb-1.5"
                                style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.8px' }}
                            >
                                {group.group}
                            </div>
                            <ul className="space-y-0.5">
                                {group.items.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = pathname === item.href || (item.href !== '/malvinas' && pathname.startsWith(item.href));
                                    return (
                                        <li key={item.id}>
                                            <button
                                                onClick={() => handleNav(item.href)}
                                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] transition-all duration-200 active:scale-[0.98] ${isActive
                                                        ? 'bg-[#E9F1FF] text-[#002D5A] border-l-4 border-[#002D5A]'
                                                        : 'text-gray-600 hover:bg-gray-50 hover:text-[#002D5A] border-l-4 border-transparent'
                                                    }`}
                                                style={{ fontSize: 12.5, fontWeight: isActive ? 600 : 500 }}
                                            >
                                                <Icon className="w-4 h-4 flex-shrink-0" />
                                                <span className="text-left leading-tight">{item.label}</span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-gray-100">
                    <div
                        className="flex items-center gap-2 px-3 py-2 rounded-xl"
                        style={{ background: '#f0f4ff', fontSize: 11, color: '#374151' }}
                    >
                        <div
                            className="w-2 h-2 rounded-full animate-pulse"
                            style={{ background: '#22c55e' }}
                        />
                        <span style={{ fontWeight: 600 }}>Sistema activo</span>
                    </div>
                </div>
            </aside>
        </>
    );
}
