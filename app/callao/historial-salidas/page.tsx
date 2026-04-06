'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    useCallao,
    TIENDAS,
    TIENDAS_ETIQUETA_MOVIMIENTOS_CALLAO,
    etiquetaTiendaMovimientosCallao,
    REGISTRADORES,
    OPS_SALIDA,
    RegistroSalida,
    Tienda,
    UnidadMedida,
    Producto,
    getOperacionColor,
} from '../../context/CallaoContext';
import {
    Search,
    PackageMinus,
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
    Clock3
} from 'lucide-react';
import TableSkeleton from '../../components/TableSkeleton';
import ProductoAutocomplete from '../../components/ProductoAutocomplete';
import { exportToExcel, exportToPDF } from '../../utils/export';
import * as api from '../../services/api';

// ─── Modal Salida (Copia para edición) ────────────────────────────────────────
function ModalSalida({
    isOpen,
    onClose,
    editData,
    onAccept,
}: {
    isOpen: boolean;
    onClose: () => void;
    editData?: RegistroSalida | null;
    onAccept: (payload: { id: string; data: Partial<RegistroSalida>; motivo: string }) => void;
}) {
    const { state, showToast } = useCallao();

    const [form, setForm] = useState({
        productoId: editData?.productoId ?? '',
        producto: editData?.producto ?? '',
        operacion: editData?.operacion ?? OPS_SALIDA[0],
        operacionPersonalizada: '',
        comprobante: editData?.comprobante ?? '',
        asesor: editData?.asesor ?? '',
        cantidad: editData?.cantidad ?? 0,
        unidadMedida: (editData?.unidadMedida ?? 'DOCENAS') as UnidadMedida,
        almacen: (editData?.almacen ?? 'TIENDA OFICINA') as Tienda,
        entregado: editData?.entregado ?? '',
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
            const esOperacionPersonalizada = !OPS_SALIDA.includes(editData.operacion as any);
            setForm({
                productoId: producto?.id || editData.productoId || '',
                producto: editData.producto,
                operacion: esOperacionPersonalizada ? 'OTROS' : editData.operacion,
                operacionPersonalizada: esOperacionPersonalizada ? editData.operacion : '',
                comprobante: editData.comprobante,
                asesor: editData.asesor,
                cantidad: editData.cantidad,
                unidadMedida: producto?.unidadMedidaRegCalculo || editData.unidadMedida as UnidadMedida,
                almacen: editData.almacen as Tienda,
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

    const handleSubmit = () => {
        if (!form.productoId) { showToast('error', 'Selecciona un producto'); return; }
        if (!form.cantidad || form.cantidad <= 0) { showToast('error', 'Ingresa una cantidad válida'); return; }
        if (!form.motivoCambio.trim()) { showToast('error', 'Ingresa el motivo del cambio'); return; }
        if (form.operacion === 'OTROS' && !form.operacionPersonalizada.trim()) {
            showToast('error', 'Especifica el nombre de la operación');
            return;
        }

        onAccept({
            id: editData!.id,
            data: {
                productoId: form.productoId,
                producto: form.producto,
                operacion: form.operacion === 'OTROS' ? form.operacionPersonalizada : form.operacion,
                comprobante: form.comprobante,
                asesor: form.asesor,
                cantidad: Number(form.cantidad),
                unidadMedida: form.unidadMedida,
                almacen: form.almacen,
                entregado: form.entregado,
                registradoPor: form.registradoPor,
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
                        {selectedProducto && (
                            <div className="col-span-2">
                                <label className="form-label" style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6 }}>
                                    Existencia Almacén
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {TIENDAS.map(tienda => {
                                        const existencia = selectedProducto.existencia[tienda] || 0;
                                        const stockMinimo = selectedProducto.stockMinimo[tienda] || 0;
                                        const bajoStock = existencia < stockMinimo && stockMinimo > 0;
                                        return (
                                            <div
                                                key={tienda}
                                                className={`p-3 rounded-lg border-2 transition-all ${
                                                    bajoStock ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
                                                }`}
                                            >
                                                <div className="text-[9px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                                                    {etiquetaTiendaMovimientosCallao(tienda)}
                                                </div>
                                                <div className={`text-lg font-black ${bajoStock ? 'text-red-700' : 'text-blue-700'}`}>
                                                    {existencia}
                                                </div>
                                                {stockMinimo > 0 && (
                                                    <div className="text-[8px] text-gray-500 mt-0.5">
                                                        Mín: {stockMinimo}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        <div>
                            <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Operación *</label>
                            <select
                                value={form.operacion}
                                onChange={e => setForm(f => ({ ...f, operacion: e.target.value, operacionPersonalizada: e.target.value !== 'OTROS' ? '' : f.operacionPersonalizada }))}
                                className="form-input w-full p-2 border border-gray-200 rounded-lg text-xs"
                            >
                                {OPS_SALIDA.map(op => <option key={op}>{op}</option>)}
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
                            <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Almacén</label>
                            <select
                                value={form.almacen}
                                onChange={e => setForm(f => ({ ...f, almacen: e.target.value as Tienda }))}
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
                        <span>ACEPTAR</span>
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

export default function HistorialSalidasPage() {
    const { state, refreshSalidas, refreshHistorialSalidas, showToast, updateSalida } = useCallao();
    const [search, setSearch] = useState('');
    const [searchUnlocked, setSearchUnlocked] = useState(false);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const PER_PAGE = 30;

    const [modalOpen, setModalOpen] = useState(false);
    const [editData, setEditData] = useState<RegistroSalida | null>(null);
    const [pendingUpdates, setPendingUpdates] = useState<Record<string, { data: Partial<RegistroSalida>; motivo: string }>>({});
    const [updatingCodigo, setUpdatingCodigo] = useState<string | null>(null);
    const [modalPasswordOpen, setModalPasswordOpen] = useState(false);
    const [passwordAutorizacion, setPasswordAutorizacion] = useState('');
    const [cargaPendientePassword, setCargaPendientePassword] = useState<api.SalidaCascadaDB | null>(null);
    const [idsPendientesPassword, setIdsPendientesPassword] = useState<string[]>([]);
    const [modalObsOpen, setModalObsOpen] = useState(false);
    const [observacionesSeleccionadas, setObservacionesSeleccionadas] = useState('');
    const [modalConfirmacionOpen, setModalConfirmacionOpen] = useState(false);
    const [cargaConfirmacion, setCargaConfirmacion] = useState<api.SalidaCascadaDB | null>(null);

    // ─── Vista Cascada (Agrupación por código_carga) ──────────────────────────
    const [cargas, setCargas] = useState<api.SalidaCascadaDB[]>([]);
    const [loadingCargas, setLoadingCargas] = useState(true);
    const [expandedCodigos, setExpandedCodigos] = useState<Set<string>>(new Set());

    // ─── Actas (Ver / Subir) ─────────────────────────────────────────────────
    const [modalVerActasOpen, setModalVerActasOpen] = useState(false);
    const [actasSeleccionadas, setActasSeleccionadas] = useState<api.ActaMovimientoDB[]>([]);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

    const [modalSubirActasOpen, setModalSubirActasOpen] = useState(false);
    const [repIdActasSalida, setRepIdActasSalida] = useState<number | null>(null);
    const [actasParaSubir, setActasParaSubir] = useState<Array<{ file: File; nombre: string; preview: string }>>([]);
    const [subiendoActas, setSubiendoActas] = useState(false);

    // Cargar salidas al montar el componente
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await refreshSalidas();
            setLoading(false);
        };
        loadData();
    }, [refreshSalidas]);

    const refreshCargas = async () => {
        setLoadingCargas(true);
        try {
            const data = await api.getSalidasCascada();
            setCargas(data);
        } catch (error: any) {
            console.error('Error cargando salidas en cascada:', error);
            showToast('error', error.message || 'Error al cargar la vista en cascada');
        } finally {
            setLoadingCargas(false);
        }
    };

    useEffect(() => {
        refreshCargas();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return state.salidas.filter(
            e => e.producto.toLowerCase().includes(q) ||
                e.operacion.toLowerCase().includes(q) ||
                e.almacen.toLowerCase().includes(q) ||
                (e.comprobante && e.comprobante.toLowerCase().includes(q))
        );
    }, [state.salidas, search]);

    const filteredCargas = useMemo(() => {
        const q = search.toLowerCase();
        if (!q.trim()) return cargas;

        return cargas.filter(c => {
            const baseMatch =
                (c.codigo_carga || '').toLowerCase().includes(q) ||
                (c.asesor || '').toLowerCase().includes(q);

            const detailMatch = c.detalles.some(d => {
                return (
                    (d.producto_nombre || '').toLowerCase().includes(q) ||
                    (d.operacion || '').toLowerCase().includes(q) ||
                    (d.tienda_codigo || '').toLowerCase().includes(q) ||
                    (d.asesor || '').toLowerCase().includes(q) ||
                    (d.nro_comprobante || '').toLowerCase().includes(q)
                );
            });

            return baseMatch || detailMatch;
        });
    }, [cargas, search]);

    const totalCargas = filteredCargas.length;
    const pagesCargas = Math.max(1, Math.ceil(totalCargas / PER_PAGE));
    const paginatedCargas = filteredCargas.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    useEffect(() => {
        const keys = paginatedCargas.map((carga, idx) => `${carga.codigo_carga || 'sin-codigo'}-${idx}`);
        setExpandedCodigos(prev => {
            if (prev.size === keys.length && keys.every(k => prev.has(k))) return prev;
            return new Set(keys);
        });
    }, [paginatedCargas]);

    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    const openEdit = (e: RegistroSalida) => {
        setEditData(e);
        setModalOpen(true);
    };

    const queueUpdate = (payload: { id: string; data: Partial<RegistroSalida>; motivo: string }) => {
        setPendingUpdates(prev => ({ ...prev, [payload.id]: { data: payload.data, motivo: payload.motivo } }));
        const carga = cargas.find(c => c.detalles.some(d => String(d.id) === payload.id)) || null;
        setCargaConfirmacion(carga);
        setModalConfirmacionOpen(true);
    };

    const ejecutarActualizacionCarga = async (carga: api.SalidaCascadaDB, pendientes: string[]) => {
        try {
            setUpdatingCodigo(carga.codigo_carga || '__sin_codigo__');
            for (const id of pendientes) {
                const upd = pendingUpdates[id];
                await updateSalida(id, upd.data, upd.motivo);
            }
            await Promise.all([refreshSalidas(), refreshHistorialSalidas(), refreshCargas()]);
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

    const confirmarPasswordActualizacion = async () => {
        if (!cargaPendientePassword || idsPendientesPassword.length === 0) return;
        const ingresada = passwordAutorizacion.trim();
        if (!ingresada) {
            showToast('error', 'Ingresa la contraseña');
            return;
        }
        const conf = await api.obtenerPasswordMovimientos();
        if ((conf.password || '') !== ingresada) {
            showToast('error', 'Contraseña incorrecta');
            return;
        }
        setModalPasswordOpen(false);
        setPasswordAutorizacion('');
        await ejecutarActualizacionCarga(cargaPendientePassword, idsPendientesPassword);
        setCargaPendientePassword(null);
        setIdsPendientesPassword([]);
    };

    const aplicarActualizacionCarga = async (carga: api.SalidaCascadaDB) => {
        if (updatingCodigo) return;
        const idsCarga = carga.detalles.map(d => String(d.id));
        const pendientes = idsCarga.filter(id => pendingUpdates[id]);
        if (pendientes.length === 0) {
            showToast('error', 'No hay cambios pendientes en esta carga');
            return;
        }

        if (carga.actas.length === 0) {
            setCargaPendientePassword(carga);
            setIdsPendientesPassword(pendientes);
            setPasswordAutorizacion('');
            setModalPasswordOpen(true);
            return;
        }

        await ejecutarActualizacionCarga(carga, pendientes);
    };

    const refreshActasSelectionReset = () => {
        setActasParaSubir(prev => {
            prev.forEach(a => URL.revokeObjectURL(a.preview));
            return [];
        });
    };

    const handleFileSelectSubirActas = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const nuevas = files.map(file => ({
            file,
            nombre: file.name.replace(/\.[^/.]+$/, ''),
            preview: URL.createObjectURL(file),
        }));
        setActasParaSubir(prev => [...prev, ...nuevas]);
        e.target.value = '';
    };

    const handleRemoveActaParaSubir = (index: number) => {
        setActasParaSubir(prev => {
            const nueva = [...prev];
            URL.revokeObjectURL(nueva[index].preview);
            nueva.splice(index, 1);
            return nueva;
        });
    };

    const handleUpdateNombreActaParaSubir = (index: number, nuevoNombre: string) => {
        setActasParaSubir(prev => {
            const nueva = [...prev];
            nueva[index] = { ...nueva[index], nombre: nuevoNombre };
            return nueva;
        });
    };

    const guardarActasSalida = async () => {
        if (subiendoActas) return;
        if (!repIdActasSalida) {
            showToast('error', 'No se encontró el registro de referencia para subir actas');
            return;
        }
        if (actasParaSubir.length === 0) {
            showToast('error', 'Selecciona al menos una imagen');
            return;
        }
        const sinNombre = actasParaSubir.some(a => !a.nombre.trim());
        if (sinNombre) {
            showToast('error', 'Por favor asigna un nombre a todas las actas');
            return;
        }

        try {
            setSubiendoActas(true);
            await api.agregarActaSalida(
                repIdActasSalida,
                actasParaSubir.map(a => ({ file: a.file, nombre: a.nombre }))
            );

            actasParaSubir.forEach(a => URL.revokeObjectURL(a.preview));
            setActasParaSubir([]);
            setModalSubirActasOpen(false);
            setRepIdActasSalida(null);
            await refreshCargas();
            showToast('success', 'Actas subidas exitosamente');
        } catch (error: any) {
            console.error('Error subiendo actas salida:', error);
            showToast('error', error.message || 'Error al subir las actas');
        } finally {
            setSubiendoActas(false);
        }
    };

    const handleExportExcel = () => {
        const columns = [
            { header: 'Fecha', key: 'fecha' },
            { header: 'Producto', key: 'producto' },
            { header: 'Operación', key: 'operacion' },
            { header: 'Comprobante', key: 'comprobante' },
            { header: 'Asesor', key: 'asesor' },
            { header: 'Cantidad', key: 'cantidad' },
            { header: 'Unidad Medida', key: 'unidadMedida' },
            { header: 'Almacén', key: 'almacen' },
            { header: 'Entregado', key: 'entregado' },
            { header: 'Registrado Por', key: 'registradoPor' },
            { header: 'Observaciones', key: 'observaciones' },
            { header: 'Actualizado', key: 'updatedAt' },
        ];
        exportToExcel(filtered, columns, `Historial_Salidas_${new Date().toISOString().split('T')[0]}`);
    };

    const handleExportPDF = () => {
        const columns = [
            { header: 'Fecha', dataKey: 'fecha' },
            { header: 'Producto', dataKey: 'producto' },
            { header: 'Operación', dataKey: 'operacion' },
            { header: 'Comprobante', dataKey: 'comprobante' },
            { header: 'Asesor', dataKey: 'asesor' },
            { header: 'Cantidad', dataKey: 'cantidad' },
            { header: 'Unidad Medida', dataKey: 'unidadMedida' },
            { header: 'Almacén', dataKey: 'almacen' },
            { header: 'Entregado', dataKey: 'entregado' },
            { header: 'Registrado Por', dataKey: 'registradoPor' },
            { header: 'Observaciones', dataKey: 'observaciones' },
            { header: 'Actualizado', dataKey: 'updatedAt' },
        ];
        exportToPDF(filtered, columns, `Historial_Salidas_${new Date().toISOString().split('T')[0]}`, 'Historial de Salidas');
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
                                <div className="p-2 bg-pink-50 rounded-lg">
                                    <Search className="w-4 h-4 text-[#9d174d]" />
                                </div>
                                <span className="font-bold text-gray-800" style={{ fontSize: 13 }}>Total: {totalCargas} cargas</span>
                            </div>
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <div className="relative flex-1 sm:w-72">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        name="buscar_historial_salidas"
                                        autoComplete="new-password"
                                        data-lpignore="true"
                                        spellCheck={false}
                                        readOnly={!searchUnlocked}
                                        onFocus={() => setSearchUnlocked(true)}
                                        onPointerDown={() => setSearchUnlocked(true)}
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
                                {loadingCargas ? (
                                    <div className="p-10 text-center text-gray-500">
                                        Cargando datos en cascada...
                                    </div>
                                ) : totalCargas === 0 ? (
                                    <div className="p-10 text-center text-gray-500">
                                        No se encontraron cargas para el criterio seleccionado.
                                    </div>
                                ) : (
                                paginatedCargas.map((carga, idx) => {
                                        const detalleRep = carga.detalles[0];
                                        const repSalida = detalleRep
                                            ? state.salidas.find(en => en.id === String(detalleRep.id)) || null
                                            : null;
                                        const cargaKey = `${carga.codigo_carga || 'sin-codigo'}-${idx}`;
                                        const isOpen = expandedCodigos.has(cargaKey);
                                        const { fecha, hora } = formatFechaDosLineas(carga.fecha_primera);
                                        // Contador de "productos agregados" = cantidad de renglones en el detalle.
                                        const itemsTotales = carga.detalles.length;
                                        const movimiento = `${detalleRep?.tienda_codigo || '-'}`;
                                        const asesor = detalleRep?.asesor || carga.asesor || '-';
                                        const operacion = detalleRep?.operacion || '';

                                        return (
                                            <div key={cargaKey} className="px-4">
                                                <div
                                                    className="py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                                                    onClick={() =>
                                                        setExpandedCodigos(prev => {
                                                            const next = new Set(prev);
                                                            if (next.has(cargaKey)) next.delete(cargaKey);
                                                            else next.add(cargaKey);
                                                            return next;
                                                        })
                                                    }
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-8 h-8 rounded-xl bg-[#002D5A] flex items-center justify-center text-white">
                                                            {isOpen ? (
                                                                <ChevronDown className="w-4 h-4" />
                                                            ) : (
                                                                <ChevronRight className="w-4 h-4" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-3 flex-wrap text-[11px] font-semibold text-gray-900">
                                                                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                                                                    <Calendar className="w-3.5 h-3.5 text-[#002D5A]" />
                                                                    <span className="text-[10px] text-gray-500 uppercase tracking-widest">Fecha</span>
                                                                    <span>{fecha}</span>
                                                                </span>
                                                                <span className="hidden sm:block w-px h-4 bg-gray-300" />
                                                                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                                                                    <Clock3 className="w-3.5 h-3.5 text-[#002D5A]" />
                                                                    <span className="text-[10px] text-gray-500 uppercase tracking-widest">Hora</span>
                                                                    <span>{hora || '-'}</span>
                                                                </span>
                                                                {/* Operación ya se muestra en la tabla interna */}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-4 text-[10px] text-gray-600 whitespace-nowrap flex-shrink-0">
                                                        <span className="inline-flex items-center gap-2">
                                                            <PackageMinus className="w-4 h-4 text-[#002D5A]" />
                                                            <span className="font-bold text-gray-900">{itemsTotales}</span> productos
                                                        </span>
                                                        <span className="inline-flex items-center gap-2">
                                                            <FileImage className="w-4 h-4 text-[#002D5A]" />
                                                            <span className="font-bold text-gray-900">{carga.actas.length}</span> actas
                                                        </span>
                                                    </div>
                                                </div>

                                                {isOpen && (
                                                    <div className="pb-5">
                                                        <div className="bg-white rounded-2xl border border-gray-100 p-4">
                                                            <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 mb-4">
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full xl:flex-1">
                                                                <div className="w-full sm:w-[180px]">
                                                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">REGISTRADOR</div>
                                                                    <div className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-[12px] font-bold text-gray-900">
                                                                        {detalleRep?.registrado_por || '-'}
                                                                    </div>
                                                                </div>
                                                                <div className="w-full sm:w-[180px]">
                                                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">ENTREGADO</div>
                                                                    <div className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-[12px] font-bold text-gray-900">
                                                                        {detalleRep?.entregado_por || '-'}
                                                                    </div>
                                                                </div>
                                                                <div className="w-full sm:w-[180px]">
                                                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">OPERADOR</div>
                                                                    <div className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-[12px] font-bold text-gray-900">
                                                                        {detalleRep?.asesor || carga.asesor || '-'}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                                <div className="w-full xl:w-auto flex flex-wrap items-center justify-end gap-2">
                                                                    <div className="inline-flex items-center gap-1 text-[10px] text-gray-500 whitespace-nowrap">
                                                                        <span>Actas:</span>
                                                                        <span className="text-gray-900 font-bold">{carga.actas.length}</span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => {
                                                                            setRepIdActasSalida(detalleRep?.id || null);
                                                                            setActasSeleccionadas(carga.actas);
                                                                            setModalVerActasOpen(true);
                                                                        }}
                                                                        disabled={carga.actas.length === 0}
                                                                        className="px-4 py-2 text-[10px] rounded-xl font-bold bg-[#002D5A] hover:bg-[#001f3d] text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 whitespace-nowrap"
                                                                    >
                                                                        <FileImage className="w-3.5 h-3.5" />
                                                                        <span>Ver actas</span>
                                                                    </button>
                                                                    {carga.actas.length === 0 && (
                                                                        <button
                                                                            onClick={() => {
                                                                                setRepIdActasSalida(detalleRep?.id || null);
                                                                                setModalSubirActasOpen(true);
                                                                            }}
                                                                            className="px-4 py-2 text-[10px] rounded-xl font-bold bg-white border border-[#002D5A] text-[#002D5A] hover:bg-blue-50 transition-all shadow-sm whitespace-nowrap inline-flex items-center gap-2"
                                                                        >
                                                                            <Upload className="w-3.5 h-3.5" />
                                                                            <span>Agregar acta</span>
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={() => aplicarActualizacionCarga(carga)}
                                                                        disabled={updatingCodigo === (carga.codigo_carga || '__sin_codigo__')}
                                                                        className="px-4 py-2 text-[10px] rounded-xl font-bold bg-[#002D5A] hover:bg-[#001f3d] text-white transition-all shadow-sm whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
                                                                    >
                                                                        {updatingCodigo === (carga.codigo_carga || '__sin_codigo__') && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                                                        {updatingCodigo !== (carga.codigo_carga || '__sin_codigo__') && <Save className="w-3.5 h-3.5" />}
                                                                        <span>{updatingCodigo === (carga.codigo_carga || '__sin_codigo__') ? 'Actualizando...' : 'Actualizar registro'}</span>
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Tabla interna */}
                                                            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                                                <div className="overflow-x-auto">
                                                                    <table className="w-full text-sm">
                                                                        <thead className="bg-[#002D5A] text-white">
                                                                            <tr className="text-[9px] uppercase">
                                                                                <th className="px-4 py-3 text-left font-bold">PRODUCTO</th>
                                                                                <th className="px-4 py-3 text-left font-bold w-[160px]">OPERACIÓN</th>
                                                                                <th className="px-4 py-3 text-left font-bold w-[90px]">CANT.</th>
                                                                                <th className="px-4 py-3 text-left font-bold w-[120px]">U. MEDIDA</th>
                                                                                <th className="px-4 py-3 text-left font-bold w-[120px]">ALMACÉN</th>
                                                                                <th className="px-4 py-3 text-left font-bold w-[140px]">N° COMPROBANTE</th>
                                                                                <th className="px-4 py-3 text-left font-bold w-[100px]">OBS.</th>
                                                                                <th className="px-4 py-3 text-left font-bold w-[110px]">ACCIONES</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {carga.detalles.map(d => (
                                                                                <tr
                                                                                    key={d.id}
                                                                                    className="border-t border-gray-100 text-[11px] hover:bg-blue-50/30 transition-colors"
                                                                                >
                                                                                    <td className="px-4 py-3 text-gray-800 font-medium">{d.producto_nombre}</td>
                                                                                    <td className="px-4 py-3">
                                                                                        {(() => {
                                                                                            const op = d.operacion || operacion || '-';
                                                                                            const color = getOperacionColor(op);
                                                                                            return (
                                                                                                <span
                                                                                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${color.bg} ${color.text}`}
                                                                                                >
                                                                                                    {op}
                                                                                                </span>
                                                                                            );
                                                                                        })()}
                                                                                    </td>
                                                                                    <td className="px-4 py-3 text-gray-700 font-semibold">{d.cantidad}</td>
                                                                                    <td className="px-4 py-3 text-gray-600">{d.unidad_medida}</td>
                                                                                    <td className="px-4 py-3 text-gray-700">{d.tienda_codigo}</td>
                                                                                    <td className="px-4 py-3 text-gray-700">{d.nro_comprobante || '-'}</td>
                                                                                    <td>
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
                                                                                            onClick={() => {
                                                                                                const salidaParaEditar =
                                                                                                    state.salidas.find(s => s.id === String(d.id)) || null;
                                                                                                if (salidaParaEditar) openEdit(salidaParaEditar);
                                                                                            }}
                                                                                            className="inline-flex items-center justify-center w-[46px] h-[28px] rounded-lg bg-blue-50 text-[#002D5A] hover:bg-blue-100 transition-colors"
                                                                                            title="Editar salida"
                                                                                        >
                                                                                            <Edit3 className="w-4 h-4" />
                                                                                        </button>
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Pagination cascadas */}
                            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 flex items-center justify-between border-t border-gray-100">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setPage(1)}
                                        disabled={page === 1}
                                        className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    >
                                        «
                                    </button>
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    >
                                        ‹
                                    </button>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[11px] text-gray-700 font-bold uppercase tracking-widest">
                                        Página {page} de {pagesCargas}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setPage(p => Math.min(pagesCargas, p + 1))}
                                        disabled={page === pagesCargas}
                                        className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    >
                                        ›
                                    </button>
                                    <button
                                        onClick={() => setPage(pagesCargas)}
                                        disabled={page === pagesCargas}
                                        className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    >
                                        »
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Modal Ver Actas (Vista Actas) */}
            {modalVerActasOpen && (
                <div
                    className="modal-backdrop animate-in fade-in duration-200"
                    style={{ zIndex: 30001 }}
                    onClick={e => e.target === e.currentTarget && setModalVerActasOpen(false)}
                >
                    <div className="modal-box" style={{ maxWidth: 1100, width: '95vw', maxHeight: '90vh', overflow: 'auto', zIndex: 30002 }}>
                        <div className="modal-header">
                            <div>
                                <h6 style={{ margin: 0, fontWeight: 800, fontSize: 16, color: '#002D5A' }}>
                                    Actas de Salida
                                </h6>
                                <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>
                                    {actasSeleccionadas.length} acta(s) seleccionada(s)
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setModalVerActasOpen(false);
                                    setLightboxUrl(null);
                                }}
                                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="px-6 pt-3">
                            <button
                                onClick={() => {
                                    if (!repIdActasSalida) {
                                        showToast('error', 'No se encontró la referencia de la carga');
                                        return;
                                    }
                                    setModalVerActasOpen(false);
                                    setModalSubirActasOpen(true);
                                }}
                                className="px-4 py-2 text-[11px] rounded-xl font-bold bg-[#002D5A] hover:bg-[#001f3d] text-white transition-all"
                            >
                                Agregar acta
                            </button>
                        </div>

                        <div className="modal-body">
                            {actasSeleccionadas.length === 0 ? (
                                <div className="py-12 flex flex-col items-center text-center">
                                    <FileImage className="w-12 h-12 text-gray-300 mb-4" />
                                    <p className="text-sm font-semibold text-gray-600">No hay actas para esta carga</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {actasSeleccionadas.map(acta => (
                                        <div
                                            key={acta.id}
                                            className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                            onClick={() => setLightboxUrl(acta.url_imagen)}
                                        >
                                            <div className="relative aspect-video bg-gray-100">
                                                <img
                                                    src={acta.url_imagen}
                                                    alt={acta.nombre_imagen}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src =
                                                            'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23e5e7eb" width="400" height="300"/%3E%3Ctext fill="%239ca3af" font-family="sans-serif" font-size="18" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImagen no disponible%3C/text%3E%3C/svg%3E';
                                                    }}
                                                />
                                            </div>
                                            <div className="p-3">
                                                <div className="text-[11px] font-bold text-gray-900 line-clamp-2">
                                                    {acta.nombre_imagen}
                                                </div>
                                                <div className="text-[9px] text-gray-500 mt-1">
                                                    {acta.fecha_subida
                                                        ? new Date(acta.fecha_subida).toLocaleString('es-PE', {
                                                            day: '2-digit',
                                                            month: '2-digit',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })
                                                        : '-'}
                                                </div>
                                                <div className="text-[9px] text-gray-500 mt-1">
                                                    Registrado por: <span className="font-semibold">{acta.registrado_por || '-'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox */}
            {lightboxUrl && (
                <div
                    className="modal-backdrop animate-in fade-in duration-300"
                    style={{ zIndex: 30003 }}
                    onClick={() => setLightboxUrl(null)}
                >
                    <div className="relative w-full h-full flex items-center justify-center p-4">
                        <button
                            onClick={() => setLightboxUrl(null)}
                            className="absolute top-4 right-4 p-2 bg-white/90 hover:bg-white rounded-full transition-colors z-10 shadow"
                        >
                            <X className="w-6 h-6 text-gray-700" />
                        </button>
                        <img
                            src={lightboxUrl}
                            alt="Acta completa"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23e5e7eb" width="400" height="300"/%3E%3Ctext fill="%239ca3af" font-family="sans-serif" font-size="18" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImagen no disponible%3C/text%3E%3C/svg%3E';
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Modal Subir Actas (Subir más) */}
            {modalSubirActasOpen && (
                <div
                    className="modal-backdrop"
                    style={{ zIndex: 30005 }}
                    onClick={e => e.target === e.currentTarget && setModalSubirActasOpen(false)}
                >
                    <div className="modal-box" style={{ maxWidth: 920, width: '95vw', maxHeight: '90vh', overflow: 'auto', zIndex: 30006 }}>
                        <div className="modal-header">
                            <div>
                                <h6 style={{ margin: 0, fontWeight: 800, fontSize: 16, color: '#002D5A' }}>
                                    Subir Actas (Salida)
                                </h6>
                                <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>
                                    Selecciona imágenes y asigna un nombre a cada una
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    refreshActasSelectionReset();
                                    setModalSubirActasOpen(false);
                                    setRepIdActasSalida(null);
                                }}
                                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="mb-6">
                                <label className="block mb-2 text-sm font-semibold text-gray-700">
                                    Seleccionar Imágenes
                                </label>
                                <div className="border-2 border-dashed border-[#002D5A]/30 rounded-xl p-4 text-center hover:border-[#002D5A]/50 transition-colors bg-[#002D5A]/5">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handleFileSelectSubirActas}
                                        className="hidden"
                                        id="file-input-actas-subir-salidas"
                                    />
                                    <label
                                        htmlFor="file-input-actas-subir-salidas"
                                        className="cursor-pointer flex flex-col items-center gap-2"
                                    >
                                        <div className="w-12 h-12 bg-[#002D5A] rounded-full flex items-center justify-center">
                                            <Upload className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <span className="text-[#002D5A] font-bold text-xs">Haz clic para seleccionar</span>
                                            <span className="text-gray-500 text-[10px] block mt-0.5">o arrastra las imágenes aquí</span>
                                        </div>
                                        <span className="text-[10px] text-gray-400">Formatos: JPG, PNG, WEBP</span>
                                    </label>
                                </div>
                            </div>

                            {actasParaSubir.length > 0 && (
                                <div className="space-y-4">
                                    <h6 className="text-sm font-bold text-gray-700 mb-3">
                                        Actas Seleccionadas ({actasParaSubir.length})
                                    </h6>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {actasParaSubir.map((acta, index) => (
                                            <div key={index} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
                                                <div className="flex gap-3">
                                                    <div className="flex-shrink-0">
                                                        <img
                                                            src={acta.preview}
                                                            alt={`Preview ${index + 1}`}
                                                            className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="mb-2">
                                                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                                                                Nombre de la Acta *
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={acta.nombre}
                                                                onChange={e => handleUpdateNombreActaParaSubir(index, e.target.value)}
                                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                                placeholder="Ej: Acta revisión 01"
                                                            />
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemoveActaParaSubir(index)}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-semibold transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            Eliminar
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button
                                onClick={() => {
                                    refreshActasSelectionReset();
                                    setModalSubirActasOpen(false);
                                    setRepIdActasSalida(null);
                                }}
                                className="btn btn-secondary"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={guardarActasSalida}
                                disabled={actasParaSubir.length === 0 || subiendoActas}
                                className="btn"
                                style={{ backgroundColor: '#002D5A', color: 'white' }}
                                onMouseOver={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#001f3d')}
                                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#002D5A')}
                            >
                                {subiendoActas ? (
                                    <span className="inline-flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Guardando...
                                    </span>
                                ) : (
                                    'Guardar'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ModalSalida
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditData(null); }}
                editData={editData}
                onAccept={queueUpdate}
            />
            <ModalObservaciones
                isOpen={modalObsOpen}
                onClose={() => setModalObsOpen(false)}
                observaciones={observacionesSeleccionadas}
            />
            {modalConfirmacionOpen && (
                <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setModalConfirmacionOpen(false)}>
                    <div className="modal-box p-0 max-w-lg overflow-hidden">
                        <div className="bg-gradient-to-r from-[#002D5A] to-[#003d7a] px-6 py-4">
                            <h3 className="text-white font-bold text-sm uppercase tracking-wide">Confirmar Cambios</h3>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-gray-700 leading-relaxed">
                                El cambio ha sido preparado con exito. Para aplicar los cambios de forma permanente en la base de datos, por favor presione el boton de actualizacion.
                            </p>
                        </div>
                        <div className="px-6 pb-6 flex justify-end gap-2">
                            <button
                                onClick={() => setModalConfirmacionOpen(false)}
                                className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                            >
                                Cerrar
                            </button>
                            <button
                                onClick={async () => {
                                    if (!cargaConfirmacion) {
                                        showToast('error', 'No se encontro la carga para actualizar');
                                        return;
                                    }
                                    await aplicarActualizacionCarga(cargaConfirmacion);
                                    setModalConfirmacionOpen(false);
                                    setCargaConfirmacion(null);
                                }}
                                disabled={updatingCodigo === (cargaConfirmacion?.codigo_carga || '__sin_codigo__')}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#002D5A] hover:bg-[#001f3d] disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <Save className="w-4 h-4" />
                                {updatingCodigo === (cargaConfirmacion?.codigo_carga || '__sin_codigo__') ? 'Actualizando...' : 'Actualizar registro'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {modalPasswordOpen && (
                <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setModalPasswordOpen(false)}>
                    <div className="modal-box p-0 max-w-md overflow-hidden">
                        <div className="bg-gradient-to-r from-[#002D5A] to-[#003d7a] px-6 py-4 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                                <Lock className="w-4 h-4 text-white" />
                            </div>
                            <h3 className="text-white font-bold uppercase text-sm tracking-wide">Autorización requerida</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-700">
                                Esta actualización no tiene actas. Ingresa la contraseña de autorización.
                            </p>
                            <input
                                type="password"
                                value={passwordAutorizacion}
                                onChange={e => setPasswordAutorizacion(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && void confirmarPasswordActualizacion()}
                                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                placeholder="Contraseña"
                                autoFocus
                            />
                        </div>
                        <div className="px-6 pb-6 flex justify-end gap-2">
                            <button
                                onClick={() => {
                                    setModalPasswordOpen(false);
                                    setPasswordAutorizacion('');
                                    setCargaPendientePassword(null);
                                    setIdsPendientesPassword([]);
                                }}
                                className="px-4 py-2 text-xs rounded-lg font-bold border border-gray-300 text-gray-600 hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => void confirmarPasswordActualizacion()}
                                className="px-4 py-2 text-xs rounded-lg font-bold bg-[#002D5A] hover:bg-[#001f3d] text-white"
                            >
                                Aceptar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
