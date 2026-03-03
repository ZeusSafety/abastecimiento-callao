import type { Metadata } from 'next';
import { MalvinasProvider } from '../context/MalvinasContext';
import AppLayout from '../components/AppLayout';

export const metadata: Metadata = {
    title: 'Sistema Malvinas | Zeus Safety',
    description: 'Sistema de gestión de entradas, salidas y abastecimiento del Almacén Malvinas - Zeus Safety',
};

export default function MalvinasLayout({ children }: { children: React.ReactNode }) {
    return (
        <MalvinasProvider>
            <AppLayout>
                {children}
            </AppLayout>
        </MalvinasProvider>
    );
}
