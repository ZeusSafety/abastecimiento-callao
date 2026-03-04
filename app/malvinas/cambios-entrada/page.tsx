'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useMalvinas } from '../../context/MalvinasContext';
import { Search, TrendingUp } from 'lucide-react';

export default function CambiosEntradaPage() {
    const { state, refreshHistorialEntradas } = useMalvinas();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const PER_PAGE = 20;

    // Cargar datos al montar el componente
    useEffect(() => {
        refreshHistorialEntradas();
    }, [refreshHistorialEntradas]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return state.cambiosEntrada.filter(
            c => c.producto.toLowerCase().includes(q) || c.operacion.toLowerCase().includes(q)
        );
    }, [state.cambiosEntrada, search]);

    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    return (
        <div id="view-cambios-entrada" className="animate-in fade-in duration-500 font-poppins">
            <div className="container mx-auto">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6 transition-all">
                    {/* Header Principal */}
                    <header className="flex justify-between items-center flex-wrap gap-4 mb-8">
                        <div className="flex items-center space-x-3">
                            <div className="w-11 h-11 bg-gradient-to-br from-[#002D5A] to-[#0056b3] rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-900/10 transition-transform hover:scale-110">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="font-bold text-gray-900 m-0 tracking-tight" style={{ fontSize: '18px' }}>
                                    Cambios de Entrada
                                </h1>
                                <p className="text-[11px] text-gray-400 mt-0.5 font-medium italic opacity-80">
                                    Historial de todos los registros de entradas que fueron modificados
                                </p>
                            </div>
                        </div>
                    </header>

                    {/* Toolbar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 mb-2 bg-transparent">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <Search className="w-4 h-4 text-[#002D5A]" />
                            </div>
                            <span className="font-bold text-gray-800" style={{ fontSize: 13 }}>
                                Total: {total} registros
                            </span>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-72">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar..."
                                    value={search}
                                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-[#002D5A] outline-none transition-all shadow-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Table card */}
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xl">
                        <div className="overflow-x-auto" style={{ width: '100%' }}>
                            <table className="w-full text-sm text-left" style={{ minWidth: 1600 }}>
                                <thead className="text-[10px] uppercase font-bold tracking-wider">
                                    <tr className="bg-[#002D5A] text-white">
                                        <th className="px-4 py-4 whitespace-nowrap">Fecha Original</th>
                                        <th className="px-4 py-4">Producto</th>
                                        <th className="px-4 py-4">Operación</th>
                                        <th className="px-4 py-4">Almacén Salida</th>
                                        <th className="px-4 py-4">Almacén Ingreso</th>
                                        <th className="px-4 py-4">Operador</th>
                                        <th className="px-4 py-4 text-center">Cant.</th>
                                        <th className="px-4 py-4">U. Medida</th>
                                        <th className="px-4 py-4">Entregado Por</th>
                                        <th className="px-4 py-4">Registrado Por</th>
                                        <th className="px-4 py-4">Observaciones</th>
                                        <th className="px-4 py-4">Motivo</th>
                                        <th className="px-4 py-4 whitespace-nowrap">Fecha Cambio</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {paginated.map((c, i) => (
                                        <tr key={`${c.id}-${i}`} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap uppercase">{c.fecha}</td>
                                            <td className="px-4 py-3 font-semibold text-gray-800 text-[11px] uppercase tracking-tight">{c.producto}</td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#002D5A] text-[9px] font-bold uppercase tracking-wider">
                                                    {c.operacion}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-[11px] text-gray-600 uppercase italic">{c.almacenSalida}</td>
                                            <td className="px-4 py-3 text-[11px] text-gray-600 uppercase italic">{c.almacenIngreso}</td>
                                            <td className="px-4 py-3 text-[11px] text-gray-600 uppercase">{c.operador}</td>
                                            <td className="px-4 py-3 text-center font-bold text-gray-900 text-[11px]">{c.cantidad}</td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[9px] font-bold uppercase">
                                                    {c.unidadMedida}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-[11px] text-gray-600 uppercase">{c.entregado}</td>
                                            <td className="px-4 py-3 text-[11px] text-gray-600 uppercase">{c.registradoPor}</td>
                                            <td className="px-4 py-3 text-[10px] text-gray-400 italic max-w-[150px] truncate">{c.observaciones || '-'}</td>
                                            <td className="px-4 py-3 text-[11px] text-amber-700 font-medium italic uppercase tracking-tight">{c.motivoCambio}</td>
                                            <td className="px-4 py-3 text-[10px] text-gray-300 whitespace-nowrap">{c.updatedAt}</td>
                                        </tr>
                                    ))}
                                    {paginated.length === 0 && (
                                        <tr>
                                            <td colSpan={13} className="px-4 py-20 text-center">
                                                <div className="flex flex-col items-center justify-center opacity-40">
                                                    <Search className="w-12 h-12 mb-4" />
                                                    <p className="font-black text-gray-900 tracking-tight uppercase italic text-sm">No hay cambios registrados aún.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(1)}
                                    disabled={page === 1}
                                    className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                    style={{ fontFamily: 'var(--font-poppins)' }}
                                >
                                    «
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                    style={{ fontFamily: 'var(--font-poppins)' }}
                                >
                                    ‹
                                </button>
                            </div>

                            <div className="flex flex-col items-center">
                                <span className="text-[11px] text-gray-700 font-bold uppercase tracking-widest" style={{ fontFamily: 'var(--font-poppins)' }}>
                                    Página {page} de {pages}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.min(pages, p + 1))}
                                    disabled={page === pages}
                                    className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                    style={{ fontFamily: 'var(--font-poppins)' }}
                                >
                                    ›
                                </button>
                                <button
                                    onClick={() => setPage(pages)}
                                    disabled={page === pages}
                                    className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                    style={{ fontFamily: 'var(--font-poppins)' }}
                                >
                                    »
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
