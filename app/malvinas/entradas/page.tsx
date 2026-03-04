'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
} from '../../context/MalvinasContext';
import {
    Plus, Search, Edit3, X, Save, PackagePlus, ChevronDown
} from 'lucide-react';
import TableSkeleton from '../../components/TableSkeleton';

// ─── Modal Registro Entrada ───────────────────────────────────────────────────
function ModalEntrada({
    isOpen,
    onClose,
    editData,
}: {
    isOpen: boolean;
    onClose: () => void;
    editData?: RegistroEntrada | null;
}) {
    const { state, addEntrada, updateEntrada, showToast, refreshEntradas } = useMalvinas();

    const [form, setForm] = useState({
        productoId: editData?.productoId ?? '',
        producto: editData?.producto ?? '',
        operacion: editData?.operacion ?? OPS_ENTRADA[0],
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

    const isEdit = !!editData;
    const [fechaActual, setFechaActual] = useState('');

    // Inicializar fecha solo en el cliente
    useEffect(() => {
        setFechaActual(new Date().toLocaleString('es-PE'));
    }, []);

    // Inicializar productoId cuando editData cambia
    useEffect(() => {
        if (editData && editData.producto) {
            // Buscar producto por código o nombre
            const producto = state.productos.find(p => 
                p.codigo === editData.producto || 
                p.nombre === editData.producto ||
                p.id === editData.productoId
            );
            if (producto) {
                setForm(f => ({
                    ...f,
                    productoId: producto.id,
                    producto: producto.nombre,
                }));
            }
        }
    }, [editData, state.productos]);

    // Auto-fill unidad/codigo al seleccionar producto
    const handleProductoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const p = state.productos.find(pr => pr.id === e.target.value);
        if (p) {
            setForm(f => ({
                ...f,
                productoId: p.id,
                producto: p.nombre,
                unidadMedida: p.unidadMedidaRegCalculo,
            }));
        }
    };

    const selectedProducto = state.productos.find(p => p.id === form.productoId);

    const handleSubmit = async () => {
        if (!form.productoId || form.productoId === '') { 
            showToast('error', 'Selecciona un producto'); 
            return; 
        }
        if (!form.cantidad || form.cantidad <= 0) { 
            showToast('error', 'Ingresa una cantidad válida mayor a 0'); 
            return; 
        }
        if (isEdit && !form.motivoCambio.trim()) { 
            showToast('error', 'Ingresa el motivo del cambio'); 
            return; 
        }

        try {
            if (isEdit) {
                await updateEntrada(editData!.id, {
                    productoId: form.productoId,
                    producto: form.producto,
                    operacion: form.operacion,
                    almacenSalida: form.almacenSalida,
                    almacenIngreso: form.almacenIngreso,
                    operador: form.operador,
                    cantidad: Number(form.cantidad),
                    unidadMedida: form.unidadMedida,
                    entregado: form.entregado,
                    registradoPor: form.registradoPor,
                    observaciones: form.observaciones,
                }, form.motivoCambio);
            } else {
                await addEntrada({
                    productoId: form.productoId,
                    producto: form.producto,
                    operacion: form.operacion,
                    almacenSalida: form.almacenSalida,
                    almacenIngreso: form.almacenIngreso,
                    operador: form.operador,
                    cantidad: Number(form.cantidad),
                    unidadMedida: form.unidadMedida,
                    entregado: form.entregado,
                    registradoPor: form.registradoPor,
                    observaciones: form.observaciones,
                });
            }
            await refreshEntradas();
            onClose();
        } catch (error) {
            // El error ya se maneja en las funciones del contexto
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 680 }}>
                <div className="modal-header">
                    <div className="flex items-center gap-2">
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: '#E9F1FF' }}
                        >
                            <PackagePlus className="w-4 h-4 text-[#002D5A]" />
                        </div>
                        <div>
                            <h6 style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#002D5A' }}>
                                {isEdit ? 'Editar Entrada' : 'Registrar Entrada'}
                            </h6>
                            <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>
                                {isEdit ? 'Modifica los datos de la entrada seleccionada' : 'Completa los datos del ingreso'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="modal-body">
                    <div className="grid grid-cols-2 gap-4">
                        {/* Fecha (readonly) */}
                        <div>
                            <label className="form-label">Fecha y Hora</label>
                            <input
                                type="text"
                                value={fechaActual || (isEdit && editData?.fecha ? editData.fecha : '')}
                                readOnly
                                className="form-input"
                                style={{ background: '#f8fafc', color: '#6b7280', fontSize: 12 }}
                            />
                        </div>

                        {/* Producto */}
                        <div>
                            <label className="form-label">Producto *</label>
                            <div className="relative">
                                <select
                                    value={form.productoId}
                                    onChange={handleProductoChange}
                                    className="form-input"
                                    style={{ paddingRight: 28, appearance: 'none', fontSize: 12 }}
                                >
                                    <option value="">-- Seleccionar --</option>
                                    {state.productos.map(p => (
                                        <option key={p.id} value={p.id}>{p.codigo} - {p.nombre}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* Código auto */}
                        <div>
                            <label className="form-label">Código del Producto</label>
                            <input
                                type="text"
                                value={selectedProducto?.codigo ?? ''}
                                readOnly
                                className="form-input"
                                style={{ background: '#f8fafc', color: '#6b7280', fontSize: 12 }}
                            />
                        </div>

                        {/* Operación */}
                        <div>
                            <label className="form-label">Operación *</label>
                            <div className="relative">
                                <select
                                    value={form.operacion}
                                    onChange={e => setForm(f => ({ ...f, operacion: e.target.value }))}
                                    className="form-input"
                                    style={{ paddingRight: 28, appearance: 'none', fontSize: 12 }}
                                >
                                    {OPS_ENTRADA.map(op => <option key={op}>{op}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* Almacén Salida */}
                        <div>
                            <label className="form-label">Almacén / Tienda de Salida</label>
                            <div className="relative">
                                <select
                                    value={form.almacenSalida}
                                    onChange={e => setForm(f => ({ ...f, almacenSalida: e.target.value as AlmacenCompleto }))}
                                    className="form-input"
                                    style={{ paddingRight: 28, appearance: 'none', fontSize: 12 }}
                                >
                                    {ALMACENES_COMPLETO.map(a => <option key={a}>{a}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* Almacén Ingreso */}
                        <div>
                            <label className="form-label">Ingreso (Tienda Destino)</label>
                            <div className="relative">
                                <select
                                    value={form.almacenIngreso}
                                    onChange={e => setForm(f => ({ ...f, almacenIngreso: e.target.value as Tienda }))}
                                    className="form-input"
                                    style={{ paddingRight: 28, appearance: 'none', fontSize: 12 }}
                                >
                                    {TIENDAS.map(t => <option key={t}>{t}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* Operador */}
                        <div>
                            <label className="form-label">Operador</label>
                            <div className="relative">
                                <select
                                    value={form.operador}
                                    onChange={e => setForm(f => ({ ...f, operador: e.target.value }))}
                                    className="form-input"
                                    style={{ paddingRight: 28, appearance: 'none', fontSize: 12 }}
                                >
                                    {OPERADORES.map(o => <option key={o}>{o}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* Cantidad */}
                        <div>
                            <label className="form-label">Cantidad *</label>
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={form.cantidad === 0 ? '' : form.cantidad}
                                onChange={e => {
                                    const val = e.target.value === '' ? 0 : Number(e.target.value);
                                    setForm(f => ({ ...f, cantidad: val }));
                                }}
                                onBlur={e => {
                                    if (e.target.value === '' || Number(e.target.value) <= 0) {
                                        setForm(f => ({ ...f, cantidad: 0 }));
                                    }
                                }}
                                className="form-input"
                                style={{ fontSize: 12 }}
                                placeholder="0"
                            />
                        </div>

                        {/* Unidad Medida (auto) */}
                        <div>
                            <label className="form-label">Unidad de Medida</label>
                            <input
                                type="text"
                                value={form.unidadMedida}
                                readOnly
                                className="form-input"
                                style={{ background: '#f8fafc', color: '#6b7280', fontSize: 12 }}
                            />
                        </div>

                        {/* Entregado */}
                        <div>
                            <label className="form-label">Entregado</label>
                            <div className="relative">
                                <select
                                    value={form.entregado}
                                    onChange={e => setForm(f => ({ ...f, entregado: e.target.value }))}
                                    className="form-input"
                                    style={{ paddingRight: 28, appearance: 'none', fontSize: 12 }}
                                >
                                    {OPERADORES.map(o => <option key={o}>{o}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* Registrado por */}
                        <div>
                            <label className="form-label">Registrado Por</label>
                            <div className="relative">
                                <select
                                    value={form.registradoPor}
                                    onChange={e => setForm(f => ({ ...f, registradoPor: e.target.value }))}
                                    className="form-input"
                                    style={{ paddingRight: 28, appearance: 'none', fontSize: 12 }}
                                >
                                    {REGISTRADORES.map(r => <option key={r}>{r}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* Observaciones */}
                        <div className="col-span-2">
                            <label className="form-label">Observaciones</label>
                            <textarea
                                value={form.observaciones}
                                onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                                className="form-input"
                                rows={3}
                                style={{ resize: 'vertical', fontSize: 12 }}
                                placeholder="Escribe una observación..."
                            />
                        </div>

                        {/* Motivo del cambio (solo en edición) */}
                        {isEdit && (
                            <div className="col-span-2">
                                <label className="form-label" style={{ color: '#dc2626' }}>
                                    Motivo del Cambio *
                                </label>
                                <textarea
                                    value={form.motivoCambio}
                                    onChange={e => setForm(f => ({ ...f, motivoCambio: e.target.value }))}
                                    className="form-input"
                                    rows={2}
                                    style={{ resize: 'vertical', fontSize: 12, borderColor: '#fca5a5' }}
                                    placeholder="Describe el motivo del cambio..."
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="modal-footer">
                    <button onClick={onClose} className="btn btn-secondary">Cancelar</button>
                    <button onClick={handleSubmit} className="btn btn-primary">
                        <Save className="w-4 h-4" />
                        {isEdit ? 'Guardar Cambios' : 'Registrar Entrada'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function EntradasPage() {
    const { state, refreshEntradas } = useMalvinas();
    const [modalOpen, setModalOpen] = useState(false);
    const [editData, setEditData] = useState<RegistroEntrada | null>(null);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const PER_PAGE = 15;

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
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    const openNew = () => { setEditData(null); setModalOpen(true); };
    const openEdit = (e: RegistroEntrada) => { setEditData(e); setModalOpen(true); };

    return (
        <div id="view-entradas" className="animate-in fade-in duration-500 font-poppins">
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
                                    Movimientos de Entradas
                                </h1>
                                <p className="text-[11px] text-gray-400 mt-0.5 font-medium italic opacity-80">Registro completo de todos los ingresos</p>
                            </div>
                        </div>
                        <div className="header-actions flex gap-3">
                            <button
                                onClick={openNew}
                                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl font-bold transition-all duration-300 shadow-md text-[10px] bg-[#002D5A] hover:bg-[#001F3D] text-white hover:shadow-lg hover:-translate-y-0.5 active:scale-95 border-b-2 border-black/20"
                            >
                                <Plus className="w-3.5 h-3.5 stroke-[3px]" />
                                <span>REGISTRAR ENTRADA</span>
                            </button>
                        </div>
                    </header>

                    {/* Toolbar - Moved out of the card table area */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 mb-2 bg-transparent">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <Search className="w-4 h-4 text-[#002D5A]" />
                            </div>
                            <span className="font-bold text-gray-800" style={{ fontSize: 14 }}>
                                Listado de Entradas
                            </span>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-72">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar producto, operador..."
                                    value={search}
                                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-[#002D5A] outline-none transition-all shadow-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Table card */}
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xl">

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-[10px] uppercase font-bold tracking-wider">
                                    <tr className="bg-[#002D5A] text-white">
                                        <th className="px-4 py-4">Fecha</th>
                                        <th className="px-4 py-4">Producto</th>
                                        <th className="px-4 py-4">Operación</th>
                                        <th className="px-4 py-4">Salió de</th>
                                        <th className="px-4 py-4">Ingresó a</th>
                                        <th className="px-4 py-4">Operador</th>
                                        <th className="px-4 py-4 text-center">Cant.</th>
                                        <th className="px-4 py-4">U. Medida</th>
                                        <th className="px-4 py-4 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loading ? (
                                        <TableSkeleton rows={PER_PAGE} cols={9} />
                                    ) : paginated.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="px-4 py-12 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <PackagePlus className="w-12 h-12 text-gray-300" />
                                                    <p className="text-gray-400 text-sm font-medium">
                                                        {search ? 'No se encontraron registros con ese criterio' : 'No hay registros de entrada'}
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        paginated.map(e => (
                                            <tr key={e.id} className="hover:bg-blue-50/30 transition-colors">
                                                <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap uppercase">{e.fecha}</td>
                                                <td className="px-4 py-3 font-semibold text-gray-800 text-[11px] uppercase tracking-tight">{e.producto}</td>
                                                <td className="px-4 py-3">
                                                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[9px] font-bold uppercase tracking-wider">
                                                        {e.operacion}
                                                    </span>
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
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 flex items-center justify-between border-t border-gray-100">
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

            <ModalEntrada
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditData(null); }}
                editData={editData}
            />
        </div>
    );
}
