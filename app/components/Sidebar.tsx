'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
    PackagePlus,
    PackageMinus,
    LayoutDashboard,
    TrendingUp,
    History,
    ClipboardList,
    X,
    LogOut,
    Key,
} from 'lucide-react';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    isDesktop?: boolean;
}

const navItems = [
    {
        group: 'PRINCIPAL',
        items: [
            { id: 'dashboard', label: 'Stock Total', href: '/callao', icon: LayoutDashboard },
        ],
    },
    {
        group: 'MOVIMIENTOS',
        items: [
            { id: 'entradas', label: 'Entradas', href: '/callao/entradas', icon: PackagePlus },
            { id: 'salidas', label: 'Salidas', href: '/callao/salidas', icon: PackageMinus },
            { id: 'traslado', label: 'Traslados', href: '/callao/traslado', icon: PackagePlus },
        ],
    },
    {
        group: 'EDITAR MOVIMIENTOS',
        items: [
            { id: 'historial-entradas', label: 'Historial Entradas', href: '/callao/historial-entradas', icon: History },
            { id: 'historial-salidas', label: 'Historial Salidas', href: '/callao/historial-salidas', icon: ClipboardList },
            { id: 'historial-traslado', label: 'Historial Traslado', href: '/callao/historial-traslado', icon: History },
        ],
    },
    {
        group: 'HISTORIAL DE MOVIMIENTOS EDITADOS',
        items: [
            { id: 'cambios-entrada', label: 'Cambios Entrada', href: '/callao/cambios-entrada', icon: TrendingUp },
            { id: 'cambios-salida', label: 'Cambios Salida', href: '/callao/cambios-salida', icon: TrendingUp },
            { id: 'cambios-traslado', label: 'Cambios Traslado', href: '/callao/cambios-traslado', icon: TrendingUp },
        ],
    },
    {
        group: 'CREDENCIAL',
        items: [
            { id: 'gestion-credencial', label: 'Gestión de Credencial', href: '/callao/gestion-credencial', icon: Key },
        ],
    },
];

export default function Sidebar({ isOpen, onClose, isDesktop = false }: SidebarProps) {
    const router = useRouter();
    const pathname = usePathname();

    // Bloquear scroll del body cuando el drawer móvil está abierto
    useEffect(() => {
        if (isDesktop || !isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [isOpen, isDesktop]);

    const handleNav = (href: string) => {
        if (pathname === '/callao/gestion-credencial' && href !== '/callao/gestion-credencial') {
            sessionStorage.removeItem('credencial_autenticado');
        }
        router.push(href);
        if (!isDesktop) onClose();
    };

    const handleVolverLogistica = () => {
        window.location.href = 'https://zeus-safety.vercel.app/logistica';
    };

    return (
        <>
            {/* Overlay móvil */}
            <div
                className={`fixed inset-0 z-[1040] bg-black/50 backdrop-blur-sm lg:hidden transition-opacity duration-300 ${
                    isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
                onClick={onClose}
                aria-hidden={!isOpen}
            />

            {/* Sidebar / drawer */}
            <aside
                className={`
                    fixed inset-y-0 left-0 z-[1050]
                    w-60
                    bg-white flex flex-col
                    transform transition-transform duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                `}
                style={{
                    boxShadow: '2px 0 8px 0 rgba(0, 0, 0, 0.08), 1px 0 2px 0 rgba(0, 0, 0, 0.04)',
                }}
                aria-hidden={!isOpen}
            >
                {/* Logo + cerrar (móvil) */}
                <div className="relative border-b border-gray-200 bg-white flex-shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-3 right-3 z-10 p-2 rounded-lg hover:bg-gray-100 text-gray-500 lg:hidden"
                        aria-label="Cerrar menú"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => handleNav('/callao')}
                        className="pt-2 pb-2 px-4 flex justify-center w-full bg-white hover:bg-white active:bg-white transition-colors duration-200"
                        aria-label="Ir al menú"
                    >
                        <div className="relative w-28 h-28 sm:w-32 sm:h-32">
                            <img
                                src="/imagenes/zeus.logooo.png"
                                alt="Zeus Safety Logo"
                                className="w-full h-full object-contain"
                            />
                        </div>
                    </button>
                </div>

                {/* Navigation */}
                <nav
                    className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 custom-scrollbar min-h-0"
                    style={{ scrollbarWidth: 'thin' }}
                >
                    {navItems.map(group => (
                        <div key={group.group} className="mb-6">
                            <div className="px-3 mb-2 flex-shrink-0 bg-white">
                                <h3
                                    className="font-bold text-gray-800 uppercase tracking-widest truncate"
                                    style={{ fontFamily: 'var(--font-poppins)', fontSize: '11px' }}
                                    title={group.group}
                                >
                                    {group.group}
                                </h3>
                            </div>
                            <ul className="space-y-1">
                                {group.items.map(item => {
                                    const Icon = item.icon;
                                    const isActive =
                                        pathname === item.href ||
                                        (item.href !== '/callao' && pathname.startsWith(item.href));
                                    return (
                                        <li key={item.id}>
                                            <button
                                                type="button"
                                                onClick={() => handleNav(item.href)}
                                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 transition-all duration-200 group hover:shadow-md active:scale-[0.98] border-l-4 min-w-0 ${
                                                    isActive
                                                        ? 'bg-[#E9F1FF] text-[#001F3D] border-[#002D5A] shadow-sm'
                                                        : 'text-gray-700 hover:bg-[#E9F1FF] hover:text-[#001F3D] border-transparent'
                                                }`}
                                                style={{ borderRadius: '10px' }}
                                            >
                                                <span
                                                    className={`transition-colors flex-shrink-0 ${
                                                        isActive
                                                            ? 'text-[#002D5A]'
                                                            : 'text-gray-600 group-hover:text-[#002D5A]'
                                                    }`}
                                                >
                                                    <Icon className="w-5 h-5" />
                                                </span>
                                                <span
                                                    className={`text-xs text-left leading-tight font-medium truncate min-w-0 ${
                                                        isActive
                                                            ? 'text-[#001F3D]'
                                                            : 'text-gray-800 group-hover:text-[#001F3D]'
                                                    }`}
                                                    style={{ fontFamily: 'var(--font-poppins)' }}
                                                >
                                                    {item.label}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>

                {/* Footer fijo */}
                <div className="flex-shrink-0 border-t border-gray-200 bg-white p-3">
                    <button
                        type="button"
                        onClick={handleVolverLogistica}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md font-bold transition-all duration-200 shadow-md text-[10px] bg-[#002D5A] hover:bg-[#001F3D] text-white hover:shadow-lg active:scale-95"
                        style={{ fontFamily: 'var(--font-poppins)' }}
                    >
                        <LogOut className="w-4 h-4 flex-shrink-0" />
                        <span>Volver a Logística</span>
                    </button>
                </div>
            </aside>
        </>
    );
}
