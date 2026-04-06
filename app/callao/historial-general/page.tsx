'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useCallao, TIENDAS_VISTA_INVENTARIO_CALLAO, UnidadMedida } from '../../context/CallaoContext';
import { Search } from 'lucide-react';
import TableSkeleton from '../../components/TableSkeleton';
import * as api from '../../services/api';

interface HistorialGeneralRow {
    productoId: string;
    codigo: string;
    nombre: string;
    cantidad: number;
    unidadMedida: UnidadMedida;
    tiendas: Record<string, number>;
    abastecerCajas: number;
    enviar: 'SI' | 'NO';
    nombreAbastecimiento: string;
    fechaHora: string;
    registradoPor: string;
}

export default function HistorialGeneralPage() {
    const { state } = useCallao();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [allRows, setAllRows] = useState<HistorialGeneralRow[]>([]);
    const PER_PAGE = 40;

    // Cargar todos los registros del historial general al montar
    useEffect(() => {
        const cargarHistorialGeneral = async () => {
            setLoading(true);
            try {
                const historialData = await api.getHistorialAbastecimientoGeneral();
                
                // Crear mapa de productos por código
                const productosMap = new Map(state.productos.map(p => [p.codigo, p]));
                
                // Convertir datos de la API al formato del frontend
                const rows: HistorialGeneralRow[] = historialData.map((item: any) => {
                    const producto = productosMap.get(item.codigo);
                    return {
                        productoId: producto?.id || '',
                        codigo: item.codigo,
                        nombre: item.nombre,
                        cantidad: item.cantidad,
                        unidadMedida: item.unidad_medida as UnidadMedida,
                        tiendas: {
                            'TIENDA OFICINA': item.cant_almacen_oficina ?? 0,
                            'TIENDA CALLAO-1': item.cant_almacen_callao_1 ?? 0,
                            'TIENDA CALLAO-2': item.cant_almacen_callao_2 ?? 0,
                        },
                        abastecerCajas: item.abastecer_cajas || 0,
                        enviar: item.enviar as 'SI' | 'NO',
                        nombreAbastecimiento: item.nombre_abastecimiento,
                        fechaHora: item.fecha_registro ? new Date(item.fecha_registro).toLocaleString('es-PE') : '',
                        registradoPor: item.registrado_por || '',
                    };
                });
                
                setAllRows(rows);
            } catch (error: any) {
                console.error('Error cargando historial general:', error);
            } finally {
                setLoading(false);
            }
        };

        if (state.productos.length > 0) {
            cargarHistorialGeneral();
        } else {
            setLoading(false);
        }
    }, [state.productos]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return allRows.filter(r => {
            const matchSearch = r.nombre.toLowerCase().includes(q) || r.codigo.toLowerCase().includes(q);
            return matchSearch;
        });
    }, [allRows, search]);

    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    return (
        <div id="view-historial-general" className="animate-in fade-in duration-500 font-poppins">
            <div className="container mx-auto">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-8 transition-all">
                    {/* Header Principal */}
                    <header className="flex justify-between items-center flex-wrap gap-4 mb-8">
                        <div className="flex items-center space-x-3">
                            <div className="w-11 h-11 bg-gradient-to-br from-[#002D5A] to-[#0b3b8c] rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-900/10 transition-transform hover:scale-110">
                                <Search className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="font-bold text-gray-900 m-0 tracking-tight" style={{ fontSize: '18px' }}>
                                    Historial General
                                </h1>
                                <p className="text-[11px] text-gray-400 mt-0.5 font-medium italic opacity-80">Consolidado de todos los movimientos de Callao</p>
                            </div>
                        </div>
                    </header>

                    {/* Toolbar - Moved out of the card table area */}
                    <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100 mb-8 shadow-inner">
                        <div className="flex flex-col lg:flex-row items-end justify-between gap-6">
                            <div className="flex-1 w-full">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-[#002D5A] uppercase tracking-widest opacity-60">Buscar</label>
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Código o producto..."
                                            value={search}
                                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                                            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl font-bold text-sm text-[#002D5A] focus:ring-4 focus:ring-blue-50 focus:border-[#002D5A] outline-none transition-all shadow-sm shadow-inner"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Encontrados</span>
                                <span className="text-3xl font-black text-[#002D5A] leading-none w-full text-center">{total}</span>
                            </div>
                        </div>
                    </div>

                    {/* Table card */}
                    <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-2xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-[9px] uppercase font-bold tracking-wider">
                                    <tr className="bg-[#002D5A] text-white">
                                        <th className="px-5 py-4 border-r border-[#ffffff1a] whitespace-nowrap">Código</th>
                                        <th className="px-5 py-4 border-r border-[#ffffff1a] min-w-[200px]">Producto</th>
                                        <th className="px-5 py-4 border-r border-[#ffffff1a] text-center">Cant.</th>
                                        <th className="px-5 py-4 border-r border-[#ffffff1a]">U.M</th>
                                        {TIENDAS_VISTA_INVENTARIO_CALLAO.map(({ tienda, etiqueta }) => (
                                            <th key={tienda} className="px-2 py-4 text-center border-r border-[#ffffff1a] font-bold">{etiqueta}</th>
                                        ))}
                                        <th className="px-5 py-4 border-l border-[#ffffff1a] text-center">Cajas</th>
                                        <th className="px-5 py-4 text-center">Envío</th>
                                        <th className="px-5 py-4 bg-[#001f3d] border-l border-[#ffffff1a]">Abastecimiento</th>
                                        <th className="px-5 py-4 bg-[#001f3d] whitespace-nowrap">Fecha</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loading ? (
                                        <TableSkeleton rows={5} cols={11} />
                                    ) : paginated.length === 0 ? (
                                        <tr>
                                            <td colSpan={11} className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center justify-center opacity-40">
                                                    <Search className="w-12 h-12 mb-4" />
                                                    <p className="font-black text-gray-900 tracking-tight uppercase italic text-sm">No se encontraron registros</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        paginated.map((r, i) => (
                                        <tr key={`${r.productoId}-${i}`} className="hover:bg-blue-50/40 transition-colors group">
                                            <td className="px-5 py-3 font-bold text-[#002D5A] border-r border-gray-50/50 text-[11px] uppercase">{r.codigo}</td>
                                            <td className="px-5 py-3 font-semibold text-gray-800 border-r border-gray-50/50 text-[11px] uppercase tracking-tight">{r.nombre}</td>
                                            <td className="px-5 py-3 text-center font-mono font-bold text-gray-600 border-r border-gray-50/50 text-[11px]">{r.cantidad}</td>
                                            <td className="px-5 py-3 border-r border-gray-50/50">
                                                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#002D5A] text-[9px] font-black uppercase tracking-tighter">
                                                    {r.unidadMedida}
                                                </span>
                                            </td>
                                            {TIENDAS_VISTA_INVENTARIO_CALLAO.map(({ tienda: t }) => (
                                                <td key={t} className="px-2 py-3 text-center border-r border-gray-50/50">
                                                    <span className={`font-bold text-[10px] ${r.tiendas[t] < 0 ? 'text-red-500' : r.tiendas[t] === 0 ? 'text-gray-300' : 'text-[#002D5A]'}`}>
                                                        {r.tiendas[t]}
                                                    </span>
                                                </td>
                                            ))}
                                            <td className="px-5 py-3 text-center font-black text-[#002D5A] bg-blue-50/20 border-l border-gray-50 text-[13px]">{r.abastecerCajas}</td>
                                            <td className="px-5 py-3 text-center">
                                                <span className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest transition-all ${r.enviar === 'SI'
                                                    ? 'bg-emerald-100 text-emerald-700 shadow-sm'
                                                    : 'bg-red-100 text-red-700 shadow-sm'
                                                    }`}>
                                                    {r.enviar}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 font-bold text-[#002D5A] border-l border-gray-50 text-[11px] uppercase tracking-tight group-hover:text-blue-600 transition-colors">
                                                {r.nombreAbastecimiento}
                                            </td>
                                            <td className="px-5 py-3 text-[9px] text-gray-500 font-medium whitespace-nowrap uppercase">
                                                {r.fechaHora}
                                            </td>
                                        </tr>
                                    ))
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
