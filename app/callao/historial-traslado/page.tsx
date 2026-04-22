'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    useCallao,
    TIENDAS,
    OPERADORES,
    REGISTRADORES,
    OPS_TRASLADOS,
    COMBO_OTROS_VALUE,
    resolvePersonaCombo,
    ORIGENES_ALMACEN_SALIDA_ENTRADA_CALLAO,
    TIENDAS_ETIQUETA_MOVIMIENTOS_CALLAO,
    etiquetaTiendaMovimientosCallao,
    RegistroTraslado,
    Tienda,
    AlmacenCompleto,
    UnidadMedida,
    Producto,
    getOperacionColor,
} from '../../context/CallaoContext';
import {
    Search,
    PackagePlus,
    Edit3,
    X,
    Save,
    ChevronDown,
    ChevronRight,
    FileDown,
    FileSpreadsheet,
    Eye,
    FileImage,
    Upload,
    Trash2,
    Lock,
    Check,
    XCircle,
    Loader2,
    Image as ImageIcon,
    Calendar,
    Clock3,
    ArrowRightLeft
} from 'lucide-react';
import TableSkeleton from '../../components/TableSkeleton';
import ProductoAutocomplete from '../../components/ProductoAutocomplete';
import { exportToExcel, exportToPDF } from '../../utils/export';
import * as api from '../../services/api';

// ─── Modal Registro Traslado (Edición) ───────────────────
function ModalTraslado({
    isOpen,
    onClose,
    editData,
    onAccept,
}: {
    isOpen: boolean;
    onClose: () => void;
    editData?: RegistroTraslado | null;
    onAccept: (payload: { id: string; data: Partial<RegistroTraslado>; motivo: string }) => void;
}) {
    const { state, showToast } = useCallao();

    const [form, setForm] = useState({
        productoId: editData?.productoId ?? '',
        producto: editData?.producto ?? '',
        operacion: editData?.operacion ?? OPS_TRASLADOS[0],
        operacionPersonalizada: '',
        almacenSalida: (editData?.almacenSalida ?? 'ALMACEN MALVINAS') as AlmacenCompleto,
        almacenIngreso: (editData?.almacenIngreso ?? 'TIENDA OFICINA') as Tienda,
        operador: OPERADORES[0],
        operadorCustom: '',
        cantidad: editData?.cantidad ?? 0,
        unidadMedida: (editData?.unidadMedida ?? 'DOCENAS') as UnidadMedida,
        entregado: OPERADORES[0],
        entregadoCustom: '',
        registradoPor: REGISTRADORES[0],
        registradoCustom: '',
        observaciones: editData?.observaciones ?? '',
        motivoCambio: '',
    });

    const mapPersonaCombo = (valor: string | undefined, lista: readonly string[]) => {
        const v = (valor || '').trim();
        if (!v) return { sel: lista[0], custom: '' };
        const up = v.toUpperCase();
        const found = lista.find(x => x === up);
        if (found) return { sel: found, custom: '' };
        return { sel: COMBO_OTROS_VALUE, custom: v };
    };

    useEffect(() => {
        if (editData) {
            const producto = state.productos.find(p => 
                p.codigo === editData.producto || 
                p.nombre === editData.producto ||
                p.id === editData.productoId
            );
            const esOperacionPersonalizada = !OPS_TRASLADOS.includes(editData.operacion as any);
            const op = mapPersonaCombo(editData.operador, OPERADORES);
            const en = mapPersonaCombo(editData.entregado, OPERADORES);
            const reg = mapPersonaCombo(editData.registradoPor, REGISTRADORES);
            setForm({
                productoId: producto?.id || editData.productoId || '',
                producto: editData.producto,
                operacion: esOperacionPersonalizada ? 'OTROS' : editData.operacion,
                operacionPersonalizada: esOperacionPersonalizada ? editData.operacion : '',
                almacenSalida: editData.almacenSalida as AlmacenCompleto,
                almacenIngreso: editData.almacenIngreso as Tienda,
                operador: op.sel,
                operadorCustom: op.custom,
                cantidad: editData.cantidad,
                unidadMedida: producto?.unidadMedidaRegCalculo || editData.unidadMedida as UnidadMedida,
                entregado: en.sel,
                entregadoCustom: en.custom,
                registradoPor: reg.sel,
                registradoCustom: reg.custom,
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

    const handleSubmit = () => {
        if (!form.productoId) { showToast('error', 'Selecciona un producto'); return; }
        if (!form.cantidad || form.cantidad <= 0) { showToast('error', 'Ingresa una cantidad válida'); return; }
        if (!form.motivoCambio.trim()) { showToast('error', 'Ingresa el motivo del cambio'); return; }

        const operador = resolvePersonaCombo(form.operador, form.operadorCustom);
        const entregado = resolvePersonaCombo(form.entregado, form.entregadoCustom);
        const registradoPor = resolvePersonaCombo(form.registradoPor, form.registradoCustom);
        
        onAccept({
            id: editData!.id,
            data: {
                productoId: form.productoId,
                producto: form.producto,
                operacion: form.operacion === 'OTROS' ? 'OTROS' : form.operacion,
                almacenSalida: form.almacenSalida,
                almacenIngreso: form.almacenIngreso,
                operador,
                cantidad: Number(form.cantidad),
                unidadMedida: form.unidadMedida,
                entregado,
                registradoPor,
                observaciones: form.observaciones,
            },
            motivo: form.motivoCambio,
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 680, background: 'white', borderRadius: 16, padding: 0, overflow: 'hidden' }}>
                <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-[#002D5A]">
                            <ArrowRightLeft className="w-4 h-4" />
                        </div>
                        <div>
                            <h6 style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#002D5A' }}>Editar Traslado</h6>
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
                                onChange={e => setForm(f => ({ ...f, operacion: e.target.value }))}
                                className="form-input w-full p-2 border border-gray-200 rounded-lg text-xs"
                            >
                                {OPS_TRASLADOS.map(op => <option key={op}>{op}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Almacén Salida</label>
                            <select
                                value={form.almacenSalida}
                                onChange={e => setForm(f => ({ ...f, almacenSalida: e.target.value as AlmacenCompleto }))}
                                className="form-input w-full p-2 border border-gray-200 rounded-lg text-xs"
                            >
                                {ORIGENES_ALMACEN_SALIDA_ENTRADA_CALLAO.map(({ value, label }) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Almacén Ingreso</label>
                            <select
                                value={form.almacenIngreso}
                                onChange={e => setForm(f => ({ ...f, almacenIngreso: e.target.value as Tienda }))}
                                className="form-input w-full p-2 border border-gray-200 rounded-lg text-xs"
                            >
                                {TIENDAS_ETIQUETA_MOVIMIENTOS_CALLAO.map(({ tienda, label }) => (
                                    <option key={tienda} value={tienda}>{label}</option>
                                ))}
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
                        <div className="col-span-2">
                            <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Operador</label>
                            <select
                                value={form.operador}
                                onChange={e =>
                                    setForm(f => ({
                                        ...f,
                                        operador: e.target.value,
                                        operadorCustom: e.target.value !== COMBO_OTROS_VALUE ? '' : f.operadorCustom,
                                    }))
                                }
                                className="form-input w-full p-2 border border-gray-200 rounded-lg text-xs"
                            >
                                {OPERADORES.map(o => <option key={o} value={o}>{o}</option>)}
                                <option value={COMBO_OTROS_VALUE}>OTROS (especificar)</option>
                            </select>
                            {form.operador === COMBO_OTROS_VALUE && (
                                <input
                                    type="text"
                                    value={form.operadorCustom}
                                    onChange={e => setForm(f => ({ ...f, operadorCustom: e.target.value }))}
                                    className="form-input w-full p-2 border border-gray-200 rounded-lg text-xs mt-2"
                                    placeholder="Nombre del operador"
                                />
                            )}
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
                        <span>ACEPTAR</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Componente Principal ────────────────────────────────────────────────────
export default function HistorialTrasladoPage() {
    const { state, refreshTraslados, refreshHistorialTraslados, showToast, updateTraslado } = useCallao();
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const PER_PAGE = 30;

    const [modalOpen, setModalOpen] = useState(false);
    const [editData, setEditData] = useState<RegistroTraslado | null>(null);
    const [pendingUpdates, setPendingUpdates] = useState<Record<string, { data: Partial<RegistroTraslado>; motivo: string }>>({});
    const [updatingCodigo, setUpdatingCodigo] = useState<string | null>(null);
    const [modalPasswordOpen, setModalPasswordOpen] = useState(false);
    const [passwordAutorizacion, setPasswordAutorizacion] = useState('');
    const [cargaPendientePassword, setCargaPendientePassword] = useState<api.TrasladoCascadaDB | null>(null);
    const [idsPendientesPassword, setIdsPendientesPassword] = useState<string[]>([]);
    const [modalObsOpen, setModalObsOpen] = useState(false);
    const [observacionesSeleccionadas, setObservacionesSeleccionadas] = useState('');

    const [cargas, setCargas] = useState<api.TrasladoCascadaDB[]>([]);
    const [loadingCargas, setLoadingCargas] = useState(true);
    const [expandedCodigos, setExpandedCodigos] = useState<Set<string>>(new Set());

    const refreshCargas = async () => {
        setLoadingCargas(true);
        try {
            const data = await api.getTrasladosCascada();
            setCargas(data);
        } catch (error: any) {
            console.error('Error cargando traslados en cascada:', error);
            showToast('error', error.message || 'Error al cargar la vista en cascada');
        } finally {
            setLoadingCargas(false);
        }
    };

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await refreshTraslados();
            await refreshCargas();
            setLoading(false);
        };
        load();
    }, []);

    const filteredCargas = useMemo(() => {
        const q = search.toLowerCase();
        if (!q.trim()) return cargas;

        return cargas.filter(c => {
            const baseMatch =
                (c.codigo_carga || '').toLowerCase().includes(q) ||
                (c.operador || '').toLowerCase().includes(q);

            const detailMatch = c.detalles.some(d => {
                return (
                    (d.producto_nombre || '').toLowerCase().includes(q) ||
                    (d.operacion || '').toLowerCase().includes(q) ||
                    (d.tienda_salida_codigo || '').toLowerCase().includes(q) ||
                    (d.tienda_ingreso_codigo || '').toLowerCase().includes(q)
                );
            });

            return baseMatch || detailMatch;
        });
    }, [cargas, search]);

    const paginatedCargas = filteredCargas.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    const pagesCargas = Math.max(1, Math.ceil(filteredCargas.length / PER_PAGE));

    const openEdit = (t: RegistroTraslado) => {
        setEditData(t);
        setModalOpen(true);
    };

    const queueUpdate = (payload: { id: string; data: Partial<RegistroTraslado>; motivo: string }) => {
        setPendingUpdates(prev => ({ ...prev, [payload.id]: { data: payload.data, motivo: payload.motivo } }));
    };

    const ejecutarActualizacionCarga = async (carga: api.TrasladoCascadaDB, pendientes: string[]) => {
        try {
            setUpdatingCodigo(carga.codigo_carga || '__sin_codigo__');
            for (const id of pendientes) {
                const upd = pendingUpdates[id];
                await updateTraslado(id, upd.data, upd.motivo);
            }
            await Promise.all([refreshTraslados(), refreshHistorialTraslados(), refreshCargas()]);
            setPendingUpdates(prev => {
                const next = { ...prev };
                pendientes.forEach(id => delete next[id]);
                return next;
            });
            showToast('success', 'Registros actualizados');
        } finally {
            setUpdatingCodigo(null);
        }
    };

    const aplicarActualizacionCarga = async (carga: api.TrasladoCascadaDB) => {
        const idsCarga = carga.detalles.map(d => String(d.id));
        const pendientes = idsCarga.filter(id => pendingUpdates[id]);
        if (pendientes.length === 0) return;

        if (carga.actas.length === 0) {
            setCargaPendientePassword(carga);
            setIdsPendientesPassword(pendientes);
            setModalPasswordOpen(true);
            return;
        }

        await ejecutarActualizacionCarga(carga, pendientes);
    };

    const handleConfirmarPassword = async () => {
        const ingresada = passwordAutorizacion.trim();
        const conf = await api.obtenerPasswordMovimientos();
        if ((conf.password || '') !== ingresada) {
            showToast('error', 'Contraseña incorrecta');
            return;
        }
        setModalPasswordOpen(false);
        setPasswordAutorizacion('');
        if (cargaPendientePassword) {
            await ejecutarActualizacionCarga(cargaPendientePassword, idsPendientesPassword);
        }
    };

    return (
        <div id="view-historial-traslado" className="animate-in fade-in duration-500 font-poppins">
            <div className="container mx-auto">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6 transition-all">
                    <header className="flex justify-between items-center flex-wrap gap-4 mb-8">
                        <div className="flex items-center space-x-3">
                            <div className="w-11 h-11 bg-gradient-to-br from-[#002D5A] to-[#0056b3] rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-900/10 transition-transform hover:scale-110">
                                <ArrowRightLeft className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="font-bold text-gray-900 m-0 tracking-tight" style={{ fontSize: '18px' }}>
                                    Historial Traslado
                                </h1>
                                <p className="text-[11px] text-gray-400 mt-0.5 font-medium italic opacity-80">
                                    Consulta los movimientos de traslado agrupados por carga
                                </p>
                            </div>
                        </div>
                    </header>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 mb-2 bg-transparent">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <Search className="w-4 h-4 text-[#002D5A]" />
                            </div>
                            <span className="font-bold text-gray-800" style={{ fontSize: 13 }}>
                                Total: {filteredCargas.length} cargas
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

                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xl">
                        <div className="divide-y divide-gray-100">
                            {loadingCargas ? (
                                <div className="p-10 text-center text-gray-500 flex flex-col items-center gap-3">
                                    <Loader2 className="w-8 h-8 animate-spin text-[#002D5A]" />
                                    <span>Cargando datos...</span>
                                </div>
                            ) : paginatedCargas.length === 0 ? (
                                <div className="p-10 text-center text-gray-500">No se encontraron registros.</div>
                            ) : (
                                paginatedCargas.map((carga, idx) => {
                                    const cargaKey = `${carga.codigo_carga || 'sin-codigo'}-${idx}`;
                                    const isOpen = expandedCodigos.has(cargaKey);
                                    const pendientes = carga.detalles.filter(d => pendingUpdates[String(d.id)]);
                                    
                                    return (
                                        <div key={cargaKey} className="px-4">
                                            <div
                                                className="py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                                                onClick={() => setExpandedCodigos(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(cargaKey)) next.delete(cargaKey); else next.add(cargaKey);
                                                    return next;
                                                })}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-8 h-8 rounded-xl bg-[#002D5A] flex items-center justify-center text-white">
                                                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-bold text-gray-900 uppercase">Carga: {carga.codigo_carga || 'SIN CÓDIGO'}</span>
                                                        <span className="text-[10px] text-gray-500">{carga.fecha_primera}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    {pendientes.length > 0 && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); aplicarActualizacionCarga(carga); }}
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] font-black transition-all animate-pulse"
                                                        >
                                                            <Save className="w-3.5 h-3.5" />
                                                            APLICAR {pendientes.length} CAMBIOS
                                                        </button>
                                                    )}
                                                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                                                        {carga.detalles.length} ITEMS
                                                    </div>
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
                                                                        <th className="px-4 py-3 text-left font-bold w-[170px]">OPERACIÓN</th>
                                                                        <th className="px-4 py-3 text-left font-bold w-[90px]">CANT.</th>
                                                                        <th className="px-4 py-3 text-left font-bold w-[120px]">U. MEDIDA</th>
                                                                        <th className="px-4 py-3 text-left font-bold w-[110px]">SALIÓ DE</th>
                                                                        <th className="px-4 py-3 text-left font-bold w-[120px]">INGRESÓ A</th>
                                                                        <th className="px-4 py-3 text-left font-bold w-[100px]">OBS.</th>
                                                                        <th className="px-4 py-3 text-left font-bold w-[110px]">ACCIONES</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-100 bg-white">
                                                                    {carga.detalles.map((d, i) => {
                                                                        const idStr = String(d.id);
                                                                        const isPending = !!pendingUpdates[idStr];
                                                                        const registro: RegistroTraslado = {
                                                                            id: idStr,
                                                                            fecha: d.fecha_registro,
                                                                            productoId: '',
                                                                            producto: d.producto_nombre || '',
                                                                            operacion: d.operacion || '',
                                                                            almacenSalida: d.tienda_salida_codigo as AlmacenCompleto,
                                                                            almacenIngreso: d.tienda_ingreso_codigo as Tienda,
                                                                            operador: d.operador || '',
                                                                            cantidad: d.cantidad || 0,
                                                                            unidadMedida: d.unidad_medida as UnidadMedida,
                                                                            entregado: d.entregado_por || '',
                                                                            registradoPor: d.registrado_por || '',
                                                                            observaciones: d.observaciones || '',
                                                                        };

                                                                        return (
                                                                            <tr key={idStr} className={`border-t border-gray-100 text-[11px] transition-colors ${isPending ? 'bg-amber-50 border-l-4 border-l-amber-400' : 'hover:bg-blue-50/30'}`}>
                                                                                <td className="px-4 py-3 text-gray-800 font-medium">{d.producto_nombre}</td>
                                                                                <td className="px-4 py-3">
                                                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getOperacionColor(d.operacion || '').bg} ${getOperacionColor(d.operacion || '').text}`}>
                                                                                        {d.operacion}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="px-4 py-3 text-gray-700 font-semibold">{d.cantidad}</td>
                                                                                <td className="px-4 py-3 text-gray-600">{d.unidad_medida}</td>
                                                                                <td className="px-4 py-3 text-gray-700">{d.tienda_salida_codigo}</td>
                                                                                <td className="px-4 py-3 text-gray-700">{d.tienda_ingreso_codigo}</td>
                                                                                <td className="px-4 py-3">
                                                                                    {(() => {
                                                                                        const obs = d.observaciones || '';
                                                                                        const tieneObs = obs.trim().length > 0;
                                                                                        return (
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    setObservacionesSeleccionadas(obs || '-');
                                                                                                    setModalObsOpen(true);
                                                                                                }}
                                                                                                className={`inline-flex items-center justify-center w-[46px] h-[28px] rounded-lg transition-colors ${
                                                                                                    tieneObs
                                                                                                        ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                                                                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                                                                }`}
                                                                                                title="Ver observaciones"
                                                                                            >
                                                                                                <Eye className="w-4 h-4" />
                                                                                            </button>
                                                                                        );
                                                                                    })()}
                                                                                </td>
                                                                                <td className="px-4 py-3">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => openEdit(registro)}
                                                                                        className="inline-flex items-center justify-center w-[46px] h-[28px] rounded-lg bg-blue-50 text-[#002D5A] hover:bg-blue-100 transition-colors"
                                                                                        title="Editar traslado"
                                                                                    >
                                                                                        <Edit3 className="w-4 h-4" />
                                                                                    </button>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
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

                        <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-100">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Página {page} de {pagesCargas}</span>
                            <div className="flex gap-2">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 bg-white border rounded text-xs disabled:opacity-50 hover:bg-gray-50 transition-colors font-bold uppercase">Anterior</button>
                                <button onClick={() => setPage(p => Math.min(pagesCargas, p + 1))} disabled={page === pagesCargas} className="px-3 py-1 bg-white border rounded text-xs disabled:opacity-50 hover:bg-gray-50 transition-colors font-bold uppercase">Siguiente</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ModalTraslado isOpen={modalOpen} onClose={() => setModalOpen(false)} editData={editData} onAccept={queueUpdate} />

            {modalObsOpen && (
                <div className="modal-backdrop z-[9999]" onClick={() => setModalObsOpen(false)}>
                    <div className="modal-box max-w-lg bg-white rounded-2xl p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4 border-b pb-3">
                            <h3 className="text-lg font-black text-[#002D5A] m-0">OBSERVACIONES</h3>
                            <button onClick={() => setModalObsOpen(false)}><X className="w-5 h-5 text-gray-400" /></button>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{observacionesSeleccionadas}</p>
                        <div className="mt-6 flex justify-end">
                            <button onClick={() => setModalObsOpen(false)} className="px-6 py-2 bg-[#002D5A] text-white rounded-xl font-bold text-xs transition-all active:scale-95">CERRAR</button>
                        </div>
                    </div>
                </div>
            )}

            {modalPasswordOpen && (
                <div className="modal-backdrop z-[10000]" onClick={() => setModalPasswordOpen(false)}>
                    <div className="modal-box max-w-md bg-white rounded-3xl p-8 text-center shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mx-auto mb-4">
                            <Lock className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-gray-900 mb-2">AUTORIZACIÓN</h3>
                        <p className="text-xs text-gray-500 font-bold mb-6 px-4 uppercase tracking-widest">Se requiere contraseña para aplicar cambios en una carga sin actas</p>
                        <input 
                            type="password" 
                            value={passwordAutorizacion} 
                            onChange={e => setPasswordAutorizacion(e.target.value)} 
                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-center text-lg font-bold tracking-widest focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none mb-6" 
                            placeholder="••••••" 
                            autoFocus 
                        />
                        <div className="flex flex-col gap-2">
                            <button onClick={handleConfirmarPassword} className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-xs transition-all active:scale-95">CONFIRMAR CAMBIOS</button>
                            <button onClick={() => setModalPasswordOpen(false)} className="w-full py-3 text-[10px] font-black text-gray-400 hover:text-gray-600 uppercase tracking-widest transition-all">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
