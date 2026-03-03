'use client';

import React, { useState, useMemo } from 'react';
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
    const { state, addEntrada, updateEntrada, showToast } = useMalvinas();

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

    const handleSubmit = () => {
        if (!form.productoId) { showToast('error', 'Selecciona un producto'); return; }
        if (!form.cantidad || form.cantidad <= 0) { showToast('error', 'Ingresa una cantidad válida'); return; }
        if (isEdit && !form.motivoCambio.trim()) { showToast('error', 'Ingresa el motivo del cambio'); return; }

        if (isEdit) {
            updateEntrada(editData!.id, {
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
            showToast('success', 'Entrada actualizada correctamente');
        } else {
            addEntrada({
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
            showToast('success', 'Entrada registrada correctamente');
        }
        onClose();
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
                                value={new Date().toLocaleString('es-PE')}
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
                                min={1}
                                value={form.cantidad || ''}
                                onChange={e => setForm(f => ({ ...f, cantidad: Number(e.target.value) }))}
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
    const { state } = useMalvinas();
    const [modalOpen, setModalOpen] = useState(false);
    const [editData, setEditData] = useState<RegistroEntrada | null>(null);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const PER_PAGE = 15;

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
        <div>
            <div className="mb-5 flex items-center justify-between">
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: '#002D5A', margin: 0 }}>
                        Entradas
                    </h1>
                    <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                        Registro de ingresos de productos al almacén
                    </p>
                </div>
                <button onClick={openNew} className="btn btn-primary">
                    <Plus className="w-4 h-4" />
                    Registrar Entrada
                </button>
            </div>

            <div className="card">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#002D5A' }}>
                        Listado de Entradas ({total})
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1); }}
                                className="form-input pl-8"
                                style={{ width: 200, padding: '6px 10px 6px 28px', fontSize: 12 }}
                            />
                        </div>
                    </div>
                </div>

                <div className="table-container" style={{ borderRadius: 0, border: 'none' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Producto</th>
                                <th>Operación</th>
                                <th>Almacén Salida</th>
                                <th>Almacén Ingreso</th>
                                <th>Operador</th>
                                <th style={{ textAlign: 'center' }}>Cantidad</th>
                                <th>U. Medida</th>
                                <th>Entregado</th>
                                <th>Registrado Por</th>
                                <th>Observaciones</th>
                                <th style={{ textAlign: 'center' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginated.map(e => (
                                <tr key={e.id}>
                                    <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{e.fecha}</td>
                                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.producto}</td>
                                    <td>
                                        <span className="badge" style={{ background: '#dbeafe', color: '#1e40af', fontSize: 10 }}>
                                            {e.operacion}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: 11 }}>{e.almacenSalida}</td>
                                    <td style={{ fontSize: 11 }}>{e.almacenIngreso}</td>
                                    <td>{e.operador}</td>
                                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{e.cantidad}</td>
                                    <td>
                                        <span className="badge badge-entrada" style={{ fontSize: 10 }}>{e.unidadMedida}</span>
                                    </td>
                                    <td>{e.entregado}</td>
                                    <td>{e.registradoPor}</td>
                                    <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 11, color: '#6b7280' }}>
                                        {e.observaciones || '-'}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button
                                            onClick={() => openEdit(e)}
                                            className="btn btn-sm btn-icon"
                                            style={{ background: '#E9F1FF', color: '#002D5A' }}
                                            title="Editar"
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {paginated.length === 0 && (
                                <tr>
                                    <td colSpan={12} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>
                                        {state.entradas.length === 0
                                            ? 'No hay entradas registradas. Haz clic en "Registrar Entrada" para comenzar.'
                                            : 'No se encontraron resultados.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {total > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                        <span style={{ fontSize: 11, color: '#6b7280' }}>
                            Mostrando {Math.min((page - 1) * PER_PAGE + 1, total)}-{Math.min(page * PER_PAGE, total)} de {total}
                        </span>
                        <div className="flex gap-1">
                            <button className="page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
                            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                                const pg = Math.max(1, Math.min(page - 2, pages - 4)) + i;
                                if (pg > pages) return null;
                                return (
                                    <button key={pg} className={`page-btn ${pg === page ? 'active' : ''}`} onClick={() => setPage(pg)}>
                                        {pg}
                                    </button>
                                );
                            })}
                            <button className="page-btn" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}>›</button>
                        </div>
                    </div>
                )}
            </div>

            <ModalEntrada
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditData(null); }}
                editData={editData}
            />
        </div>
    );
}
