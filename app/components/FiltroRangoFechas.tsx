'use client';

import { Calendar, X } from 'lucide-react';

interface FiltroRangoFechasProps {
    fechaInicio: string;
    fechaFin: string;
    onChange: (inicio: string, fin: string) => void;
}

/** Filtro visual de rango (inicio / fin) para las barras de listado. */
export function FiltroRangoFechas({ fechaInicio, fechaFin, onChange }: FiltroRangoFechasProps) {
    const activo = Boolean(fechaInicio || fechaFin);

    return (
        <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border shadow-sm whitespace-nowrap ${
                activo
                    ? 'bg-blue-50/80 border-[#002D5A]/30'
                    : 'bg-white border-gray-200'
            }`}
            title="Filtrar el listado por fecha de movimiento"
        >
            <Calendar className={`w-4 h-4 flex-shrink-0 ${activo ? 'text-[#002D5A]' : 'text-gray-400'}`} />
            <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                Inicio
                <input
                    type="date"
                    value={fechaInicio}
                    max={fechaFin || undefined}
                    onChange={e => onChange(e.target.value, fechaFin)}
                    className="text-[12px] font-semibold text-gray-800 bg-transparent border-0 outline-none cursor-pointer uppercase"
                />
            </label>
            <span className="text-gray-300 text-xs">—</span>
            <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                Fin
                <input
                    type="date"
                    value={fechaFin}
                    min={fechaInicio || undefined}
                    onChange={e => onChange(fechaInicio, e.target.value)}
                    className="text-[12px] font-semibold text-gray-800 bg-transparent border-0 outline-none cursor-pointer uppercase"
                />
            </label>
            {activo && (
                <button
                    type="button"
                    onClick={() => onChange('', '')}
                    title="Quitar filtro de fechas"
                    className="p-1 rounded-lg text-gray-400 hover:text-[#002D5A] hover:bg-white transition-colors"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
}
