'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useMalvinas, getOperacionColor } from '../../context/MalvinasContext';
import { Search, TrendingUp, FileDown, FileSpreadsheet, Eye, Info, X, ChevronDown, ChevronRight, PackageMinus, FileImage } from 'lucide-react';
import { exportToExcel, exportToPDF } from '../../utils/export';

function formatFechaDosLineas(fechaStr: string): { fecha: string; hora: string } {
    if (!fechaStr) return { fecha: '-', hora: '' };
    const raw = fechaStr.trim().replace(/\s+/g, ' ');
    const dateMatch = raw.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.+)$/);
    if (dateMatch) {
        return { fecha: dateMatch[1], hora: dateMatch[2] || '-' };
    }

    let d: Date;
    if (fechaStr.includes('/')) {
        const parts = fechaStr.split(' ');
        const fechaPart = parts[0];
        const horaPart = parts.slice(1).join(' ');
        const [dia, mes, anio] = fechaPart.split('/');
        d = new Date(`${anio}-${mes}-${dia} ${horaPart}`);
    } else {
        d = new Date(fechaStr);
    }
    if (isNaN(d.getTime())) return { fecha: fechaStr, hora: '-' };
    const dia = d.getDate().toString().padStart(2, '0');
    const mes = (d.getMonth() + 1).toString().padStart(2, '0');
    const anio = d.getFullYear();
    let horas = d.getHours();
    const minutos = d.getMinutes().toString().padStart(2, '0');
    const periodo = horas >= 12 ? 'p. m.' : 'a. m.';
    horas = horas % 12 || 12;
    return { fecha: `${dia}/${mes}/${anio}`, hora: `${horas}:${minutos} ${periodo}` };
}

export default function CambiosSalidaPage() {
    const { state, refreshHistorialSalidas } = useMalvinas();
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const PER_PAGE = 20;
    const [modalObservaciones, setModalObservaciones] = useState<{ isOpen: boolean; content: string }>({ isOpen: false, content: '' });
    const [modalMotivo, setModalMotivo] = useState<{ isOpen: boolean; content: string }>({ isOpen: false, content: '' });
    const [expandedCodigo, setExpandedCodigo] = useState<string | null>(null);

    // Cargar datos al montar el componente
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await refreshHistorialSalidas();
            setLoading(false);
        };
        loadData();
    }, [refreshHistorialSalidas]);

    const cargas = useMemo(() => {
        const map = new Map<string, typeof state.cambiosSalida>();
        state.cambiosSalida.forEach(c => {
            const key = `${c.updatedAt || c.fecha || `sin-fecha-${c.id}`}|${c.motivoCambio || ''}`;
            const prev = map.get(key) || [];
            prev.push(c);
            map.set(key, prev);
        });
        return Array.from(map.entries())
            .map(([key, items]) => ({ codigo_carga: key, fecha_primera: items[0]?.updatedAt || items[0]?.fecha || '', detalles: items }))
            .sort((a, b) => new Date(b.fecha_primera).getTime() - new Date(a.fecha_primera).getTime());
    }, [state.cambiosSalida]);

    const filteredCargas = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return cargas;
        return cargas.filter(c =>
            c.detalles.some(d =>
                d.producto.toLowerCase().includes(q) ||
                d.operacion.toLowerCase().includes(q) ||
                (d.comprobante || '').toLowerCase().includes(q) ||
                (d.asesor || '').toLowerCase().includes(q) ||
                (d.almacen || '').toLowerCase().includes(q)
            )
        );
    }, [cargas, search]);

    const totalCargas = filteredCargas.length;
    const pages = Math.max(1, Math.ceil(totalCargas / PER_PAGE));
    const paginatedCargas = filteredCargas.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    const exportRows = useMemo(() => filteredCargas.flatMap(c => c.detalles), [filteredCargas]);

    const handleExportExcel = () => {
        const columns = [
            { header: 'Fecha Original', key: 'fecha' },
            { header: 'Producto', key: 'producto' },
            { header: 'Operación', key: 'operacion' },
            { header: 'Comprobante', key: 'comprobante' },
            { header: 'Asesor', key: 'asesor' },
            { header: 'Cantidad', key: 'cantidad' },
            { header: 'Unidad Medida', key: 'unidadMedida' },
            { header: 'Almacén', key: 'almacen' },
            { header: 'Entregado Por', key: 'entregado' },
            { header: 'Registrado Por', key: 'registradoPor' },
            { header: 'Observaciones', key: 'observaciones' },
            { header: 'Motivo', key: 'motivoCambio' },
            { header: 'Fecha Cambio', key: 'updatedAt' },
        ];
        exportToExcel(exportRows, columns, `Cambios_Salida_${new Date().toISOString().split('T')[0]}`);
    };

    const handleExportPDF = () => {
        const columns = [
            { header: 'Fecha Original', dataKey: 'fecha' },
            { header: 'Producto', dataKey: 'producto' },
            { header: 'Operación', dataKey: 'operacion' },
            { header: 'Comprobante', dataKey: 'comprobante' },
            { header: 'Asesor', dataKey: 'asesor' },
            { header: 'Cantidad', dataKey: 'cantidad' },
            { header: 'Unidad Medida', dataKey: 'unidadMedida' },
            { header: 'Almacén', dataKey: 'almacen' },
            { header: 'Entregado Por', dataKey: 'entregado' },
            { header: 'Registrado Por', dataKey: 'registradoPor' },
            { header: 'Observaciones', dataKey: 'observaciones' },
            { header: 'Motivo', dataKey: 'motivoCambio' },
            { header: 'Fecha Cambio', dataKey: 'updatedAt' },
        ];
        exportToPDF(exportRows, columns, `Cambios_Salida_${new Date().toISOString().split('T')[0]}`, 'Cambios de Salida');
    };

    return (
        <div id="view-cambios-salida" className="animate-in fade-in duration-500 font-poppins">
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
                                        Cambios de Salida
                                    </h1>
                                    <p className="text-[11px] text-gray-400 mt-0.5 font-medium italic opacity-80">
                                        Historial de todos los registros de salidas que fueron modificados
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
                                Total: {totalCargas} cargas
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

                    {/* Cascada Accordion */}
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xl">
                        <div className="divide-y divide-gray-100">
                            {loading ? (
                                <div className="p-10 text-center text-gray-500">Cargando cambios...</div>
                            ) : totalCargas === 0 ? (
                                <div className="p-10 text-center text-gray-500">No hay cambios registrados aún.</div>
                            ) : (
                                paginatedCargas.map(carga => {
                                    const isOpen = expandedCodigo === carga.codigo_carga;
                                    const { fecha, hora } = formatFechaDosLineas(carga.fecha_primera);
                                    return (
                                        <div key={carga.codigo_carga} className="px-4">
                                            <div
                                                className="py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                                                onClick={() => setExpandedCodigo(isOpen ? null : carga.codigo_carga)}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-8 h-8 rounded-xl bg-[#002D5A] flex items-center justify-center text-white">
                                                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </div>
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <div className="flex items-center gap-3 whitespace-nowrap">
                                                            <div className="text-[10px] text-gray-500 uppercase tracking-widest">FECHA</div>
                                                            <div className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-[11px] font-bold text-gray-900">{fecha}</div>
                                                        </div>
                                                        <div className="flex items-center gap-3 whitespace-nowrap">
                                                            <div className="text-[10px] text-gray-500 uppercase tracking-widest">HORA</div>
                                                            <div className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-[11px] font-bold text-gray-900">{hora || '-'}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 text-[10px] text-gray-600 whitespace-nowrap flex-shrink-0">
                                                    <span className="inline-flex items-center gap-2">
                                                        <PackageMinus className="w-4 h-4 text-[#002D5A]" />
                                                        <span className="font-bold text-gray-900">{carga.detalles.length}</span> cambios
                                                    </span>
                                                    <span className="inline-flex items-center gap-2">
                                                        <FileImage className="w-4 h-4 text-[#002D5A]" />
                                                        <span className="font-bold text-gray-900">{carga.detalles.filter(d => (d.motivoCambio || '').trim().length > 0).length}</span> motivos
                                                    </span>
                                                </div>
                                            </div>

                                            {isOpen && (
                                                <div className="pb-5">
                                                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-sm">
                                                                <thead className="bg-[#002D5A] text-white">
                                                                    <tr className="text-[9px] uppercase">
                                                                        <th className="px-4 py-3 text-left font-bold">PRODUCTO</th>
                                                                        <th className="px-4 py-3 text-left font-bold">OPERACIÓN</th>
                                                                        <th className="px-4 py-3 text-left font-bold">COMPROBANTE</th>
                                                                        <th className="px-4 py-3 text-left font-bold">ASESOR</th>
                                                                        <th className="px-4 py-3 text-left font-bold">CANT.</th>
                                                                        <th className="px-4 py-3 text-left font-bold">U. MEDIDA</th>
                                                                        <th className="px-4 py-3 text-left font-bold">ALMACÉN</th>
                                                                        <th className="px-4 py-3 text-left font-bold">OBS.</th>
                                                                        <th className="px-4 py-3 text-left font-bold">MOTIVO</th>
                                                                        <th className="px-4 py-3 text-left font-bold">FECHA CAMBIO</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {carga.detalles.map((c, i) => (
                                                                        <tr key={`${c.id}-${i}`} className="border-t border-gray-100 text-[11px] hover:bg-blue-50/30 transition-colors">
                                                                            <td className="px-4 py-3 text-gray-800 font-medium">{c.producto}</td>
                                                                            <td className="px-4 py-3">
                                                                                <span className={`px-2 py-0.5 rounded-full ${getOperacionColor(c.operacion).bg} ${getOperacionColor(c.operacion).text} text-[9px] font-bold uppercase`}>
                                                                                    {c.operacion}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-4 py-3 text-gray-700">{c.comprobante || '-'}</td>
                                                                            <td className="px-4 py-3 text-gray-700">{c.asesor || '-'}</td>
                                                                            <td className="px-4 py-3 text-gray-700 font-semibold">{c.cantidad}</td>
                                                                            <td className="px-4 py-3 text-gray-600">{c.unidadMedida}</td>
                                                                            <td className="px-4 py-3 text-gray-700">{c.almacen}</td>
                                                                            <td className="px-4 py-3">
                                                                                <button
                                                                                    onClick={() => setModalObservaciones({ isOpen: true, content: c.observaciones || '-' })}
                                                                                    className="inline-flex items-center justify-center w-[46px] h-[28px] rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
                                                                                    title="Ver observaciones"
                                                                                >
                                                                                    <Eye className="w-4 h-4" />
                                                                                </button>
                                                                            </td>
                                                                            <td className="px-4 py-3">
                                                                                <button
                                                                                    onClick={() => setModalMotivo({ isOpen: true, content: c.motivoCambio || '-' })}
                                                                                    className="inline-flex items-center justify-center w-[46px] h-[28px] rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 transition-colors"
                                                                                    title="Ver motivo"
                                                                                >
                                                                                    <Info className="w-4 h-4" />
                                                                                </button>
                                                                            </td>
                                                                            <td className="px-4 py-3 text-[10px] text-gray-600 whitespace-nowrap">{c.updatedAt || '-'}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
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

            {/* Modal Observaciones */}
            {modalObservaciones.isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 z-[10000]">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <Eye className="w-5 h-5 text-blue-600" />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900">Observaciones</h2>
                            </div>
                            <button
                                onClick={() => setModalObservaciones({ isOpen: false, content: '' })}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-gray-700 whitespace-pre-wrap">{modalObservaciones.content}</p>
                        </div>
                        <div className="flex justify-end p-6 border-t border-gray-200">
                            <button
                                onClick={() => setModalObservaciones({ isOpen: false, content: '' })}
                                className="px-6 py-2 bg-[#002D5A] text-white rounded-lg font-semibold hover:bg-[#003d7a] transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Motivo */}
            {modalMotivo.isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 z-[10000]">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                                    <Info className="w-5 h-5 text-amber-600" />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900">Motivo del Cambio</h2>
                            </div>
                            <button
                                onClick={() => setModalMotivo({ isOpen: false, content: '' })}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-gray-700 whitespace-pre-wrap uppercase font-medium">{modalMotivo.content}</p>
                        </div>
                        <div className="flex justify-end p-6 border-t border-gray-200">
                            <button
                                onClick={() => setModalMotivo({ isOpen: false, content: '' })}
                                className="px-6 py-2 bg-[#002D5A] text-white rounded-lg font-semibold hover:bg-[#003d7a] transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
