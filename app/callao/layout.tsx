import type { Metadata } from 'next';
import { CallaoProvider } from '../context/CallaoContext';
import AppLayout from '../components/AppLayout';

export const metadata: Metadata = {
    title: 'Sistema Callao | Zeus Safety',
    description: 'Sistema de gestión de entradas, salidas y abastecimiento del Almacén Callao - Zeus Safety',
};

export default function CallaoLayout({ children }: { children: React.ReactNode }) {
    return (
        <CallaoProvider>
            <AppLayout>
                {children}
            </AppLayout>
        </CallaoProvider>
    );
}
