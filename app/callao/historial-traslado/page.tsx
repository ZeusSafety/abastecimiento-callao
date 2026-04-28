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
    resolveAlmacenSalidaEntradaDesdeApi,
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

function resolverTiendaDesdeCodigoONombre(valor: string | null | undefined): Tienda {
    const v = (valor || '').trim();
    if (!v) return 'TIENDA OFICINA';
    const up = v.toUpperCase();
    const byCodigo = TIENDAS_ETIQUETA_MOVIMIENTOS_CALLAO.find(x => x.label.toUpperCase() === up);
    if (byCodigo) return byCodigo.tienda;
    if (TIENDAS.includes(v as Tienda)) return v as Tienda;
    return 'TIENDA OFICINA';
}

function formatFechaDosLineas(fechaStr: string): { fecha: string; hora: string } {
    if (!fechaStr) return { fecha: '-', hora: '' };
    try {
        let fecha: Date;
        if (fechaStr.includes('/')) {
            const parts = fechaStr.split(' ');
            const [dia, mes, anio] = parts[0].split('/');
            fecha = new Date(`${anio}-${mes}-${dia} ${parts.slice(1).join(' ')}`);
        } else {
            fecha = new Date(fechaStr);
        }
        if (isNaN(fecha.getTime())) return { fecha: fechaStr, hora: '' };
        const dia = fecha.getDate().toString().padStart(2, '0');
        const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
        const fechaFormateada = `${dia}/${mes}/${fecha.getFullYear()}`;
        let horas = fecha.getHours();
        const minutos = fecha.getMinutes().toString().padStart(2, '0');
        const periodo = horas >= 12 ? 'p. m.' : 'a. m.';
        horas = horas % 12 || 12;
        return { fecha: fechaFormateada, hora: `${horas}:${minutos} ${periodo}` };
    } catch { return { fecha: fechaStr, hora: '' }; }
}

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
                almacenSalida: resolveAlmacenSalidaEntradaDesdeApi(editData.almacenSalida, editData.almacenSalida) as AlmacenCompleto,
                almacenIngreso: resolverTiendaDesdeCodigoONombre(editData.almacenIngreso),
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
    const [searchUnlocked, setSearchUnlocked] = useState(false);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const PER_PAGE = 30;

    const [modalOpen, setModalOpen] = useState(false);
    const [editData, setEditData] = useState<RegistroTraslado | null>(null);
    const [pendingUpdates, setPendingUpdates] = useState<Record<string, { data: Partial<RegistroTraslado>; motivo: string }>>({});
    const [updatingCodigo, setUpdatingCodigo] = useState<string | null>(null);
    const [modalConfirmacionOpen, setModalConfirmacionOpen] = useState(false);
    const [cargaConfirmacion, setCargaConfirmacion] = useState<api.TrasladoCascadaDB | null>(null);
    const [modalPasswordOpen, setModalPasswordOpen] = useState(false);
    const [passwordAutorizacion, setPasswordAutorizacion] = useState('');
    const [cargaPendientePassword, setCargaPendientePassword] = useState<api.TrasladoCascadaDB | null>(null);
    const [idsPendientesPassword, setIdsPendientesPassword] = useState<string[]>([]);
    const [modalObsOpen, setModalObsOpen] = useState(false);
    const [observacionesSeleccionadas, setObservacionesSeleccionadas] = useState('');

    const [cargas, setCargas] = useState<api.TrasladoCascadaDB[]>([]);
    const [loadingCargas, setLoadingCargas] = useState(true);
    const [modalVerActasOpen, setModalVerActasOpen] = useState(false);
    const [actasSeleccionadas, setActasSeleccionadas] = useState<api.ActaMovimientoDB[]>([]);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const [expandedCodigos, setExpandedCodigos] = useState<Set<string>>(new Set());

    const [modalSubirActasOpen, setModalSubirActasOpen] = useState(false);
    const [repIdActasTraslado, setRepIdActasTraslado] = useState<number | null>(null);
    const [actasParaSubir, setActasParaSubir] = useState<Array<{ file: File; nombre: string; preview: string }>>([]);
    const [subiendoActas, setSubiendoActas] = useState(false);

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

    const refreshActasSelectionReset = () => {
        actasParaSubir.forEach(a => URL.revokeObjectURL(a.preview));
        setActasParaSubir([]);
    };

    const handleFileSelectSubirActas = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const nuevas = files.map(file => ({
            file,
            nombre: file.name,
            preview: URL.createObjectURL(file),
        }));
        setActasParaSubir(prev => [...prev, ...nuevas]);
        e.target.value = '';
    };

    const handleUpdateNombreActaParaSubir = (index: number, nombre: string) => {
        setActasParaSubir(prev => prev.map((a, i) => (i === index ? { ...a, nombre } : a)));
    };

    const handleRemoveActaParaSubir = (index: number) => {
        setActasParaSubir(prev => {
            const item = prev[index];
            if (item) URL.revokeObjectURL(item.preview);
            return prev.filter((_, i) => i !== index);
        });
    };

    const guardarActasTraslado = async () => {
        if (subiendoActas) return;
        if (!repIdActasTraslado) {
            showToast('error', 'No se encontró el registro de referencia para subir actas');
            return;
        }
        if (actasParaSubir.length === 0) {
            showToast('error', 'Selecciona al menos un archivo');
            return;
        }
        if (actasParaSubir.some(a => !a.nombre.trim())) {
            showToast('error', 'Asigna un nombre a cada acta');
            return;
        }

        setSubiendoActas(true);
        try {
            await api.agregarActaTraslado(
                repIdActasTraslado,
                actasParaSubir.map(a => ({ file: a.file, nombre: a.nombre }))
            );
            showToast('success', 'Acta(s) agregada(s) correctamente');
            refreshActasSelectionReset();
            setModalSubirActasOpen(false);
            setRepIdActasTraslado(null);
            await refreshCargas();
        } catch (error: any) {
            console.error(error);
            showToast('error', error?.message || 'Error subiendo actas');
        } finally {
            setSubiendoActas(false);
        }
    };

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

    // Mantener acordeones abiertos por defecto (igual que otros módulos)
    useEffect(() => {
        const keys = paginatedCargas.map((carga, idx) => `${carga.codigo_carga || 'sin-codigo'}-${idx}`);
        setExpandedCodigos(prev => {
            if (prev.size === keys.length && keys.every(k => prev.has(k))) return prev;
            return new Set(keys);
        });
    }, [paginatedCargas]);

    const openEdit = (t: RegistroTraslado) => {
        setEditData(t);
        setModalOpen(true);
    };

    const queueUpdate = (payload: { id: string; data: Partial<RegistroTraslado>; motivo: string }) => {
        setPendingUpdates(prev => ({ ...prev, [payload.id]: { data: payload.data, motivo: payload.motivo } }));
        const carga = cargas.find(c => c.detalles.some(d => String(d.id) === payload.id)) || null;
        setCargaConfirmacion(carga);
        setModalConfirmacionOpen(true);
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

    const handleExportExcel = () => {
        const rows = cargas.flatMap(c => c.detalles.map(d => ({
            fecha: d.fecha_registro,
            producto: d.producto_nombre,
            operacion: d.operacion,
            almacenSalida: d.tienda_salida_codigo,
            almacenIngreso: d.tienda_ingreso_codigo,
            operador: d.operador,
            cantidad: d.cantidad,
            unidadMedida: d.unidad_medida,
            registradoPor: d.registrado_por,
            observaciones: d.observaciones,
        })));
        const columns = [
            { header: 'Fecha', key: 'fecha' },
            { header: 'Producto', key: 'producto' },
            { header: 'Operación', key: 'operacion' },
            { header: 'Almacén Salida', key: 'almacenSalida' },
            { header: 'Almacén Ingreso', key: 'almacenIngreso' },
            { header: 'Operador', key: 'operador' },
            { header: 'Cantidad', key: 'cantidad' },
            { header: 'Unidad Medida', key: 'unidadMedida' },
            { header: 'Registrado Por', key: 'registradoPor' },
            { header: 'Observaciones', key: 'observaciones' },
        ];
        exportToExcel(rows, columns, `Historial_Traslados_${new Date().toISOString().split('T')[0]}`);
    };

    const handleExportPDF = () => {
        const rows = cargas.flatMap(c => c.detalles.map(d => ({
            fecha: d.fecha_registro,
            producto: d.producto_nombre,
            operacion: d.operacion,
            almacenSalida: d.tienda_salida_codigo,
            almacenIngreso: d.tienda_ingreso_codigo,
            operador: d.operador,
            cantidad: d.cantidad,
            unidadMedida: d.unidad_medida,
            registradoPor: d.registrado_por,
            observaciones: d.observaciones,
        })));
        const columns = [
            { header: 'Fecha', dataKey: 'fecha' },
            { header: 'Producto', dataKey: 'producto' },
            { header: 'Operación', dataKey: 'operacion' },
            { header: 'Almacén Salida', dataKey: 'almacenSalida' },
            { header: 'Almacén Ingreso', dataKey: 'almacenIngreso' },
            { header: 'Operador', dataKey: 'operador' },
            { header: 'Cantidad', dataKey: 'cantidad' },
            { header: 'Unidad Medida', dataKey: 'unidadMedida' },
            { header: 'Registrado Por', dataKey: 'registradoPor' },
            { header: 'Observaciones', dataKey: 'observaciones' },
        ];
        exportToPDF(rows, columns, `Historial_Traslados_${new Date().toISOString().split('T')[0]}`, 'Historial de Traslados');
    };

    return (
        <div id="view-historial-traslado" className="animate-in fade-in duration-500 font-poppins">
            <div className="container mx-auto">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6 transition-all">
                    {/* Header Principal */}
                    <header className="flex justify-between items-center flex-wrap gap-4 mb-8">
                        <div className="flex items-center space-x-3">
                            <div className="w-11 h-11 bg-gradient-to-br from-[#002D5A] to-[#0056b3] rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-900/10 transition-transform hover:scale-110">
                                <ArrowRightLeft className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="font-bold text-gray-900 m-0 tracking-tight" style={{ fontSize: '18px' }}>
                                    Historial de Traslados
                                </h1>
                                <p className="text-[11px] text-gray-400 mt-0.5 font-medium italic opacity-80">Consulta los movimientos de traslado agrupados por carga</p>
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
                                Total: {filteredCargas.length} cargas
                            </span>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-72">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    name="buscar_historial_traslados"
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
                                    const detalleRep = carga.detalles[0];
                                    const cargaKey = `${carga.codigo_carga || 'sin-codigo'}-${idx}`;
                                    const isOpen = expandedCodigos.has(cargaKey);
                                    const { fecha, hora } = formatFechaDosLineas(carga.fecha_primera);
                                    const itemsTotales = carga.detalles.length;
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
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 text-[10px] text-gray-600 whitespace-nowrap flex-shrink-0">
                                                    {pendientes.length > 0 && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); aplicarActualizacionCarga(carga); }}
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] font-black transition-all animate-pulse"
                                                        >
                                                            <Save className="w-3.5 h-3.5" />
                                                            APLICAR {pendientes.length} CAMBIOS
                                                        </button>
                                                    )}
                                                    <span className="inline-flex items-center gap-2">
                                                        <PackagePlus className="w-4 h-4 text-[#002D5A]" />
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
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full xl:flex-1">
                                                                <div className="w-full sm:w-[180px]">
                                                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">REGISTRADOR</div>
                                                                    <div className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-[12px] font-bold text-gray-900">
                                                                        {detalleRep?.registrado_por || '-'}
                                                                    </div>
                                                                </div>
                                                                <div className="w-full sm:w-[180px]">
                                                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">OPERADOR</div>
                                                                    <div className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-[12px] font-bold text-gray-900">
                                                                        {detalleRep?.operador || carga.operador || '-'}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="w-full xl:w-auto flex flex-wrap items-center justify-end gap-2">
                                                                <div className="inline-flex items-center gap-1 text-[10px] text-gray-500 whitespace-nowrap">
                                                                    <span>Actas:</span>
                                                                    <span className="text-gray-900 font-bold">{carga.actas.length}</span>
                                                                </div>
                                                                {carga.actas.length > 0 ? (
                                                                    <button
                                                                        onClick={() => {
                                                                            const rep = carga.detalles?.[0]?.id;
                                                                            setRepIdActasTraslado(rep ? Number(rep) : null);
                                                                            setActasSeleccionadas(carga.actas);
                                                                            setModalVerActasOpen(true);
                                                                        }}
                                                                        className="px-4 py-2 text-[10px] rounded-xl font-bold bg-[#002D5A] hover:bg-[#001f3d] text-white transition-all shadow-sm inline-flex items-center gap-2 whitespace-nowrap"
                                                                    >
                                                                        <FileImage className="w-3.5 h-3.5" />
                                                                        <span>Ver actas</span>
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => {
                                                                            const rep = carga.detalles?.[0]?.id;
                                                                            if (!rep) {
                                                                                showToast('error', 'No se encontró un registro de traslado para adjuntar actas');
                                                                                return;
                                                                            }
                                                                            setRepIdActasTraslado(Number(rep));
                                                                            setModalSubirActasOpen(true);
                                                                        }}
                                                                        className="px-4 py-2 text-[10px] rounded-xl font-bold bg-[#002D5A] hover:bg-[#001f3d] text-white transition-all shadow-sm whitespace-nowrap inline-flex items-center gap-2"
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
                                                                            almacenSalida: resolveAlmacenSalidaEntradaDesdeApi(d.tienda_salida_codigo, d.tienda_salida_nombre) as AlmacenCompleto,
                                                                            almacenIngreso: resolverTiendaDesdeCodigoONombre(d.tienda_ingreso_codigo || d.tienda_ingreso_nombre),
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
                                                                                                        ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
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
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Pagination premium */}
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

            <ModalTraslado isOpen={modalOpen} onClose={() => setModalOpen(false)} editData={editData} onAccept={queueUpdate} />

            {/* Modal Ver Actas */}
            {modalVerActasOpen && (
                <div 
                    className="modal-backdrop z-[30001] animate-in fade-in duration-200" 
                    onClick={e => e.target === e.currentTarget && setModalVerActasOpen(false)}
                >
                    <div className="modal-box" style={{ maxWidth: 1100, width: '95vw', maxHeight: '90vh', overflow: 'auto' }}>
                        <div className="modal-header border-b pb-4 mb-6">
                            <div>
                                <h6 className="text-lg font-black text-[#002D5A] m-0 uppercase">Actas de Traslado</h6>
                                <p className="text-[11px] text-gray-500 m-0 font-bold tracking-widest">{actasSeleccionadas.length} ACTA(S) ENCONTRADA(S)</p>
                            </div>
                            <button onClick={() => setModalVerActasOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                                <X className="w-6 h-6 text-gray-400" />
                            </button>
                        </div>
                        <div className="px-6 pt-3">
                            <button
                                onClick={() => {
                                    if (!repIdActasTraslado) {
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-2">
                            {actasSeleccionadas.map((acta, i) => (
                                <div key={i} className="group relative bg-gray-50 rounded-2xl p-4 border-2 border-transparent hover:border-blue-200 transition-all cursor-pointer shadow-sm hover:shadow-md" onClick={() => setLightboxUrl(acta.url_imagen)}>
                                    <div className="aspect-[4/3] rounded-xl overflow-hidden mb-3 bg-gray-200 relative">
                                        <img src={acta.url_imagen} alt={acta.nombre_imagen} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                            <Eye className="w-10 h-10 text-white" />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-[12px] font-black text-gray-800 m-0 truncate pr-4">{acta.nombre_imagen}</p>
                                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                                            <ImageIcon className="w-4 h-4 text-gray-400" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
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
                                    Subir Actas (Traslado)
                                </h6>
                                <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>
                                    Selecciona imágenes y asigna un nombre a cada una
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    refreshActasSelectionReset();
                                    setModalSubirActasOpen(false);
                                    setRepIdActasTraslado(null);
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
                                        id="file-input-actas-subir-traslados-historial"
                                    />
                                    <label
                                        htmlFor="file-input-actas-subir-traslados-historial"
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
                                    setRepIdActasTraslado(null);
                                }}
                                className="btn btn-secondary"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={guardarActasTraslado}
                                disabled={actasParaSubir.length === 0 || subiendoActas}
                                className="btn btn-primary"
                            >
                                {subiendoActas ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Subiendo...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4" />
                                        Guardar actas
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox */}
            {lightboxUrl && (
                <div className="fixed inset-0 z-[40000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
                    <button className="absolute top-6 right-6 p-3 bg-white/90 hover:bg-white rounded-2xl text-gray-700 transition-all shadow-2xl">
                        <X className="w-8 h-8" />
                    </button>
                    <img src={lightboxUrl} alt="Vista previa" className="max-w-full max-h-full object-contain shadow-2xl animate-in zoom-in-95 duration-300 bg-white rounded-xl" />
                </div>
            )}

            {modalObsOpen && (
                <div className="modal-backdrop z-[9999]" onClick={() => setModalObsOpen(false)}>
                    <div className="modal-box max-w-lg bg-white rounded-2xl p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4 border-b pb-3">
                            <h3 className="text-lg font-black text-[#002D5A] m-0 uppercase">OBSERVACIONES</h3>
                            <button onClick={() => setModalObsOpen(false)}><X className="w-5 h-5 text-gray-400" /></button>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{observacionesSeleccionadas}</p>
                        <div className="mt-6 flex justify-end">
                            <button onClick={() => setModalObsOpen(false)} className="px-6 py-2 bg-[#002D5A] text-white rounded-xl font-bold text-xs transition-all active:scale-95">CERRAR</button>
                        </div>
                    </div>
                </div>
            )}

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
                                onKeyDown={e => e.key === 'Enter' && void handleConfirmarPassword()}
                                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                placeholder="Contraseña"
                                autoComplete="off"
                                autoFocus
                            />
                        </div>
                        <div className="px-6 pb-6 flex justify-end gap-2">
                            <button
                                onClick={() => {
                                    setModalPasswordOpen(false);
                                    setPasswordAutorizacion('');
                                }}
                                className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => void handleConfirmarPassword()}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#002D5A] hover:bg-[#001f3d]"
                            >
                                <Lock className="w-4 h-4" />
                                Confirmar cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
