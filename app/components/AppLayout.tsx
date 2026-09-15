'use client';

import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import ToastContainer from './ToastContainer';

const SIDEBAR_W = 240;

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isDesktop, setIsDesktop] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia('(min-width: 1024px)');
        const apply = () => {
            const desktop = mq.matches;
            setIsDesktop(desktop);
            // Desktop: abierto por defecto (acoplado al layout).
            // Móvil: cerrado (se abre como overlay).
            setSidebarOpen(desktop);
        };
        apply();
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, []);

    // En desktop, al abrir el sidebar el main REDUCE su ancho para caber
    // junto al menú (sin scroll horizontal). En móvil el menú es overlay.
    const desktopSidebarVisible = isDesktop && sidebarOpen;

    return (
        <>
            <Sidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                isDesktop={isDesktop}
            />
            <main
                className="flex flex-col min-h-screen min-w-0 overflow-x-hidden transition-[margin,width] duration-300 ease-in-out"
                style={{
                    marginLeft: desktopSidebarVisible ? SIDEBAR_W : 0,
                    width: desktopSidebarVisible ? `calc(100% - ${SIDEBAR_W}px)` : '100%',
                    maxWidth: desktopSidebarVisible ? `calc(100% - ${SIDEBAR_W}px)` : '100%',
                }}
            >
                <Header
                    onToggleSidebar={() => setSidebarOpen(v => !v)}
                    sidebarOpen={sidebarOpen}
                />
                <div
                    className="flex-1 overflow-x-hidden overflow-y-auto min-w-0"
                    style={{ padding: isDesktop ? 24 : 16, background: '#f4f6fa' }}
                >
                    {children}
                </div>
            </main>
            <ToastContainer />
        </>
    );
}
