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
    LogOut,
    Key,
} from 'lucide-react';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
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

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const router = useRouter();
    const pathname = usePathname();

    const handleNav = (href: string) => {
        // Si se navega a otra ruta y estaba en gestión de credenciales, limpiar sesión
        if (pathname === '/callao/gestion-credencial' && href !== '/callao/gestion-credencial') {
            sessionStorage.removeItem('credencial_autenticado');
        }
        router.push(href);
    };

    const handleVolverLogistica = () => {
        // Redirección inmediata sin esperar cierre del sidebar
        window.location.href = 'https://zeus-safety.vercel.app/logistica';
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
          w-60 bg-white
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
                style={{
                    boxShadow: '2px 0 8px 0 rgba(0, 0, 0, 0.08), 1px 0 2px 0 rgba(0, 0, 0, 0.04)',
                }}
            >
                {/* Logo Section */}
                <div className="relative border-b border-gray-200 bg-white group">
                    <button
                        onClick={() => handleNav('/callao')}
                        className="pt-2 pb-2 px-4 flex justify-center w-full bg-white hover:bg-white active:bg-white transition-colors duration-200"
                        aria-label="Ir al menú"
                    >
                        <div className="relative w-32 h-32">
                            <img
                                src="/imagenes/zeus.logooo.png"
                                alt="Zeus Safety Logo"
                                className="w-full h-full object-contain"
                            />
                        </div>
                    </button>
                    
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-3 px-2 custom-scrollbar" style={{ scrollbarWidth: 'thin' }}>
                    {navItems.map((group) => (
                        <div key={group.group} className="mb-6">
                            <div className="px-4 mb-2 flex-shrink-0 bg-white">
                                <h3
                                    className="font-bold text-gray-800 uppercase tracking-widest"
                                    style={{ fontFamily: 'var(--font-poppins)', fontSize: '11px' }}
                                >
                                    {group.group}
                                </h3>
                            </div>
                            <ul className="space-y-1">
                                {group.items.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = pathname === item.href || (item.href !== '/callao' && pathname.startsWith(item.href));
                                    return (
                                        <li key={item.id}>
                                            <button
                                                onClick={() => handleNav(item.href)}
                                                className={`w-full flex items-center justify-between px-3 py-2.5 transition-all duration-200 group hover:shadow-md active:scale-[0.98] border-l-4 ${isActive
                                                    ? 'bg-[#E9F1FF] text-[#001F3D] border-[#002D5A] shadow-sm'
                                                    : 'text-gray-700 hover:bg-[#E9F1FF] hover:text-[#001F3D] border-transparent'
                                                    }`}
                                                style={{ borderRadius: '10px' }}
                                            >
                                                <div className="flex items-center space-x-2.5">
                                                    <span className={`transition-colors flex-shrink-0 ${isActive ? 'text-[#002D5A]' : 'text-gray-600 group-hover:text-[#002D5A]'}`}>
                                                        <Icon className="w-5 h-5" />
                                                    </span>
                                                    <span
                                                        className={`text-xs text-left leading-tight font-medium ${isActive ? 'text-[#001F3D]' : 'text-gray-800 group-hover:text-[#001F3D]'}`}
                                                        style={{ fontFamily: 'var(--font-poppins)' }}
                                                    >
                                                        {item.label}
                                                    </span>
                                                </div>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>

                {/* Footer fijo (no scrollea) */}
                <div className="flex-shrink-0 border-t border-gray-200 bg-white p-3">
    <button
        onClick={handleVolverLogistica}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md font-bold transition-all duration-200 shadow-md text-[10px] bg-[#002D5A] hover:bg-[#001F3D] text-white hover:shadow-lg active:scale-95"
        style={{ fontFamily: 'var(--font-poppins)' }}
    >
        <LogOut className="w-4 h-4" />
        {/* QUITÉ 'uppercase' Y 'tracking-wider' PARA QUE SE VEA NATURAL */}
        <span className="">Volver a Logística</span>
    </button>
</div>


            </aside>
        </>
    );
}
