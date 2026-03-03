'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    useMalvinas,
    TIENDAS,
    REGISTRADORES,
    OPS_SALIDA,
    RegistroSalida,
    Tienda,
    UnidadMedida,
} from '../../context/MalvinasContext';
import { Search, PackageMinus, Edit3, X, Save, ChevronDown } from 'lucide-react';

// ─── Modal Salida (Copia para edición) ────────────────────────────────────────
function ModalSalida({
    isOpen,
    onClose,
    editData,
}: {
    isOpen: boolean;
    onClose: () => void;
    editData?: RegistroSalida | null;
}) {
    const { state, updateSalida, showToast } = useMalvinas();

    const [form, setForm] = useState({
        productoId: editData?.productoId ?? '',
        producto: editData?.producto ?? '',
        operacion: editData?.operacion ?? OPS_SALIDA[0],
        comprobante: editData?.comprobante ?? '',
        asesor: editData?.asesor ?? '',
        cantidad: editData?.cantidad ?? 0,
        unidadMedida: (editData?.unidadMedida ?? 'DOCENAS') as UnidadMedida,
        almacen: (editData?.almacen ?? 'TIENDA 3006') as Tienda,
        entregado: editData?.entregado ?? '',
        registradoPor: editData?.registradoPor ?? REGISTRADORES[0],
        observaciones: editData?.observaciones ?? '',
        motivoCambio: '',
    });

    useEffect(() => {
        if (editData) {
            setForm({
                productoId: editData.productoId,
                producto: editData.producto,
                operacion: editData.operacion,
                comprobante: editData.comprobante,
                asesor: editData.asesor,
                cantidad: editData.cantidad,
                unidadMedida: editData.unidadMedida as UnidadMedida,
                almacen: editData.almacen as Tienda,
                entregado: editData.entregado,
                registradoPor: editData.registradoPor,
                observaciones: editData.observaciones,
                motivoCambio: '',
            });
        }
    }, [editData]);

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

    const handleSubmit = () => {
        if (!form.productoId) { showToast('error', 'Selecciona un producto'); return; }
        if (!form.cantidad || form.cantidad <= 0) { showToast('error', 'Ingresa una cantidad válida'); return; }
        if (!form.motivoCambio.trim()) { showToast('error', 'Ingresa el motivo del cambio'); return; }

        updateSalida(editData!.id, {
            productoId: form.productoId,
            producto: form.producto,
            operacion: form.operacion,
            comprobante: form.comprobante,
            asesor: form.asesor,
            cantidad: Number(form.cantidad),
            unidadMedida: form.unidadMedida,
            almacen: form.almacen,
            entregado: form.entregado,
            registradoPor: form.registradoPor,
            observaciones: form.observaciones,
        }, form.motivoCambio);
        showToast('success', 'Salida actualizada correctamente');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 680, background: 'white', borderRadius: 16, padding: 0, overflow: 'hidden' }}>
                <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50 text-red-700">
                            <PackageMinus className="w-4 h-4" />
                        </div>
                        <div>
                            <h6 style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#002D5A' }}>Editar Salida</h6>
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
                            <select
                                value={form.productoId}
                                onChange={handleProductoChange}
                                className="form-input w-full p-2 border border-gray-200 rounded-lg text-xs"
                            >
                                {state.productos.map(p => (
                                    <option key={p.id} value={p.id}>{p.codigo} - {p.nombre}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Operación *</label>
                            <select
                                value={form.operacion}
                                onChange={e => setForm(f => ({ ...f, operacion: e.target.value }))}
                                className="form-input w-full p-2 border border-gray-200 rounded-lg text-xs"
                            >
                                {OPS_SALIDA.map(op => <option key={op}>{op}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Almacén</label>
                            <select
                                value={form.almacen}
                                onChange={e => setForm(f => ({ ...f, almacen: e.target.value as Tienda }))}
                                className="form-input w-full p-2 border border-gray-200 rounded-lg text-xs"
                            >
                                {TIENDAS.map(t => <option key={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Cantidad *</label>
                            <input
                                type="number"
                                value={form.cantidad}
                                onChange={e => setForm(f => ({ ...f, cantidad: Number(e.target.value) }))}
                                className="form-input w-full p-2 border border-gray-200 rounded-lg text-xs"
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: '#002D5A', display: 'block', marginBottom: 4 }}>Motivo del Cambio *</label>
                            <textarea
                                value={form.motivoCambio}
                                onChange={e => setForm(f => ({ ...f, motivoCambio: e.target.value }))}
                                className="form-input w-full p-2 border border-red-200 rounded-lg text-xs bg-red-50/30"
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
                        className="flex items-center gap-2 px-6 py-2 bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95"
                    >
                        <Save className="w-3.5 h-3.5" />
                        <span>ACTUALIZAR REGISTRO</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function HistorialSalidasPage() {
    const { state } = useMalvinas();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const PER_PAGE = 20;

    const [modalOpen, setModalOpen] = useState(false);
    const [editData, setEditData] = useState<RegistroSalida | null>(null);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return state.salidas.filter(
            e => e.producto.toLowerCase().includes(q) ||
                e.operacion.toLowerCase().includes(q) ||
                e.almacen.toLowerCase().includes(q) ||
                (e.comprobante && e.comprobante.toLowerCase().includes(q))
        );
    }, [state.salidas, search]);

    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    const openEdit = (e: RegistroSalida) => {
        setEditData(e);
        setModalOpen(true);
    };

    return (
        <>
            <div id="view-historial-salidas" className="animate-in fade-in duration-500 font-poppins">
                <div className="container mx-auto">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6 transition-all">
                        {/* Header Principal */}
                        <header className="flex justify-between items-center flex-wrap gap-4 mb-8">
                            <div className="flex items-center space-x-3">
                                <div className="w-11 h-11 bg-gradient-to-br from-[#dc2626] to-[#ef4444] rounded-xl flex items-center justify-center text-white shadow-md shadow-red-900/10 transition-transform hover:scale-110">
                                    <PackageMinus className="w-5 h-5" />
                                </div>
                                <div>
                                    <h1 className="font-bold text-gray-900 m-0 tracking-tight" style={{ fontSize: '18px' }}>
                                        Historial de Salidas
                                    </h1>
                                    <p className="text-[11px] text-gray-400 mt-0.5 font-medium italic opacity-80">Registro completo de todas las salidas</p>
                                </div>
                            </div>
                        </header>

                        {/* Toolbar */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 mb-2 bg-transparent">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-pink-50 rounded-lg">
                                    <Search className="w-4 h-4 text-[#9d174d]" />
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
                                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                                        className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-[#002D5A] outline-none transition-all shadow-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Table card */}
                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xl">
                            <div className="overflow-x-auto" style={{ width: '100%' }}>
                                <table className="w-full text-sm text-left" style={{ minWidth: 1400 }}>
                                    <thead className="text-[10px] uppercase font-bold tracking-wider">
                                        <tr className="bg-[#002D5A] text-white">
                                            <th className="px-4 py-4 whitespace-nowrap">Fecha</th>
                                            <th className="px-4 py-4">Producto</th>
                                            <th className="px-4 py-4">Operación</th>
                                            <th className="px-4 py-4">Comprobante</th>
                                            <th className="px-4 py-4">Asesor</th>
                                            <th className="px-4 py-4 text-center">Cant.</th>
                                            <th className="px-4 py-4">U. Medida</th>
                                            <th className="px-4 py-4">Almacén</th>
                                            <th className="px-4 py-4">Entregado</th>
                                            <th className="px-4 py-4">Registrador</th>
                                            <th className="px-4 py-4">Obs.</th>
                                            <th className="px-4 py-4">Act.</th>
                                            <th className="px-4 py-4 text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {paginated.map(e => (
                                            <tr key={e.id} className="hover:bg-blue-50/30 transition-colors">
                                                <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap uppercase">{e.fecha}</td>
                                                <td className="px-4 py-3 font-semibold text-gray-800 text-[11px] uppercase tracking-tight">{e.producto}</td>
                                                <td className="px-4 py-3">
                                                    <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[9px] font-bold uppercase tracking-wider">
                                                        {e.operacion}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-[11px] text-gray-600 uppercase italic">{e.comprobante || '-'}</td>
                                                <td className="px-4 py-3 text-[11px] text-gray-600 uppercase">{e.asesor || '-'}</td>
                                                <td className="px-4 py-3 text-center font-bold text-gray-900 text-[11px]">{e.cantidad}</td>
                                                <td className="px-4 py-3">
                                                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[9px] font-bold uppercase">
                                                        {e.unidadMedida}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-[11px] font-medium text-[#002D5A] uppercase">{e.almacen}</td>
                                                <td className="px-4 py-3 text-[11px] text-gray-600 uppercase italic">{e.entregado}</td>
                                                <td className="px-4 py-3 text-[11px] text-gray-600 uppercase">{e.registradoPor}</td>
                                                <td className="px-4 py-3 text-[10px] text-gray-400 italic max-w-[150px] truncate">{e.observaciones || '-'}</td>
                                                <td className="px-4 py-3 text-[9px] text-gray-300 whitespace-nowrap">{e.updatedAt || '-'}</td>
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
                                        ))}
                                        {paginated.length === 0 && (
                                            <tr>
                                                <td colSpan={13} className="px-4 py-20 text-center">
                                                    <div className="flex flex-col items-center justify-center opacity-40">
                                                        <Search className="w-12 h-12 mb-4" />
                                                        <p className="font-black text-gray-900 tracking-tight uppercase italic text-sm">No hay registros de salidas aún.</p>
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
            <ModalSalida
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditData(null); }}
                editData={editData}
            />
        </>
    );
}
