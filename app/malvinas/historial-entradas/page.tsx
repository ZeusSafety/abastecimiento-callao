'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    useMalvinas,
    TIENDAS,
    OPERADORES,
    REGISTRADORES,
    OPS_ENTRADA,
    ALMACENES_COMPLETO,
    RegistroEntrada,
    Tienda,
    AlmacenCompleto,
    UnidadMedida,
    Producto,
    getOperacionColor,
} from '../../context/MalvinasContext';
import { Search, PackagePlus, Edit3, X, Save, ChevronDown, FileDown, FileSpreadsheet, Eye } from 'lucide-react';
import TableSkeleton from '../../components/TableSkeleton';
import ProductoAutocomplete from '../../components/ProductoAutocomplete';
import { exportToExcel, exportToPDF } from '../../utils/export';

// ─── Modal Registro Entrada (Copia de seguridad para edición) ───────────────────
function ModalEntrada({
    isOpen,
    onClose,
    editData,
}: {
    isOpen: boolean;
    onClose: () => void;
    editData?: RegistroEntrada | null;
}) {
    const { state, updateEntrada, showToast, refreshEntradas } = useMalvinas();

    const [form, setForm] = useState({
        productoId: editData?.productoId ?? '',
        producto: editData?.producto ?? '',
        operacion: editData?.operacion ?? OPS_ENTRADA[0],
        operacionPersonalizada: '',
        almacenSalida: (editData?.almacenSalida ?? 'ALMACEN CALLAO') as AlmacenCompleto,
        almacenIngreso: (editData?.almacenIngreso ?? 'TIENDA 3006') as Tienda,
        operador: editData?.operador ?? OPERADORES[0],
        cantidad: editData?.cantidad ?? 0,
        unidadMedida: (editData?.unidadMedida ?? 'DOCENAS') as UnidadMedida,
        entregado: editData?.entregado ?? OPERADORES[0],
        registradoPor: editData?.registradoPor ?? REGISTRADORES[0],
        observaciones: editData?.observaciones ?? '',
        motivoCambio: '',
    });

    // Inicializar formulario cuando editData cambia
    useEffect(() => {
        if (editData) {
            const producto = state.productos.find(p => 
                p.codigo === editData.producto || 
                p.nombre === editData.producto ||
                p.id === editData.productoId
            );
            // Si la operación no está en la lista estándar, es una operación personalizada
            const esOperacionPersonalizada = !OPS_ENTRADA.includes(editData.operacion as any);
            setForm({
                productoId: producto?.id || editData.productoId || '',
                producto: editData.producto,
                operacion: esOperacionPersonalizada ? 'OTROS' : editData.operacion,
                operacionPersonalizada: esOperacionPersonalizada ? editData.operacion : '',
                almacenSalida: editData.almacenSalida as AlmacenCompleto,
                almacenIngreso: editData.almacenIngreso as Tienda,
                operador: editData.operador,
                cantidad: editData.cantidad,
                unidadMedida: producto?.unidadMedidaRegCalculo || editData.unidadMedida as UnidadMedida,
                entregado: editData.entregado,
                registradoPor: editData.registradoPor,
                observaciones: editData.observaciones,
                motivoCambio: '',
            });
        }
    }, [editData, state.productos]);

    const handleProductoChange = (productoId: string, producto: Producto | null) => {
        if (!producto) {
            setForm(f => ({
                ...f,
                productoId: '',
                producto: '',
                unidadMedida: 'DOCENAS' as UnidadMedida,
            }));
            return;
        }
        setForm(f => ({
            ...f,
            productoId: productoId,
            producto: producto.nombre,
            unidadMedida: producto.unidadMedidaRegCalculo,
        }));
    };

    const selectedProducto = state.productos.find(p => p.id === form.productoId);

    const handleSubmit = async () => {
        if (!form.productoId) { showToast('error', 'Selecciona un producto'); return; }
        if (!form.cantidad || form.cantidad <= 0) { showToast('error', 'Ingresa una cantidad válida'); return; }
        if (!form.motivoCambio.trim()) { showToast('error', 'Ingresa el motivo del cambio'); return; }

        if (form.operacion === 'OTROS' && !form.operacionPersonalizada.trim()) {
            showToast('error', 'Especifica el nombre de la operación');
            return;
        }

        try {
            await updateEntrada(editData!.id, {
                productoId: form.productoId,
                producto: form.producto,
                operacion: form.operacion === 'OTROS' ? form.operacionPersonalizada : form.operacion,
                almacenSalida: form.almacenSalida,
                almacenIngreso: form.almacenIngreso,
                operador: form.operador,
                cantidad: Number(form.cantidad),
                unidadMedida: form.unidadMedida,
                entregado: form.entregado,
                registradoPor: form.registradoPor,
                observaciones: form.observaciones,
            }, form.motivoCambio);
            await refreshEntradas();
            onClose();
        } catch (error) {
            // El error ya se maneja en las funciones del contexto
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 680, background: 'white', borderRadius: 16, padding: 0, overflow: 'hidden' }}>
                <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-[#002D5A]">
                            <PackagePlus className="w-4 h-4" />
                        </div>
                        <div>
                            <h6 style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#002D5A' }}>Editar Entrada</h6>
                            <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>Modifica los datos y registra el motivo del cambio</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="modal-body" style={{ padding: 20, maxHeight: '70vh', overflowY: 'auto' }}>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Producto *</label>
                            <ProductoAutocomplete
                                productos={state.productos}
                                value={form.productoId}
                                onChange={handleProductoChange}
                                placeholder="Buscar producto..."
                            />
                        </div>
                        <div>
                            <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Código</label>
                            <input
                                type="text"
                                value={selectedProducto?.codigo ?? ''}
                                readOnly
                                className="form-input w-full p-2 border border-gray-200 rounded-lg text-xs"
                                style={{ background: '#f8fafc', color: '#6b7280' }}
                                placeholder="Selecciona un producto"
                            />
                        </div>
                        <div>
                            <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Operación *</label>
                            <select
                                value={form.operacion}
                                onChange={e => setForm(f => ({ ...f, operacion: e.target.value, operacionPersonalizada: e.target.value !== 'OTROS' ? '' : f.operacionPersonalizada }))}
                                className="form-input w-full p-2 border border-gray-200 rounded-lg text-xs"
                            >
                                {OPS_ENTRADA.map(op => <option key={op}>{op}</option>)}
                            </select>
                        </div>
                        {form.operacion === 'OTROS' && (
                            <div className="col-span-2">
                                <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Especificar Operación *</label>
                                <input
                                    type="text"
                                    value={form.operacionPersonalizada}
                                    onChange={e => setForm(f => ({ ...f, operacionPersonalizada: e.target.value }))}
                                    placeholder="Escribe el nombre de la operación..."
                                    className="form-input w-full p-2 border border-gray-200 rounded-lg text-xs"
                                />
                            </div>
                        )}
                        <div>
                            <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Almacén Salida</label>
                            <select
                                value={form.almacenSalida}
                                onChange={e => setForm(f => ({ ...f, almacenSalida: e.target.value as AlmacenCompleto }))}
                                className="form-input w-full p-2 border border-gray-200 rounded-lg text-xs"
                            >
                                {ALMACENES_COMPLETO.map(a => <option key={a}>{a}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Almacén Ingreso</label>
                            <select
                                value={form.almacenIngreso}
                                onChange={e => setForm(f => ({ ...f, almacenIngreso: e.target.value as Tienda }))}
                                className="form-input w-full p-2 border border-gray-200 rounded-lg text-xs"
                            >
                                {TIENDAS.map(t => <option key={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Cantidad *</label>
                            <input
                                type="text"
                                value={form.cantidad === 0 ? '' : form.cantidad}
                                onChange={e => {
                                    const val = e.target.value;
                                    setForm(f => ({ ...f, cantidad: val === '' ? 0 : Number(val) }));
                                }}
                                className="form-input w-full p-2 border border-gray-200 rounded-lg text-xs"
                                placeholder="0"
                            />
                        </div>
                        <div>
                            <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Operador</label>
                            <select
                                value={form.operador}
                                onChange={e => setForm(f => ({ ...f, operador: e.target.value }))}
                                className="form-input w-full p-2 border border-gray-200 rounded-lg text-xs"
                            >
                                {OPERADORES.map(o => <option key={o}>{o}</option>)}
                            </select>
                        </div>

                        <div className="col-span-2">
                            <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: '#002D5A', display: 'block', marginBottom: 4 }}>Motivo del Cambio *</label>
                            <textarea
                                value={form.motivoCambio}
                                onChange={e => setForm(f => ({ ...f, motivoCambio: e.target.value }))}
                                className="form-input w-full p-2 border border-blue-200 rounded-lg text-xs bg-blue-50/30"
                                placeholder="Explica por qué estás actualizando este registro..."
                                rows={2}
                            />
                        </div>
                    </div>
                </div>

                <div className="modal-footer" style={{ padding: '16px 20px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors uppercase">Cancelar</button>
                    <button
                        onClick={handleSubmit}
                        className="flex items-center gap-2 px-6 py-2 bg-[#002D5A] hover:bg-[#001F3D] text-white rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95"
                    >
                        <Save className="w-3.5 h-3.5" />
                        <span>ACTUALIZAR REGISTRO</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Modal Observaciones ───────────────────────────────────────────────────
function ModalObservaciones({
    isOpen,
    onClose,
    observaciones,
}: {
    isOpen: boolean;
    onClose: () => void;
    observaciones: string;
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col z-[10000]">
                {/* Header */}
                <div className="bg-gradient-to-r from-[#002D5A] to-[#003d7a] px-6 py-4 flex items-center justify-between">
                    <h2 className="text-white font-black text-lg uppercase tracking-wider">Observaciones</h2>
                    <button
                        onClick={onClose}
                        className="text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    <div className="text-gray-700 text-sm whitespace-pre-wrap" style={{ fontFamily: 'var(--font-poppins)' }}>
                        {observaciones || 'Sin observaciones'}
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 px-6 py-4 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-[#002D5A] text-white rounded-lg font-semibold hover:bg-[#003d7a] transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Función para formatear fecha en dos líneas ──────────────────────────────
function formatFechaDosLineas(fechaStr: string): { fecha: string; hora: string } {
    if (!fechaStr) return { fecha: '-', hora: '' };
    
    try {
        // Intentar parsear diferentes formatos de fecha
        let fecha: Date;
        
        // Si viene en formato "DD/MM/YYYY HH:MM A. M." o similar
        if (fechaStr.includes('/')) {
            const parts = fechaStr.split(' ');
            const fechaPart = parts[0]; // "DD/MM/YYYY"
            const horaPart = parts.slice(1).join(' '); // "HH:MM A. M."
            
            const [dia, mes, anio] = fechaPart.split('/');
            fecha = new Date(`${anio}-${mes}-${dia} ${horaPart}`);
        } else {
            fecha = new Date(fechaStr);
        }
        
        if (isNaN(fecha.getTime())) {
            return { fecha: fechaStr, hora: '' };
        }
        
        // Formatear fecha: DD/MM/YYYY
        const dia = fecha.getDate().toString().padStart(2, '0');
        const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
        const anio = fecha.getFullYear();
        const fechaFormateada = `${dia}/${mes}/${anio}`;
        
        // Formatear hora: HH:MM a. m. / p. m.
        let horas = fecha.getHours();
        const minutos = fecha.getMinutes().toString().padStart(2, '0');
        const periodo = horas >= 12 ? 'p. m.' : 'a. m.';
        horas = horas % 12 || 12;
        const horaFormateada = `${horas}:${minutos} ${periodo}`;
        
        return { fecha: fechaFormateada, hora: horaFormateada };
    } catch (error) {
        return { fecha: fechaStr, hora: '' };
    }
}

export default function HistorialEntradasPage() {
    const { state, refreshEntradas } = useMalvinas();
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    const [modalOpen, setModalOpen] = useState(false);
    const [editData, setEditData] = useState<RegistroEntrada | null>(null);
    const [modalObsOpen, setModalObsOpen] = useState(false);
    const [observacionesSeleccionadas, setObservacionesSeleccionadas] = useState('');

    // Cargar entradas al montar el componente
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await refreshEntradas();
            setLoading(false);
        };
        loadData();
    }, [refreshEntradas]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return state.entradas.filter(
            e => e.producto.toLowerCase().includes(q) ||
                e.operacion.toLowerCase().includes(q) ||
                e.almacenIngreso.toLowerCase().includes(q) ||
                e.operador.toLowerCase().includes(q)
        );
    }, [state.entradas, search]);

    const total = filtered.length;

    const openEdit = (e: RegistroEntrada) => {
        setEditData(e);
        setModalOpen(true);
    };

    const handleExportExcel = () => {
        const columns = [
            { header: 'Fecha', key: 'fecha' },
            { header: 'Producto', key: 'producto' },
            { header: 'Operación', key: 'operacion' },
            { header: 'Almacén Salida', key: 'almacenSalida' },
            { header: 'Almacén Ingreso', key: 'almacenIngreso' },
            { header: 'Operador', key: 'operador' },
            { header: 'Cantidad', key: 'cantidad' },
            { header: 'Unidad Medida', key: 'unidadMedida' },
            { header: 'Entregado', key: 'entregado' },
            { header: 'Registrado Por', key: 'registradoPor' },
            { header: 'Observaciones', key: 'observaciones' },
            { header: 'Actualizado', key: 'updatedAt' },
        ];
        exportToExcel(filtered, columns, `Historial_Entradas_${new Date().toISOString().split('T')[0]}`);
    };

    const handleExportPDF = () => {
        const columns = [
            { header: 'Fecha', dataKey: 'fecha' },
            { header: 'Producto', dataKey: 'producto' },
            { header: 'Operación', dataKey: 'operacion' },
            { header: 'Almacén Salida', dataKey: 'almacenSalida' },
            { header: 'Almacén Ingreso', dataKey: 'almacenIngreso' },
            { header: 'Operador', dataKey: 'operador' },
            { header: 'Cantidad', dataKey: 'cantidad' },
            { header: 'Unidad Medida', dataKey: 'unidadMedida' },
            { header: 'Entregado', dataKey: 'entregado' },
            { header: 'Registrado Por', dataKey: 'registradoPor' },
            { header: 'Observaciones', dataKey: 'observaciones' },
            { header: 'Actualizado', dataKey: 'updatedAt' },
        ];
        exportToPDF(filtered, columns, `Historial_Entradas_${new Date().toISOString().split('T')[0]}`, 'Historial de Entradas');
    };

    return (
        <>
            <div id="view-historial-entradas" className="animate-in fade-in duration-500 font-poppins">
                <div className="container mx-auto">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6 transition-all">
                        {/* Header Principal */}
                        <header className="flex justify-between items-center flex-wrap gap-4 mb-8">
                            <div className="flex items-center space-x-3">
                                <div className="w-11 h-11 bg-gradient-to-br from-[#002D5A] to-[#0056b3] rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-900/10 transition-transform hover:scale-110">
                                    <PackagePlus className="w-5 h-5" />
                                </div>
                                <div>
                                    <h1 className="font-bold text-gray-900 m-0 tracking-tight" style={{ fontSize: '18px' }}>
                                        Historial de Entradas
                                    </h1>
                                    <p className="text-[11px] text-gray-400 mt-0.5 font-medium italic opacity-80">Registro completo de todos los ingresos</p>
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
                                <span className="font-bold text-gray-800" style={{ fontSize: 13 }}>Total: {total} registros</span>
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
                                <table className="w-full text-sm text-left" style={{ minWidth: 1400 }}>
                                    <thead className="text-[9px] uppercase font-bold tracking-wider">
                                        <tr className="bg-[#002D5A] text-white">
                                            <th className="px-4 py-4 whitespace-nowrap">Fecha</th>
                                            <th className="px-4 py-4">Producto</th>
                                            <th className="px-4 py-4">Operación</th>
                                            <th className="px-4 py-4">Almacén Salida</th>
                                            <th className="px-4 py-4">Almacén Ingreso</th>
                                            <th className="px-4 py-4">Operador</th>
                                            <th className="px-4 py-4 text-center">Cant.</th>
                                            <th className="px-4 py-4">U. Medida</th>
                                            <th className="px-4 py-4">Entregado</th>
                                            <th className="px-4 py-4">Registrador</th>
                                            <th className="px-4 py-4">Obs.</th>
                                            <th className="px-4 py-4">Act.</th>
                                            <th className="px-4 py-4 text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {loading ? (
                                            <TableSkeleton rows={1} cols={13} />
                                        ) : filtered.length === 0 ? (
                                            <tr>
                                                <td colSpan={13} className="px-4 py-20 text-center">
                                                    <div className="flex flex-col items-center justify-center opacity-40">
                                                        <Search className="w-12 h-12 mb-4" />
                                                        <p className="font-black text-gray-900 tracking-tight uppercase italic text-sm">
                                                            {search ? 'No se encontraron registros con ese criterio' : 'No hay registros de entradas aún.'}
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            filtered.map(e => {
                                                const fechaFormateada = formatFechaDosLineas(e.fecha);
                                                const fechaActualizacion = formatFechaDosLineas(e.updatedAt || '');
                                                return (
                                            <tr key={e.id} className="hover:bg-blue-50/30 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-gray-700 font-medium">{fechaFormateada.fecha}</span>
                                                        <span className="text-[9px] text-gray-500">{fechaFormateada.hora}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 font-semibold text-gray-800 text-[11px] uppercase tracking-tight">{e.producto}</td>
                                                <td className="px-4 py-3">
                                                    {(() => {
                                                        const colors = getOperacionColor(e.operacion);
                                                        return (
                                                            <span className={`px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} text-[9px] font-bold uppercase tracking-wider`}>
                                                                {e.operacion}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-4 py-3 text-[11px] text-gray-600 uppercase">{e.almacenSalida}</td>
                                                <td className="px-4 py-3 text-[11px] font-medium text-[#002D5A] uppercase">{e.almacenIngreso}</td>
                                                <td className="px-4 py-3 text-[11px] text-gray-600 uppercase">{e.operador}</td>
                                                <td className="px-4 py-3 text-center font-bold text-gray-900 text-[11px]">{e.cantidad}</td>
                                                <td className="px-4 py-3">
                                                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[9px] font-bold uppercase">
                                                        {e.unidadMedida}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-[11px] text-gray-600 uppercase italic">{e.entregado}</td>
                                                <td className="px-4 py-3 text-[11px] text-gray-600 uppercase">{e.registradoPor}</td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={() => {
                                                            setObservacionesSeleccionadas(e.observaciones || '');
                                                            setModalObsOpen(true);
                                                        }}
                                                        className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                                                        title="Ver observaciones"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {fechaActualizacion.fecha !== '-' ? (
                                                        <div className="flex flex-col">
                                                            <span className="text-[8px] text-gray-400">{fechaActualizacion.fecha}</span>
                                                            <span className="text-[7px] text-gray-400">{fechaActualizacion.hora}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[8px] text-gray-400">-</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => openEdit(e)}
                                                        className="p-1.5 rounded-lg bg-blue-50 text-[#002D5A] hover:bg-[#002D5A] hover:text-white transition-all shadow-sm"
                                                        title="Editar"
                                                    >
                                                        <Edit3 className="w-3.5 h-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        )}
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
            <ModalEntrada
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditData(null); }}
                editData={editData}
            />
            <ModalObservaciones
                isOpen={modalObsOpen}
                onClose={() => setModalObsOpen(false)}
                observaciones={observacionesSeleccionadas}
            />
        </>
    );
}
