'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useCallao, getOperacionColor } from '../../context/CallaoContext';
import { 
    Search, TrendingUp, FileDown, FileSpreadsheet, Eye, Info, X, 
    ChevronDown, ChevronRight, PackageMinus, FileImage, Calendar, 
    Clock3, LayoutGrid, Filter, AlertCircle 
} from 'lucide-react';
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
    const { state, refreshHistorialSalidas } = useCallao();
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const PER_PAGE = 20;
    const [modalObservaciones, setModalObservaciones] = useState<{ isOpen: boolean; content: string }>({ isOpen: false, content: '' });
    const [modalMotivo, setModalMotivo] = useState<{ isOpen: boolean; content: string }>({ isOpen: false, content: '' });
    const [expandedCodigos, setExpandedCodigos] = useState<Set<string>>(new Set());

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

    useEffect(() => {
        const keys = paginatedCargas.map((carga, idx) => `${carga.codigo_carga || 'sin-codigo'}-${idx}`);
        setExpandedCodigos(prev => {
            if (prev.size === keys.length && keys.every(k => prev.has(k))) return prev;
            return new Set(keys);
        });
    }, [paginatedCargas]);

    const handleExportExcel = () => {
        const columns = [
            { header: 'Fecha Original', key: 'fecha' },
            { header: 'Producto', key: 'producto' },
            { header: 'Operación', key: 'operacion' },
            { header: 'Comprobante', key: 'comprobante' },
            { header: 'Asesor', key: 'asesor' },
            { header: 'Cantidad Anterior', key: 'cantidadAnterior' },
            { header: 'Cantidad Actual', key: 'cantidad' },
            { header: 'Unidad Medida', key: 'unidadMedida' },
            { header: 'Almacén', key: 'almacen' },
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
            { header: 'Cantidad Anterior', dataKey: 'cantidadAnterior' },
            { header: 'Cantidad Actual', dataKey: 'cantidad' },
            { header: 'Unidad Medida', dataKey: 'unidadMedida' },
            { header: 'Almacén', dataKey: 'almacen' },
            { header: 'Registrado Por', dataKey: 'registradoPor' },
            { header: 'Observaciones', dataKey: 'observaciones' },
            { header: 'Motivo', dataKey: 'motivoCambio' },
            { header: 'Fecha Cambio', dataKey: 'updatedAt' },
        ];
        exportToPDF(exportRows, columns, `Cambios_Salida_${new Date().toISOString().split('T')[0]}`, 'Cambios de Salida');
    };

    return (
        <div id="view-cambios-salida" className="animate-in fade-in duration-500 font-poppins">
            <div className="container mx-auto max-w-[1600px] px-4 py-8">
                {/* Header Premium */}
                <div className="bg-white rounded-[2rem] p-8 shadow-2xl shadow-blue-900/5 border border-gray-100 mb-8 relative overflow-hidden transition-all hover:shadow-blue-900/10">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -mr-32 -mt-32 opacity-50 blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-50 rounded-full -ml-24 -mb-24 opacity-50 blur-3xl"></div>
                    
                    <header className="relative flex justify-between items-center flex-wrap gap-6">
                        <div className="flex items-center space-x-5">
                            <div className="w-16 h-16 bg-gradient-to-br from-[#002D5A] to-[#0056b3] rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-900/20 transform transition-transform hover:scale-110 rotate-3">
                                <TrendingUp className="w-8 h-8" />
                            </div>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="font-black text-gray-900 m-0 tracking-tight text-2xl uppercase">
                                        Cambios de Salida
                                    </h1>
                                    <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest border border-blue-100">
                                        Auditoría
                                    </span>
                                </div>
                                <p className="text-[12px] text-gray-500 mt-1 font-bold italic opacity-80 flex items-center gap-2">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Historial detallado de modificaciones realizadas en registros de salidas
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleExportPDF}
                                className="group flex items-center gap-3 px-6 py-3 rounded-2xl font-black transition-all duration-300 shadow-lg text-[10px] bg-red-600 hover:bg-red-700 text-white hover:shadow-red-600/30 hover:-translate-y-1 active:scale-95 uppercase tracking-widest"
                            >
                                <FileDown className="w-4 h-4 transition-transform group-hover:scale-110" />
                                <span>Exportar PDF</span>
                            </button>
                            <button
                                onClick={handleExportExcel}
                                className="group flex items-center gap-3 px-6 py-3 rounded-2xl font-black transition-all duration-300 shadow-lg text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-emerald-600/30 hover:-translate-y-1 active:scale-95 uppercase tracking-widest"
                            >
                                <FileSpreadsheet className="w-4 h-4 transition-transform group-hover:scale-110" />
                                <span>Exportar Excel</span>
                            </button>
                        </div>
                    </header>
                </div>

                {/* Toolbar Premium */}
                <div className="bg-white/80 backdrop-blur-md rounded-3xl p-4 shadow-xl border border-gray-100 mb-6 sticky top-4 z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4 pl-2">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                            <LayoutGrid className="w-5 h-5 text-[#002D5A]" />
                        </div>
                        <div>
                            <span className="block text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none mb-1">Resultados</span>
                            <span className="font-black text-gray-900 text-lg leading-none">
                                {totalCargas} <span className="text-gray-400 font-medium">registros</span>
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-80 group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 bg-gray-50 rounded-lg group-focus-within:bg-blue-50 transition-colors">
                                <Search className="w-4 h-4 text-gray-400 group-focus-within:text-[#002D5A] transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Buscar por producto, asesor o comprobante..."
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1); }}
                                className="w-full pl-14 pr-4 py-3.5 text-sm bg-gray-50/50 border-2 border-gray-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-[#002D5A] outline-none transition-all font-medium placeholder:text-gray-400 shadow-inner"
                            />
                        </div>
                        <button className="p-3.5 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-2xl transition-all hover:scale-105 active:scale-95 border border-gray-100">
                            <Filter className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="space-y-6">
                    {loading ? (
                        <div className="bg-white rounded-[2.5rem] p-20 shadow-xl border border-gray-100 flex flex-col items-center justify-center gap-6">
                            <div className="relative">
                                <div className="w-20 h-20 border-4 border-blue-50 rounded-full"></div>
                                <div className="w-20 h-20 border-4 border-t-[#002D5A] rounded-full animate-spin absolute top-0 left-0"></div>
                            </div>
                            <div className="text-center">
                                <p className="text-gray-900 font-black text-lg uppercase tracking-widest">Sincronizando Auditoría</p>
                                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Obteniendo registros de cambios...</p>
                            </div>
                        </div>
                    ) : totalCargas === 0 ? (
                        <div className="bg-white rounded-[2.5rem] p-20 shadow-xl border border-gray-100 text-center">
                            <div className="w-24 h-24 bg-gray-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 transform -rotate-12">
                                <AlertCircle className="w-12 h-12 text-gray-300" />
                            </div>
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-widest mb-2">Sin Modificaciones</h3>
                            <p className="text-gray-500 font-medium max-w-xs mx-auto">No se han detectado cambios en los registros de salida bajo los criterios actuales.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6">
                            {paginatedCargas.map((carga, idx) => {
                                const cargaKey = `${carga.codigo_carga || 'sin-codigo'}-${idx}`;
                                const isOpen = expandedCodigos.has(cargaKey);
                                const { fecha, hora } = formatFechaDosLineas(carga.fecha_primera);
                                
                                return (
                                    <div 
                                        key={cargaKey} 
                                        className={`group bg-white rounded-[2.5rem] border-2 transition-all duration-500 overflow-hidden shadow-sm hover:shadow-2xl ${isOpen ? 'border-[#002D5A] ring-8 ring-blue-500/5' : 'border-gray-100 hover:border-blue-200'}`}
                                    >
                                        <div 
                                            className={`p-6 cursor-pointer flex items-center justify-between transition-colors ${isOpen ? 'bg-blue-50/30' : 'hover:bg-gray-50/50'}`}
                                            onClick={() => setExpandedCodigos(prev => {
                                                const next = new Set(prev);
                                                if (next.has(cargaKey)) next.delete(cargaKey);
                                                else next.add(cargaKey);
                                                return next;
                                            })}
                                        >
                                            <div className="flex items-center gap-6 min-w-0">
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 transform ${isOpen ? 'bg-[#002D5A] text-white rotate-180 scale-110 shadow-lg shadow-blue-900/20' : 'bg-gray-50 text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600 group-hover:scale-105'}`}>
                                                    {isOpen ? <ChevronDown className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] mb-1">Fecha de Cambio</span>
                                                        <div className="flex items-center gap-2">
                                                            <Calendar className="w-4 h-4 text-blue-600" />
                                                            <span className="font-black text-gray-900 text-sm tracking-tight">{fecha}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] mb-1">Hora Exacta</span>
                                                        <div className="flex items-center gap-2">
                                                            <Clock3 className="w-4 h-4 text-blue-600" />
                                                            <span className="font-black text-gray-900 text-sm tracking-tight">{hora || '-'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-4">
                                                <div className="hidden lg:flex items-center gap-4 mr-4">
                                                    <div className="px-5 py-2.5 rounded-2xl bg-gray-50 border border-gray-100 flex items-center gap-3">
                                                        <PackageMinus className="w-5 h-5 text-[#002D5A]" />
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] text-gray-400 font-black uppercase leading-none">Cambios</span>
                                                            <span className="font-black text-gray-900 text-sm leading-none">{carga.detalles.length}</span>
                                                        </div>
                                                    </div>
                                                    <div className="px-5 py-2.5 rounded-2xl bg-amber-50 border border-amber-100 flex items-center gap-3">
                                                        <Info className="w-5 h-5 text-amber-600" />
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] text-amber-500 font-black uppercase leading-none">Motivos</span>
                                                            <span className="font-black text-gray-900 text-sm leading-none">
                                                                {carga.detalles.filter(d => (d.motivoCambio || '').trim().length > 0).length}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className={`p-2 rounded-xl transition-colors ${isOpen ? 'bg-[#002D5A]/10 text-[#002D5A]' : 'text-gray-300'}`}>
                                                    <LayoutGrid className="w-5 h-5" />
                                                </div>
                                            </div>
                                        </div>

                                        {isOpen && (
                                            <div className="px-6 pb-8 animate-in slide-in-from-top-4 duration-500">
                                                <div className="bg-gray-50/50 rounded-[2rem] border border-gray-100 p-2">
                                                    <div className="overflow-x-auto rounded-[1.8rem]">
                                                        <table className="w-full border-collapse">
                                                            <thead>
                                                                <tr className="bg-[#002D5A]">
                                                                    <th className="px-6 py-5 text-left text-[10px] font-black text-white uppercase tracking-widest first:rounded-tl-[1.8rem]">Producto</th>
                                                                    <th className="px-6 py-5 text-left text-[10px] font-black text-white uppercase tracking-widest">Operación</th>
                                                                    <th className="px-6 py-5 text-left text-[10px] font-black text-white uppercase tracking-widest">Comprobante</th>
                                                                    <th className="px-6 py-5 text-left text-[10px] font-black text-white uppercase tracking-widest text-center">Cantidades</th>
                                                                    <th className="px-6 py-5 text-left text-[10px] font-black text-white uppercase tracking-widest text-center">Acciones</th>
                                                                    <th className="px-6 py-5 text-left text-[10px] font-black text-white uppercase tracking-widest last:rounded-tr-[1.8rem]">Auditoría</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100">
                                                                {carga.detalles.map((c, i) => (
                                                                    <tr key={`${c.id}-${i}`} className="bg-white hover:bg-blue-50/50 transition-colors group/row">
                                                                        <td className="px-6 py-5">
                                                                            <div className="flex flex-col">
                                                                                <span className="text-gray-900 font-black text-xs tracking-tight uppercase">{c.producto}</span>
                                                                                <span className="text-[10px] text-gray-400 font-bold mt-1 uppercase">{c.almacen}</span>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-6 py-5">
                                                                            <span className={`inline-flex px-3 py-1 rounded-lg ${getOperacionColor(c.operacion).bg} ${getOperacionColor(c.operacion).text} text-[9px] font-black uppercase tracking-widest border border-current opacity-80`}>
                                                                                {c.operacion}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-6 py-5">
                                                                            <div className="flex flex-col">
                                                                                <span className="text-gray-800 font-bold text-xs uppercase">{c.comprobante || '---'}</span>
                                                                                <span className="text-[10px] text-gray-400 font-medium">{c.asesor || 'No asignado'}</span>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-6 py-5">
                                                                            <div className="flex items-center justify-center gap-3">
                                                                                <div className="flex flex-col items-center bg-red-50 px-3 py-1.5 rounded-xl border border-red-100">
                                                                                    <span className="text-[8px] text-red-500 font-black uppercase tracking-tighter">ANTERIOR</span>
                                                                                    <span className="text-xs font-black text-red-600">{c.cantidadAnterior ?? '-'}</span>
                                                                                </div>
                                                                                <ChevronRight className="w-3 h-3 text-gray-300" />
                                                                                <div className="flex flex-col items-center bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                                                                                    <span className="text-[8px] text-emerald-500 font-black uppercase tracking-tighter">ACTUAL</span>
                                                                                    <span className="text-xs font-black text-emerald-600">{c.cantidad}</span>
                                                                                </div>
                                                                                <span className="text-[10px] text-gray-400 font-bold uppercase ml-1">{c.unidadMedida}</span>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-6 py-5">
                                                                            <div className="flex items-center justify-center gap-2">
                                                                                <button 
                                                                                    onClick={() => setModalObservaciones({ isOpen: true, content: c.observaciones || 'Sin observaciones.' })}
                                                                                    className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95"
                                                                                    title="Ver Observaciones"
                                                                                >
                                                                                    <Eye className="w-4 h-4" />
                                                                                </button>
                                                                                <button 
                                                                                    onClick={() => setModalMotivo({ isOpen: true, content: c.motivoCambio || 'Sin motivo especificado.' })}
                                                                                    className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center hover:bg-amber-600 hover:text-white transition-all shadow-sm active:scale-95"
                                                                                    title="Ver Motivo"
                                                                                >
                                                                                    <Info className="w-4 h-4" />
                                                                                </button>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-6 py-5">
                                                                            <div className="flex flex-col items-end">
                                                                                <span className="text-[10px] font-black text-gray-900 tracking-tight">{c.updatedAt || '-'}</span>
                                                                                <div className="flex items-center gap-1.5 mt-1">
                                                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                                                                                    <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest">{c.registradoPor || 'Sistema'}</span>
                                                                                </div>
                                                                            </div>
                                                                        </td>
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
                            })}
                        </div>
                    )}
                </div>

                {/* Pagination Premium */}
                {pages > 1 && (
                    <div className="mt-12 flex justify-center">
                        <div className="bg-white/80 backdrop-blur-md px-4 py-3 rounded-[2.5rem] shadow-2xl border border-gray-100 flex items-center gap-4">
                            <button
                                onClick={() => setPage(1)}
                                disabled={page === 1}
                                className="w-10 h-10 rounded-2xl flex items-center justify-center bg-gray-50 text-gray-400 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-black"
                            >
                                «
                            </button>
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="w-10 h-10 rounded-2xl flex items-center justify-center bg-gray-50 text-gray-400 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-black text-sm"
                            >
                                ‹
                            </button>
                            
                            <div className="flex items-center gap-2 px-4 border-x border-gray-100">
                                <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Página</span>
                                <div className="w-10 h-10 rounded-2xl bg-[#002D5A] text-white flex items-center justify-center font-black text-sm shadow-lg shadow-blue-900/20">
                                    {page}
                                </div>
                                <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">de</span>
                                <span className="font-black text-gray-900 text-sm">{pages}</span>
                            </div>

                            <button
                                onClick={() => setPage(p => Math.min(pages, p + 1))}
                                disabled={page === pages}
                                className="w-10 h-10 rounded-2xl flex items-center justify-center bg-gray-50 text-gray-400 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-black text-sm"
                            >
                                ›
                            </button>
                            <button
                                onClick={() => setPage(pages)}
                                disabled={page === pages}
                                className="w-10 h-10 rounded-2xl flex items-center justify-center bg-gray-50 text-gray-400 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-black"
                            >
                                »
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals Premium */}
            {modalObservaciones.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setModalObservaciones({ isOpen: false, content: '' })}></div>
                    <div className="bg-white rounded-[3rem] shadow-2xl max-w-lg w-full relative z-10 overflow-hidden animate-in zoom-in-95 duration-500">
                        <div className="bg-gradient-to-r from-[#002D5A] to-[#004a8f] px-8 py-6 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                                    <Eye className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-white font-black text-lg uppercase tracking-wider m-0 leading-none">Observaciones</h2>
                                    <p className="text-blue-100/60 text-[10px] font-bold mt-1 uppercase tracking-widest">Detalle del registro</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setModalObservaciones({ isOpen: false, content: '' })}
                                className="p-2 hover:bg-white/10 rounded-xl transition-all text-white/70 hover:text-white"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-10">
                            <div className="bg-gray-50 rounded-[2rem] p-8 border-2 border-dashed border-gray-200">
                                <p className="text-gray-700 font-medium leading-relaxed italic m-0">"{modalObservaciones.content}"</p>
                            </div>
                        </div>
                        <div className="px-10 pb-10 flex justify-end">
                            <button
                                onClick={() => setModalObservaciones({ isOpen: false, content: '' })}
                                className="px-10 py-4 bg-[#002D5A] text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-blue-900/20 hover:shadow-blue-900/40 hover:-translate-y-1 transition-all active:scale-95"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {modalMotivo.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setModalMotivo({ isOpen: false, content: '' })}></div>
                    <div className="bg-white rounded-[3rem] shadow-2xl max-w-lg w-full relative z-10 overflow-hidden animate-in zoom-in-95 duration-500">
                        <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-8 py-6 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                                    <Info className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-white font-black text-lg uppercase tracking-wider m-0 leading-none">Motivo del Cambio</h2>
                                    <p className="text-amber-100/60 text-[10px] font-bold mt-1 uppercase tracking-widest">Justificación Auditoría</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setModalMotivo({ isOpen: false, content: '' })}
                                className="p-2 hover:bg-white/10 rounded-xl transition-all text-white/70 hover:text-white"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-10">
                            <div className="bg-amber-50 rounded-[2rem] p-8 border-2 border-dashed border-amber-200">
                                <p className="text-amber-900 font-black text-sm uppercase tracking-tight m-0 leading-relaxed leading-7">{modalMotivo.content}</p>
                            </div>
                        </div>
                        <div className="px-10 pb-10 flex justify-end">
                            <button
                                onClick={() => setModalMotivo({ isOpen: false, content: '' })}
                                className="px-10 py-4 bg-amber-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-amber-900/20 hover:shadow-amber-900/40 hover:-translate-y-1 transition-all active:scale-95"
                            >
                                Cerrar Registro
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
