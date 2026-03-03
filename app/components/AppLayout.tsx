'use client';

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import ToastContainer from './ToastContainer';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(true);

    return (
        <>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <main
                className="flex flex-col min-h-screen transition-all duration-300"
                style={{ marginLeft: sidebarOpen ? '240px' : '0' }}
            >
                <Header
                    onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                    sidebarOpen={sidebarOpen}
                />
                <div className="flex-1 overflow-auto" style={{ padding: '24px', background: '#f4f6fa' }}>
                    {children}
                </div>
            </main>
            <ToastContainer />
        </>
    );
}
