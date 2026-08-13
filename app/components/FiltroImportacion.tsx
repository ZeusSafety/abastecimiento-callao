'use client';

import { Ship } from 'lucide-react';

export const ORIGEN_IMPORTACION = 'IMPORTACION';

/** ¿El almacén de salida ("Salió de") del movimiento es IMPORTACION? */
export function esOrigenImportacion(almacenSalida?: string | null): boolean {
    return (almacenSalida || '').trim().toUpperCase() === ORIGEN_IMPORTACION;
}

/** Botón de filtro para mostrar solo los movimientos que salieron de IMPORTACION. */
export function FiltroImportacion({ activo, onToggle }: { activo: boolean; onToggle: () => void }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-pressed={activo}
            title={
                activo
                    ? 'Mostrando solo movimientos que salieron de IMPORTACION'
                    : 'Mostrar solo movimientos que salieron de IMPORTACION'
            }
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-bold whitespace-nowrap border transition-all shadow-sm ${
                activo
                    ? 'bg-[#002D5A] border-[#002D5A] text-white hover:bg-[#001F3D]'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:text-[#002D5A]'
            }`}
        >
            <Ship className="w-4 h-4" />
            <span>IMPORTACION</span>
        </button>
    );
}
