'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useMalvinas, getOperacionColor } from '../../context/MalvinasContext';
import { Search, TrendingUp, FileDown, FileSpreadsheet } from 'lucide-react';
import { exportToExcel, exportToPDF } from '../../utils/export';
import TableSkeleton from '../../components/TableSkeleton';

export default function CambiosEntradaPage() {
    const { state, refreshHistorialEntradas } = useMalvinas();
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    // Cargar datos al montar el componente
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await refreshHistorialEntradas();
            setLoading(false);
        };
        loadData();
    }, [refreshHistorialEntradas]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return state.cambiosEntrada.filter(
            c => c.producto.toLowerCase().includes(q) || c.operacion.toLowerCase().includes(q)
        );
    }, [state.cambiosEntrada, search]);

    const total = filtered.length;

    const handleExportExcel = () => {
        const columns = [
            { header: 'Fecha Original', key: 'fecha' },
            { header: 'Producto', key: 'producto' },
            { header: 'Operación', key: 'operacion' },
            { header: 'Almacén Salida', key: 'almacenSalida' },
            { header: 'Almacén Ingreso', key: 'almacenIngreso' },
            { header: 'Operador', key: 'operador' },
            { header: 'Cantidad', key: 'cantidad' },
            { header: 'Unidad Medida', key: 'unidadMedida' },
            { header: 'Entregado Por', key: 'entregado' },
            { header: 'Registrado Por', key: 'registradoPor' },
            { header: 'Observaciones', key: 'observaciones' },
            { header: 'Motivo', key: 'motivoCambio' },
            { header: 'Fecha Cambio', key: 'updatedAt' },
        ];
        exportToExcel(filtered, columns, `Cambios_Entrada_${new Date().toISOString().split('T')[0]}`);
    };

    const handleExportPDF = () => {
        const columns = [
            { header: 'Fecha Original', dataKey: 'fecha' },
            { header: 'Producto', dataKey: 'producto' },
            { header: 'Operación', dataKey: 'operacion' },
            { header: 'Almacén Salida', dataKey: 'almacenSalida' },
            { header: 'Almacén Ingreso', dataKey: 'almacenIngreso' },
            { header: 'Operador', dataKey: 'operador' },
            { header: 'Cantidad', dataKey: 'cantidad' },
            { header: 'Unidad Medida', dataKey: 'unidadMedida' },
            { header: 'Entregado Por', dataKey: 'entregado' },
            { header: 'Registrado Por', dataKey: 'registradoPor' },
            { header: 'Observaciones', dataKey: 'observaciones' },
            { header: 'Motivo', dataKey: 'motivoCambio' },
            { header: 'Fecha Cambio', dataKey: 'updatedAt' },
        ];
        exportToPDF(filtered, columns, `Cambios_Entrada_${new Date().toISOString().split('T')[0]}`, 'Cambios de Entrada');
    };

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
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleExportPDF}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all duration-300 shadow-md text-[10px] bg-red-600 hover:bg-red-700 text-white hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
                                >
                                    <FileDown className="w-3.5 h-3.5" />
                                    <span>Descargar PDF</span>
                                </button>
                                <button
                                    onClick={handleExportExcel}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all duration-300 shadow-md text-[10px] bg-green-600 hover:bg-green-700 text-white hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
                                >
                                    <FileSpreadsheet className="w-3.5 h-3.5" />
                                    <span>Exportar Excel</span>
                                </button>
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
                                    onChange={e => { setSearch(e.target.value); }}
                                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-[#002D5A] outline-none transition-all shadow-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Table card */}
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xl">
                        <div className="overflow-x-auto" style={{ width: '100%' }}>
                            <table className="w-full text-sm text-left" style={{ minWidth: 1600 }}>
                                <thead className="text-[9px] uppercase font-bold tracking-wider">
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
                                    {loading ? (
                                        <TableSkeleton rows={10} cols={13} />
                                    ) : filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={13} className="px-4 py-20 text-center">
                                                <div className="flex flex-col items-center justify-center opacity-40">
                                                    <Search className="w-12 h-12 mb-4" />
                                                    <p className="font-black text-gray-900 tracking-tight uppercase italic text-sm">No hay cambios registrados aún.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filtered.map((c, i) => (
                                            <tr key={`${c.id}-${i}`} className="hover:bg-blue-50/30 transition-colors">
                                                <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap uppercase">{c.fecha}</td>
                                                <td className="px-4 py-3 font-semibold text-gray-800 text-[11px] uppercase tracking-tight">{c.producto}</td>
                                                <td className="px-4 py-3">
                                                    {(() => {
                                                        const colors = getOperacionColor(c.operacion);
                                                        return (
                                                            <span className={`px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} text-[9px] font-bold uppercase tracking-wider`}>
                                                                {c.operacion}
                                                            </span>
                                                        );
                                                    })()}
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
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
