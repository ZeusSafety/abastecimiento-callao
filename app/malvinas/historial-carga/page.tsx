'use client';

import React, { useState, useMemo } from 'react';
import { useMalvinas, TIENDAS } from '../../context/MalvinasContext';
import { Search, RefreshCw, Package, Columns2, AlertTriangle } from 'lucide-react';

export default function HistorialCargaPage() {
    const { state } = useMalvinas();
    const [selectedId, setSelectedId] = useState<string>('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const PER_PAGE = 20;

    const selectedHistorial = useMemo(
        () => state.historialAbastecimiento.find(h => h.id === selectedId),
        [state.historialAbastecimiento, selectedId]
    );

    const filtered = useMemo(() => {
        if (!selectedHistorial) return [];
        const q = search.toLowerCase();
        return selectedHistorial.items.filter(
            r => r.nombre.toLowerCase().includes(q) || r.codigo.toLowerCase().includes(q)
        );
    }, [selectedHistorial, search]);

    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    return (
        <div id="view-historial-carga" className="animate-in fade-in duration-500 font-poppins text-[#002D5A]">
            <div className="container mx-auto">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-8 transition-all">
                    {/* Header Principal */}
                    <header className="flex justify-between items-center flex-wrap gap-4 mb-8">
                        <div className="flex items-center space-x-3">
                            <div className="w-11 h-11 bg-gradient-to-br from-[#002D5A] to-[#0056b3] rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-900/10 transition-transform hover:scale-110">
                                <Columns2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="font-bold text-gray-900 m-0 tracking-tight" style={{ fontSize: '18px' }}>
                                    Historial de Carga
                                </h1>
                                <p className="text-[11px] text-gray-400 mt-0.5 font-medium italic opacity-80">Revisión detallada de abastecimientos almacenados</p>
                            </div>
                        </div>
                    </header>

                    {/* Selector de carga Premium */}
                    <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100 mb-8 shadow-inner">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-1">
                                <label className="block text-[10px] font-black text-[#002D5A] uppercase tracking-widest mb-2 opacity-60">Seleccionar Abastecimiento</label>
                                <div className="relative">
                                    <select
                                        value={selectedId}
                                        onChange={e => { setSelectedId(e.target.value); setPage(1); setSearch(''); }}
                                        className="w-full pl-4 pr-10 py-3 bg-gray-100/60 border border-gray-200/70 rounded-xl font-bold text-sm text-[#002D5A] focus:ring-4 focus:ring-blue-50 focus:border-[#002D5A] outline-none transition-all appearance-none cursor-pointer shadow-sm"
                                    >
                                        <option value="">Seleccione un Reporte</option>
                                        {state.historialAbastecimiento.map(h => (
                                            <option key={h.id} value={h.id}>{h.nombre}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <Search className="w-4 h-4 text-gray-400" />
                                    </div>
                                </div>
                            </div>

                            {selectedHistorial && (
                                <>
                                    <div className="animate-in slide-in-from-left-4 duration-300">
                                        <label className="block text-[10px] font-black text-[#002D5A] uppercase tracking-widest mb-2 opacity-60">Fecha de Registro</label>
                                        <div className="bg-white px-4 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 shadow-sm flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                            {selectedHistorial.fecha}
                                        </div>
                                    </div>
                                    <div className="animate-in slide-in-from-left-8 duration-400">
                                        <label className="block text-[10px] font-black text-[#002D5A] uppercase tracking-widest mb-2 opacity-60">Registrado Por</label>
                                        <div className="bg-white px-4 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 shadow-sm flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] text-[#002D5A]">
                                                {selectedHistorial.registradoPor.charAt(0).toUpperCase()}
                                            </div>
                                            {selectedHistorial.registradoPor}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {selectedHistorial ? (
                        <div className="animate-in fade-in zoom-in-95 duration-500">
                            {/* Toolbar - Fuera del contenedor de la tabla */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6 mb-4 bg-transparent">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-[#002D5A] rounded-xl shadow-lg shadow-blue-900/20">
                                        <Package className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <span className="block font-black text-gray-900 text-base leading-none uppercase tracking-tight">
                                            {selectedHistorial.nombre}
                                        </span>
                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1 block">
                                            {total} productos registrados
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <div className="relative flex-1 sm:w-64">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Filtrar por código o nombre..."
                                            value={search}
                                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                                            className="w-full pl-12 pr-4 py-2.5 text-xs bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-50 focus:border-[#002D5A] outline-none transition-all shadow-sm font-medium"
                                        />
                                    </div>
                                    <button onClick={() => setSearch('')} className="p-2.5 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 transition-all active:scale-95 shadow-sm text-gray-500">
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Table card */}
                            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xl">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-[10px] uppercase font-bold tracking-wider">
                                            <tr className="bg-[#002D5A] text-white">
                                                <th className="px-5 py-4 border-r border-[#ffffff1a] whitespace-nowrap">Código</th>
                                                <th className="px-5 py-4 border-r border-[#ffffff1a] min-w-[200px]">Producto</th>
                                                <th className="px-5 py-4 border-r border-[#ffffff1a] text-center">Cant.</th>
                                                <th className="px-5 py-4 border-r border-[#ffffff1a]">U. Medida</th>
                                                {TIENDAS.map(t => (
                                                    <th key={t} className="px-2 py-4 text-center border-r border-[#ffffff1a]">{t}</th>
                                                ))}
                                                <th className="px-5 py-4 border-l border-[#ffffff1a] text-center">Cajas</th>
                                                <th className="px-5 py-4 text-center">Envío</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {paginated.map(r => (
                                                <tr key={r.productoId} className="hover:bg-blue-50/40 transition-colors group">
                                                    <td className="px-5 py-3 font-bold text-[#002D5A] border-r border-gray-50/50 text-[11px] uppercase">{r.codigo}</td>
                                                    <td className="px-5 py-3 font-semibold text-gray-800 border-r border-gray-50/50 text-[11px] uppercase tracking-tight">{r.nombre}</td>
                                                    <td className="px-5 py-3 text-center font-mono font-bold text-gray-600 border-r border-gray-50/50 text-[11px]">{r.cantidad}</td>
                                                    <td className="px-5 py-3 border-r border-gray-50/50">
                                                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#002D5A] text-[9px] font-black uppercase tracking-tighter">
                                                            {r.unidadMedida}
                                                        </span>
                                                    </td>
                                                    {TIENDAS.map(t => (
                                                        <td key={t} className="px-2 py-3 text-center border-r border-gray-50/50">
                                                            <span className={`font-bold text-[10px] ${r.tiendas[t] < 0 ? 'text-red-500' : r.tiendas[t] === 0 ? 'text-gray-300' : 'text-emerald-600'}`}>
                                                                {r.tiendas[t]}
                                                            </span>
                                                        </td>
                                                    ))}
                                                    <td className="px-5 py-3 text-center font-black text-[#002D5A] bg-blue-50/20 border-l border-gray-50 text-[13px]">
                                                        {r.abastecerCajas}
                                                    </td>
                                                    <td className="px-5 py-3 text-center">
                                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest transition-all ${r.enviar === 'SI'
                                                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                                                            : 'bg-gray-100 text-gray-400 opacity-60'
                                                            }`}>
                                                            {r.enviar}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {paginated.length === 0 && (
                                                <tr>
                                                    <td colSpan={7 + TIENDAS.length} className="px-6 py-20 text-center">
                                                        <div className="flex flex-col items-center justify-center opacity-40">
                                                            <Search className="w-12 h-12 mb-4" />
                                                            <p className="font-black text-gray-900 tracking-tight uppercase italic text-sm">No se encontraron productos.</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination Premium New Style */}
                                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setPage(1)}
                                            disabled={page === 1}
                                            className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                        >
                                            «
                                        </button>
                                        <button
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                            className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                        >
                                            ‹
                                        </button>
                                    </div>

                                    <div className="flex flex-col items-center">
                                        <span className="text-[11px] text-gray-700 font-bold uppercase tracking-widest">
                                            Página {page} de {pages}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setPage(p => Math.min(pages, p + 1))}
                                            disabled={page === pages}
                                            className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                        >
                                            ›
                                        </button>
                                        <button
                                            onClick={() => setPage(pages)}
                                            disabled={page === pages}
                                            className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                        >
                                            »
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-3xl p-20 text-center border-2 border-dashed border-gray-100 group hover:border-blue-100 transition-all">
                            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                                <Search className="w-10 h-10 text-blue-200" />
                            </div>
                            <h3 className="text-xl font-black text-gray-900 mb-2">Consulta un Reporte</h3>
                            <p className="text-sm font-medium text-gray-400 max-w-sm mx-auto leading-relaxed">
                                Selecciona uno de los abastecimientos guardados en el menú superior para ver el desglose completo de productos.
                            </p>
                            {state.historialAbastecimiento.length === 0 && (
                                <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                                    <AlertTriangle className="w-4 h-4" />
                                    No hay reportes disponibles
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
