'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useMalvinas, TIENDAS } from '../../context/MalvinasContext';
import { Search, RefreshCw, Package, Columns2, AlertTriangle, ChevronDown, Calendar, Image as ImageIcon, X, Loader2 } from 'lucide-react';

export default function HistorialCargaPage() {
    const { state, cargarDetalleAbastecimiento, refreshAbastecimiento } = useMalvinas();
    const [selectedId, setSelectedId] = useState<string>('');
    const [search, setSearch] = useState('');
    const [filtroEnviar, setFiltroEnviar] = useState<'SI' | 'NO' | 'TODOS'>('TODOS');
    const [loading, setLoading] = useState(false);
    const [mesSeleccionado, setMesSeleccionado] = useState<string>('');
    const [añoSeleccionado, setAñoSeleccionado] = useState<string>('');
    const [modalActasOpen, setModalActasOpen] = useState(false);
    const [actas, setActas] = useState<any[]>([]);
    const [loadingActas, setLoadingActas] = useState(false);
    const [imagenSeleccionada, setImagenSeleccionada] = useState<string | null>(null);

    // Función helper para extraer mes y año de una fecha formateada
    // fmtDate devuelve formato: "07/03/2026 11:22" (día/mes/año hora:minuto)
    const parsearFecha = (fechaStr: string): { mes: number; año: number } | null => {
        try {
            // Intentar parsear directamente
            const fecha = new Date(fechaStr);
            if (!isNaN(fecha.getTime())) {
                return { mes: fecha.getMonth() + 1, año: fecha.getFullYear() };
            }
            
            // Si falla, parsear manualmente el formato "dd/mm/yyyy hh:mm"
            const partes = fechaStr.split(/[/\s]/).filter(p => p.trim());
            if (partes.length >= 3) {
                const dia = parseInt(partes[0]);
                const mes = parseInt(partes[1]);
                const año = parseInt(partes[2]);
                if (!isNaN(dia) && !isNaN(mes) && !isNaN(año) && mes >= 1 && mes <= 12) {
                    return { mes, año };
                }
            }
            return null;
        } catch {
            return null;
        }
    };

    // Obtener años únicos de los reportes
    const añosDisponibles = useMemo(() => {
        const años = new Set<number>();
        state.historialAbastecimiento.forEach(h => {
            const parsed = parsearFecha(h.fecha);
            if (parsed) años.add(parsed.año);
        });
        return Array.from(años).sort((a, b) => b - a); // Orden descendente
    }, [state.historialAbastecimiento]);

    // Obtener meses únicos del año seleccionado
    const mesesDisponibles = useMemo(() => {
        if (!añoSeleccionado) return [];
        const meses = new Set<number>();
        state.historialAbastecimiento.forEach(h => {
            const parsed = parsearFecha(h.fecha);
            if (parsed && parsed.año.toString() === añoSeleccionado) {
                meses.add(parsed.mes);
            }
        });
        return Array.from(meses).sort((a, b) => a - b);
    }, [state.historialAbastecimiento, añoSeleccionado]);

    // Filtrar reportes por mes y año
    const reportesFiltrados = useMemo(() => {
        if (!mesSeleccionado && !añoSeleccionado) {
            return state.historialAbastecimiento;
        }
        return state.historialAbastecimiento.filter(h => {
            const parsed = parsearFecha(h.fecha);
            if (!parsed) return false;
            const matchAño = !añoSeleccionado || parsed.año.toString() === añoSeleccionado;
            const matchMes = !mesSeleccionado || parsed.mes.toString() === mesSeleccionado;
            return matchAño && matchMes;
        });
    }, [state.historialAbastecimiento, mesSeleccionado, añoSeleccionado]);

    // Resetear selección cuando cambian los filtros
    useEffect(() => {
        if (selectedId && !reportesFiltrados.find(h => h.id === selectedId)) {
            setSelectedId('');
            setSearch('');
            setFiltroEnviar('TODOS');
        }
    }, [reportesFiltrados, selectedId]);

    // Cargar historial de abastecimientos al montar la página
    useEffect(() => {
        refreshAbastecimiento();
    }, [refreshAbastecimiento]);

    const selectedHistorial = useMemo(
        () => state.historialAbastecimiento.find(h => h.id === selectedId),
        [state.historialAbastecimiento, selectedId]
    );

    // Cargar detalles cuando se selecciona un abastecimiento
    useEffect(() => {
        if (selectedHistorial && selectedHistorial.items.length === 0) {
            setLoading(true);
            cargarDetalleAbastecimiento(selectedHistorial.nombre)
                .finally(() => setLoading(false));
        }
    }, [selectedHistorial, cargarDetalleAbastecimiento]);

    const filtered = useMemo(() => {
        if (!selectedHistorial) return [];
        const q = search.toLowerCase();
        return selectedHistorial.items.filter(r => {
            const matchSearch = r.nombre.toLowerCase().includes(q) || r.codigo.toLowerCase().includes(q);
            const matchEnviar = filtroEnviar === 'TODOS' || r.enviar === filtroEnviar;
            return matchSearch && matchEnviar;
        });
    }, [selectedHistorial, search, filtroEnviar]);

    const total = filtered.length;

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
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-end">
                            {/* Filtro Año */}
                            <div>
                                <label className="block text-[10px] font-black text-[#002D5A] uppercase tracking-widest mb-2 opacity-60">Año</label>
                                <div className="relative">
                                    <select
                                        value={añoSeleccionado}
                                        onChange={e => { 
                                            setAñoSeleccionado(e.target.value);
                                            setMesSeleccionado('');
                                            setSelectedId('');
                                            setSearch('');
                                            setFiltroEnviar('TODOS');
                                        }}
                                        className="w-full pl-4 pr-10 py-3 bg-white border border-gray-200/70 rounded-xl font-bold text-sm text-[#002D5A] focus:ring-4 focus:ring-blue-50 focus:border-[#002D5A] outline-none transition-all appearance-none cursor-pointer shadow-sm"
                                    >
                                        <option value="">Todos</option>
                                        {añosDisponibles.map(año => (
                                            <option key={año} value={año.toString()}>{año}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <Calendar className="w-4 h-4 text-gray-400" />
                                    </div>
                                </div>
                            </div>

                            {/* Filtro Mes */}
                            <div>
                                <label className="block text-[10px] font-black text-[#002D5A] uppercase tracking-widest mb-2 opacity-60">Mes</label>
                                <div className="relative">
                                    <select
                                        value={mesSeleccionado}
                                        onChange={e => { 
                                            setMesSeleccionado(e.target.value);
                                            setSelectedId('');
                                            setSearch('');
                                            setFiltroEnviar('TODOS');
                                        }}
                                        disabled={!añoSeleccionado}
                                        className="w-full pl-4 pr-10 py-3 bg-white border border-gray-200/70 rounded-xl font-bold text-sm text-[#002D5A] focus:ring-4 focus:ring-blue-50 focus:border-[#002D5A] outline-none transition-all appearance-none cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <option value="">Todos</option>
                                        {mesesDisponibles.map(mes => (
                                            <option key={mes} value={mes.toString()}>
                                                {new Date(2000, mes - 1).toLocaleString('es-PE', { month: 'long' }).charAt(0).toUpperCase() + new Date(2000, mes - 1).toLocaleString('es-PE', { month: 'long' }).slice(1)}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <Calendar className="w-4 h-4 text-gray-400" />
                                    </div>
                                </div>
                            </div>

                            {/* Seleccionar Abastecimiento */}
                            <div className="lg:col-span-2">
                                <label className="block text-[10px] font-black text-[#002D5A] uppercase tracking-widest mb-2 opacity-60">Seleccionar Abastecimiento</label>
                                <div className="relative">
                                    <select
                                        value={selectedId}
                                        onChange={e => { setSelectedId(e.target.value); setSearch(''); setFiltroEnviar('TODOS'); }}
                                        className="w-full pl-4 pr-10 py-3 bg-gray-100/60 border border-gray-200/70 rounded-xl font-bold text-sm text-[#002D5A] focus:ring-4 focus:ring-blue-50 focus:border-[#002D5A] outline-none transition-all appearance-none cursor-pointer shadow-sm"
                                    >
                                        <option value="">Seleccione un Reporte</option>
                                        {reportesFiltrados.map(h => (
                                            <option key={h.id} value={h.id}>{h.nombre}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <Search className="w-4 h-4 text-gray-400" />
                                    </div>
                                </div>
                            </div>

                            {/* Botón Limpiar Filtros */}
                            <div>
                                <button
                                    onClick={() => {
                                        setAñoSeleccionado('');
                                        setMesSeleccionado('');
                                        setSelectedId('');
                                        setSearch('');
                                        setFiltroEnviar('TODOS');
                                    }}
                                    className="w-full px-4 py-3 bg-white border border-gray-200/70 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-50 hover:text-[#002D5A] transition-all shadow-sm flex items-center justify-center gap-2"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    <span className="hidden sm:inline">Limpiar</span>
                                </button>
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
                                <div className="flex items-center gap-3">
                                <button
    onClick={async () => {
        const idAbastecimiento = parseInt(selectedHistorial.id);
        if (!isNaN(idAbastecimiento)) {
            setLoadingActas(true);
            setModalActasOpen(true);
            try {
                const { getActasAbastecimiento } = await import('../../services/api');
                const actasData = await getActasAbastecimiento(idAbastecimiento);
                setActas(actasData);
            } catch (error: any) {
                console.error('Error cargando actas:', error);
            } finally {
                setLoadingActas(false);
            }
        }
    }}
    // He actualizado el bg a un color sólido con el valor exacto y un hover ligeramente más oscuro
    className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl font-bold text-xs transition-all shadow-md hover:shadow-lg"
    style={{ backgroundColor: '#002D5A' }} 
    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#001d3d'} // Efecto hover manual para el color personalizado
    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#002D5A'}
>
    <ImageIcon className="w-4 h-4" />
    Ver Actas
</button>
                                </div>
                            </div>

                            {/* Toolbar de filtros */}
                            <div className="flex items-center gap-3 w-full sm:w-auto mb-4">
                                    <div className="relative flex-1 sm:w-64">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Filtrar por código o nombre..."
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                            className="w-full pl-12 pr-4 py-2.5 text-xs bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-50 focus:border-[#002D5A] outline-none transition-all shadow-sm font-medium"
                                        />
                                    </div>
                                    <div className="relative">
                                        <select
                                            value={filtroEnviar}
                                            onChange={e => setFiltroEnviar(e.target.value as 'SI' | 'NO' | 'TODOS')}
                                            className="w-full pl-4 pr-8 py-2.5 text-xs bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-50 focus:border-[#002D5A] outline-none transition-all shadow-sm appearance-none font-medium"
                                            style={{ paddingRight: 32 }}
                                        >
                                            <option value="SI">Si</option>
                                            <option value="NO">No</option>
                                            <option value="TODOS">Todos</option>
                                        </select>
                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    </div>
                                    <button onClick={() => { setSearch(''); setFiltroEnviar('TODOS'); }} className="p-2.5 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 transition-all active:scale-95 shadow-sm text-gray-500">
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                            </div>

                            {/* Table card */}
                            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xl">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-[9px] uppercase font-bold tracking-wider">
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
                                            {loading ? (
                                                <tr>
                                                    <td colSpan={7 + TIENDAS.length} className="px-6 py-20 text-center">
                                                        <div className="flex flex-col items-center justify-center">
                                                            <div className="w-8 h-8 border-4 border-[#002D5A] border-t-transparent rounded-full animate-spin mb-4"></div>
                                                            <p className="text-sm font-medium text-gray-500">Cargando productos...</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : filtered.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7 + TIENDAS.length} className="px-6 py-20 text-center">
                                                        <div className="flex flex-col items-center justify-center opacity-40">
                                                            <Search className="w-12 h-12 mb-4" />
                                                            <p className="font-black text-gray-900 tracking-tight uppercase italic text-sm">
                                                                {search || filtroEnviar !== 'TODOS' ? 'No se encontraron productos con ese criterio' : 'No hay productos registrados'}
                                                            </p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                filtered.map(r => (
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
                                                                ? 'bg-emerald-100 text-emerald-700 shadow-sm'
                                                                : 'bg-red-100 text-red-700 shadow-sm'
                                                                }`}>
                                                                {r.enviar}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
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

            {/* Modal Visualizar Actas */}
            {modalActasOpen && (
                <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setModalActasOpen(false)} style={{ zIndex: 10001 }}>
                    <div className="modal-box" style={{ maxWidth: '95vw', width: 1200, maxHeight: '95vh', overflow: 'auto', zIndex: 10002 }}>
                        <div className="modal-header">
                            <div>
                                <h6 style={{ margin: 0, fontWeight: 700, fontSize: 16, color: '#002D5A' }}>
                                    Actas de Abastecimiento
                                </h6>
                                <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>
                                    {selectedHistorial?.nombre}
                                </p>
                            </div>
                            <button onClick={() => setModalActasOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="modal-body">
                            {loadingActas ? (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <Loader2 className="w-8 h-8 animate-spin text-[#002D5A] mb-4" />
                                    <p className="text-sm text-gray-500">Cargando actas...</p>
                                </div>
                            ) : actas.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <ImageIcon className="w-16 h-16 text-gray-300 mb-4" />
                                    <p className="text-sm font-semibold text-gray-600 mb-1">No hay actas registradas</p>
                                    <p className="text-xs text-gray-400">Este abastecimiento no tiene actas adjuntas</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {actas.map((acta, index) => (
                                        <div
                                            key={acta.id}
                                            className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                            onClick={() => setImagenSeleccionada(acta.url_imagen)}
                                        >
                                            {/* Imagen */}
                                            <div className="relative aspect-video bg-gray-100">
                                                <img
                                                    src={acta.url_imagen}
                                                    alt={acta.nombre_imagen}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23e5e7eb" width="400" height="300"/%3E%3Ctext fill="%239ca3af" font-family="sans-serif" font-size="18" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImagen no disponible%3C/text%3E%3C/svg%3E';
                                                    }}
                                                />
                                            </div>
                                            {/* Información */}
                                            <div className="p-4">
                                                <h6 className="font-bold text-sm text-gray-900 mb-2 line-clamp-2">
                                                    {acta.nombre_imagen}
                                                </h6>
                                                <div className="space-y-2 text-xs">
                                                    <div className="flex items-center gap-2 text-gray-600">
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        <span>
                                                            {new Date(acta.fecha_subida).toLocaleString('es-PE', {
                                                                day: '2-digit',
                                                                month: '2-digit',
                                                                year: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </span>
                                                    </div>
                                                    {acta.registrado_por && (
                                                        <div className="flex items-center gap-2 text-gray-600">
                                                            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[8px] font-bold text-blue-700">
                                                                {acta.registrado_por.charAt(0).toUpperCase()}
                                                            </div>
                                                            <span>{acta.registrado_por}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button onClick={() => setModalActasOpen(false)} className="btn btn-secondary">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Lightbox para imagen completa */}
            {imagenSeleccionada && (
                <div 
                    className="modal-backdrop animate-in fade-in duration-300" 
                    onClick={() => setImagenSeleccionada(null)} 
                    style={{ zIndex: 10007 }}
                >
                    <div 
                        className="relative w-full h-full flex items-center justify-center p-4 animate-in zoom-in-95 duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            onClick={() => setImagenSeleccionada(null)} 
                            className="absolute top-4 right-4 p-2 bg-white hover:bg-gray-100 rounded-full transition-colors z-10 shadow-lg"
                        >
                            <X className="w-6 h-6 text-gray-600" />
                        </button>
                        <img
                            src={imagenSeleccionada}
                            alt="Imagen completa"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23e5e7eb" width="400" height="300"/%3E%3Ctext fill="%239ca3af" font-family="sans-serif" font-size="18" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImagen no disponible%3C/text%3E%3C/svg%3E';
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
