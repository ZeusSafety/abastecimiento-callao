'use client';

import React, { useMemo, useState } from 'react';
import { useMalvinas, TIENDAS, Tienda } from '../context/MalvinasContext';
import { Search, RefreshCw, TrendingUp, Package, AlertTriangle, Building, Box, Columns2 } from 'lucide-react';

function StockBadge({ value, min }: { value: number; min: number }) {
    if (value === 0) return <span className="value-zero">0</span>;
    if (value < min) return <span className="value-negative">{value}</span>;
    return <span className="value-positive">{value}</span>;
}

export default function StockTotalPage() {
    const { state } = useMalvinas();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const PER_PAGE = 20;

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return state.productos.filter(
            p => p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)
        );
    }, [state.productos, search]);

    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    // Stats cards
    const totalProductos = state.productos.length;
    const entradas = state.entradas.length;
    const salidas = state.salidas.length;
    const alertas = state.productos.filter(p =>
        TIENDAS.some(t => p.existencia[t] < p.stockMinimo[t])
    ).length;

    const stats = [
        { label: 'Productos', value: totalProductos, icon: Package, color: '#002D5A', bg: '#E9F1FF' },
        { label: 'Entradas', value: entradas, icon: TrendingUp, color: '#1e40af', bg: '#dbeafe' },
        { label: 'Salidas', value: salidas, icon: TrendingUp, color: '#9d174d', bg: '#fce7f3' },
        { label: 'Stock Bajo', value: alertas, icon: AlertTriangle, color: '#92400e', bg: '#fffbeb' },
    ];

    return (
        <div id="view-malvinas" className="animate-in fade-in duration-500 font-poppins">
            <div className="container mx-auto">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6 transition-all">
                    {/* Header Principal */}
                    <header className="flex justify-between items-center flex-wrap gap-4 mb-8">
                        <div className="flex items-center space-x-3">
                            <div className="w-11 h-11 bg-gradient-to-br from-[#002D5A] to-[#0056b3] rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-900/10 transition-transform hover:scale-110">
                                <Building className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="font-bold text-gray-900 m-0 tracking-tight" style={{ fontSize: '18px' }}>
                                    Inventario Malvinas
                                </h1>
                                <p className="text-[11px] text-gray-400 mt-0.5 font-medium italic opacity-80">Vista general del stock y gestión por tienda</p>
                            </div>
                        </div>
                    </header>

                    {/* Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {stats.map(s => {
                            const Icon = s.icon;
                            return (
                                <div key={s.label} className="bg-white p-4 rounded-xl border border-gray-100 hover:shadow-md transition-all duration-300 group flex items-center gap-3">
                                    <div
                                        className="flex items-center justify-center rounded-lg transition-all group-hover:scale-110 shadow-sm"
                                        style={{ width: 40, height: 40, background: s.bg }}
                                    >
                                        <Icon className="w-5 h-5" style={{ color: s.color }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                                        <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Toolbar - Moved out of table card for better accessibility */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6 border-b border-gray-100 bg-transparent">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-100 rounded-xl shadow-sm">
                                <Search className="w-5 h-5 text-[#002D5A]" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 m-0" style={{ fontSize: 16 }}>
                                    Inventario Detallado
                                </h3>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Control de Stock en Tiempo Real</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-72">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar código o nombre..."
                                    value={search}
                                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                                    className="w-full pl-12 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-50 focus:border-[#002D5A] outline-none transition-all shadow-sm"
                                />
                            </div>
                            <button
                                onClick={() => setSearch('')}
                                className="px-5 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 hover:text-[#002D5A] transition-all flex items-center gap-2 shadow-sm active:scale-95"
                            >
                                <RefreshCw className="w-4 h-4" />
                                <span className="hidden sm:inline uppercase tracking-wider text-[10px]">Limpiar</span>
                            </button>
                        </div>
                    </div>

                    {/* Table card */}
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xl mt-2">
                        {/* Table */}

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-[10px] uppercase font-bold tracking-wider">
                                    <tr className="bg-[#002D5A] text-white">
                                        <th rowSpan={2} className="px-4 py-3 border-r border-[#ffffff20]">Código</th>
                                        <th rowSpan={2} className="px-4 py-3 border-r border-[#ffffff20] min-w-[200px]">Producto</th>
                                        <th rowSpan={2} className="px-4 py-3 border-r border-[#ffffff20] text-center">Cant.</th>
                                        <th colSpan={4} className="px-4 py-2 border-r border-[#ffffff20] text-center bg-[#1a4a7a]">
                                            Stock Mínimo
                                        </th>
                                        <th rowSpan={2} className="px-4 py-3 border-r border-[#ffffff20] text-center">Stock Global</th>
                                        <th rowSpan={2} className="px-4 py-3 border-r border-[#ffffff20] text-center">U. Medida</th>
                                        <th colSpan={4} className="px-4 py-2 border-r border-[#ffffff20] text-center bg-[#1a4a7a]">
                                            Existencia Almacén
                                        </th>
                                        <th rowSpan={2} className="px-4 py-3 border-r border-[#ffffff20] text-center bg-[#001F3D]">Disponibles</th>
                                        <th colSpan={3} className="px-4 py-2 text-center bg-[#1a4a7a]">Stock Detallado</th>
                                    </tr>
                                    <tr className="bg-[#1a4a7a] text-white border-t border-[#ffffff20]">
                                        {TIENDAS.map(t => (
                                            <th key={`min-${t}`} className="px-2 py-2 border-r border-[#ffffff20] text-center text-[9px]">
                                                {t.replace('TIENDA ', '')}
                                            </th>
                                        ))}
                                        {TIENDAS.map(t => (
                                            <th key={`ex-${t}`} className="px-2 py-2 border-r border-[#ffffff20] text-center text-[9px]">
                                                {t.replace('TIENDA ', '')}
                                            </th>
                                        ))}
                                        <th className="px-2 py-2 border-r border-[#ffffff20] text-center">Cajas</th>
                                        <th className="px-2 py-2 border-r border-[#ffffff20] text-center">Med.</th>
                                        <th className="px-2 py-2 text-center">U.Med</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {paginated.map(p => {
                                        const stockGlobalMin = TIENDAS.reduce((acc, t) => acc + p.stockMinimo[t], 0);
                                        const disponibles = TIENDAS.reduce((acc, t) => acc + p.existencia[t], 0);
                                        const cajas = Math.floor(disponibles / p.cantidadRegCalculo);
                                        const medida = (cajas * p.cantidadRegCalculo) - disponibles;
                                        return (
                                            <tr key={p.id} className="hover:bg-blue-50/30 transition-colors">
                                                <td className="px-4 py-3 font-bold text-[#002D5A] text-[11px]">{p.codigo}</td>
                                                <td className="px-4 py-3 font-medium text-gray-700 text-[11px] uppercase tracking-tight">{p.nombre}</td>
                                                <td className="px-4 py-3 text-center font-bold text-gray-800 text-[11px]">{p.cantidadRegCalculo}</td>
                                                {TIENDAS.map(t => (
                                                    <td key={`min-${t}`} className="px-2 py-3 text-center text-gray-400 text-[11px]">
                                                        {p.stockMinimo[t] > 0 ? p.stockMinimo[t] : '-'}
                                                    </td>
                                                ))}
                                                <td className="px-4 py-3 text-center font-bold text-[11px]">{stockGlobalMin}</td>
                                                <td className="px-4 py-3 text-center text-[11px]">
                                                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[9px] font-bold">
                                                        {p.unidadMedidaRegCalculo}
                                                    </span>
                                                </td>
                                                {TIENDAS.map(t => (
                                                    <td key={`ex-${t}`} className="px-2 py-3 text-center text-[11px]">
                                                        <StockBadge value={p.existencia[t]} min={p.stockMinimo[t]} />
                                                    </td>
                                                ))}
                                                <td className="px-4 py-3 text-center font-extrabold text-[#002D5A] bg-blue-50/50 text-[11px]">{disponibles}</td>
                                                <td className="px-4 py-3 text-center font-bold text-[11px]">{cajas}</td>
                                                <td className="px-4 py-3 text-center font-bold text-[11px]" style={{ color: medida < 0 ? '#dc2626' : '#22c55e' }}>
                                                    {Math.abs(medida)}
                                                </td>
                                                <td className="px-4 py-3 text-center text-[9px] text-gray-400 font-medium whitespace-nowrap uppercase">
                                                    {p.unidadMedidaRegCalculo}
                                                </td>
                                            </tr>
                                        );
                                    })}
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
