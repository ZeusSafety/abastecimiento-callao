'use client';

import React from 'react';
import { Building2, AlertTriangle } from 'lucide-react';
import {
    TIENDAS,
    etiquetaTiendaMovimientosCallao,
    type Producto,
} from '../context/CallaoContext';

type Props = {
    producto: Producto;
    /** Título del bloque (por defecto coincide con los modales actuales) */
    titulo?: string;
};

/**
 * Tarjetas KPI de existencia por tienda (modales Entrada / Salida / Traslado).
 */
export function ExistenciaAlmacenCards({ producto, titulo = 'Existencia Almacén' }: Props) {
    return (
        <div className="col-span-2">
            <div className="flex flex-wrap items-end justify-between gap-2 mb-2.5">
                <label className="form-label mb-0">{titulo}</label>
                <span
                    className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400"
                    style={{ fontFamily: 'var(--font-poppins, system-ui, sans-serif)' }}
                >
                    Vista consolidada
                </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {TIENDAS.map(tienda => {
                    const existencia = producto.existencia[tienda] || 0;
                    const stockMinimo = producto.stockMinimo[tienda] || 0;
                    const bajoStock = existencia < stockMinimo && stockMinimo > 0;
                    const label = etiquetaTiendaMovimientosCallao(tienda);

                    return (
                        <div
                            key={tienda}
                            className={[
                                'group relative overflow-hidden rounded-xl border bg-white transition-all duration-200',
                                'shadow-[0_1px_2px_rgba(15,23,42,0.06),0_6px_16px_-4px_rgba(15,23,42,0.08)]',
                                'hover:shadow-[0_2px_4px_rgba(15,23,42,0.06),0_10px_24px_-6px_rgba(0,45,90,0.12)] hover:border-[#002D5A]/20',
                                bajoStock
                                    ? 'border-red-200/90 ring-1 ring-red-100/80'
                                    : 'border-slate-200/90',
                            ].join(' ')}
                        >
                            <div
                                className={
                                    bajoStock
                                        ? 'absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-red-500 to-red-600'
                                        : 'absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-[#002D5A] to-[#1e4a7a]'
                                }
                                aria-hidden
                            />
                            <div className="pl-4 pr-3 py-3.5">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <span
                                        className="text-[10px] font-bold uppercase leading-snug text-slate-500 tracking-wide"
                                        style={{ fontFamily: 'var(--font-poppins, system-ui, sans-serif)' }}
                                    >
                                        {label}
                                    </span>
                                    {bajoStock ? (
                                        <AlertTriangle
                                            className="w-4 h-4 shrink-0 text-red-500"
                                            strokeWidth={2}
                                            aria-hidden
                                        />
                                    ) : (
                                        <Building2
                                            className="w-4 h-4 shrink-0 text-slate-300 transition-colors group-hover:text-[#002D5A]/35"
                                            strokeWidth={1.75}
                                            aria-hidden
                                        />
                                    )}
                                </div>
                                <div
                                    className={[
                                        'text-[1.65rem] leading-none font-bold tabular-nums tracking-tight',
                                        bajoStock ? 'text-red-700' : 'text-[#002D5A]',
                                    ].join(' ')}
                                    style={{ fontFamily: 'var(--font-poppins, system-ui, sans-serif)' }}
                                >
                                    {existencia}
                                </div>
                                {stockMinimo > 0 && (
                                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                                        <span className="text-[9px] font-medium uppercase tracking-wide text-slate-400">
                                            Mínimo
                                        </span>
                                        <span
                                            className={`text-[11px] font-bold tabular-nums ${
                                                bajoStock ? 'text-red-600' : 'text-slate-600'
                                            }`}
                                        >
                                            {stockMinimo}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
