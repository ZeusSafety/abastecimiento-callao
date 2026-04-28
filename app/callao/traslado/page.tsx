'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
    getCodigoAlmacenSalidaEntrada,
    getCodigoFromTienda,
    etiquetaOrigenAlmacenSalidaEntrada,
    etiquetaTiendaMovimientosCallao,
    RegistroTraslado,
    Tienda,
    AlmacenCompleto,
    UnidadMedida,
    Producto,
    getOperacionColor,
} from '../../context/CallaoContext';
import {
    Plus,
    Search,
    X,
    Save,
    PackagePlus,
    ChevronDown,
    ChevronRight,
    Loader2,
    Trash2,
    Upload,
    Lock,
    FileImage,
    Eye,
    XCircle,
    Image as ImageIcon,
    Calendar,
    Clock3,
    ArrowRightLeft
} from 'lucide-react';
import TableSkeleton from '../../components/TableSkeleton';
import ProductoAutocomplete from '../../components/ProductoAutocomplete';
import * as api from '../../services/api';

// ─── Función para formatear fecha en dos líneas ──────────────────────────────
function formatFechaDosLineas(fechaStr: string): { fecha: string; hora: string } {
    if (!fechaStr) return { fecha: '-', hora: '' };

    try {
        let fecha: Date;
        if (fechaStr.includes('/')) {
            const parts = fechaStr.split(' ');
            const fechaPart = parts[0]; 
            const horaPart = parts.slice(1).join(' '); 

            const [dia, mes, anio] = fechaPart.split('/');
            fecha = new Date(`${anio}-${mes}-${dia} ${horaPart}`);
        } else {
            fecha = new Date(fechaStr);
        }

        if (isNaN(fecha.getTime())) {
            return { fecha: fechaStr, hora: '' };
        }

        const dia = fecha.getDate().toString().padStart(2, '0');
        const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
        const anio = fecha.getFullYear();
        const fechaFormateada = `${dia}/${mes}/${anio}`;

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
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={e => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col z-[10000]">
                <div className="bg-gradient-to-r from-[#002D5A] to-[#003d7a] px-6 py-4 flex items-center justify-between">
                    <h2 className="text-white font-black text-lg uppercase tracking-wider">Observaciones</h2>
                    <button onClick={onClose} className="text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    <div className="text-gray-700 text-sm whitespace-pre-wrap" style={{ fontFamily: 'var(--font-poppins)' }}>
                        {observaciones || 'Sin observaciones'}
                    </div>
                </div>

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

// ─── Modal Registro Traslado ───────────────────────────────────────────────────
function ModalTraslado({
    isOpen,
    onClose,
    editData,
}: {
    isOpen: boolean;
    onClose: () => void;
    editData?: RegistroTraslado | null;
}) {
    const { state, addTraslado, updateTraslado, showToast, refreshTraslados, refreshProductos } = useCallao();

    const [form, setForm] = useState({
        productoId: editData?.productoId ?? '',
        producto: editData?.producto ?? '',
        codigo: '',
        operacion: editData?.operacion ?? OPS_TRASLADOS[0],
        operacionPersonalizada: '',
        almacenSalida: (editData?.almacenSalida ?? 'IMPORTACION') as AlmacenCompleto,
        almacenIngreso: (editData?.almacenIngreso ?? 'TIENDA OFICINA') as Tienda,
        operador: OPERADORES[0],
        operadorCustom: '',
        cantidad: editData?.cantidad ?? 0,
        unidadMedida: (editData?.unidadMedida ?? 'DOCENAS') as UnidadMedida,
        registradoPor: REGISTRADORES[0],
        registradoCustom: '',
        observaciones: editData?.observaciones ?? '',
        motivoCambio: '',
    });

    const isEdit = !!editData;
    const [fechaActual, setFechaActual] = useState('');
    const [productosAgregados, setProductosAgregados] = useState<Array<{
        productoId: string;
        producto: string;
        codigo: string;
        operacion: string;
        almacenSalida: AlmacenCompleto;
        almacenIngreso: Tienda;
        operador: string;
        cantidad: number;
        unidadMedida: UnidadMedida;
        registradoPor: string;
        observaciones: string;
    }>>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);

    const [modalActasOpen, setModalActasOpen] = useState(false);
    const [actas, setActas] = useState<Array<{ file: File; nombre: string; preview: string }>>([]);
    const [modalPasswordOpen, setModalPasswordOpen] = useState(false);
    const [passwordAutorizacion, setPasswordAutorizacion] = useState('');

    useEffect(() => {
        if (isOpen && !isEdit) {
            setProductosAgregados([]);
            setEditingIndex(null);
            setForm({
                productoId: '',
                producto: '',
                codigo: '',
                operacion: OPS_TRASLADOS[0],
                operacionPersonalizada: '',
                almacenSalida: 'IMPORTACION',
                almacenIngreso: 'TIENDA OFICINA',
                operador: OPERADORES[0],
                operadorCustom: '',
                cantidad: 0,
                unidadMedida: 'DOCENAS' as UnidadMedida,
                registradoPor: REGISTRADORES[0],
                registradoCustom: '',
                observaciones: '',
                motivoCambio: '',
            });
        }
    }, [isOpen, isEdit]);

    const mapPersonaCombo = (valor: string | undefined, lista: readonly string[]) => {
        const v = (valor || '').trim();
        if (!v) return { sel: lista[0], custom: '' };
        const up = v.toUpperCase();
        const found = lista.find(x => x === up);
        if (found) return { sel: found, custom: '' };
        return { sel: COMBO_OTROS_VALUE, custom: v };
    };

    useEffect(() => {
        if (!isEdit || !editData) return;
        const op = mapPersonaCombo(editData.operador, OPERADORES);
        const reg = mapPersonaCombo(editData.registradoPor, REGISTRADORES);
        setForm(f => ({
            ...f,
            operador: op.sel,
            operadorCustom: op.custom,
            registradoPor: reg.sel,
            registradoCustom: reg.custom,
        }));
    }, [isEdit, editData]);

    useEffect(() => {
        setFechaActual(new Date().toLocaleString('es-PE'));
    }, []);

    useEffect(() => {
        if (editData && editData.producto) {
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
                    codigo: producto.codigo,
                }));
            }
        }
    }, [editData, state.productos]);

    const handleProductoChange = (productoId: string, producto: Producto | null) => {
        if (!producto) {
            setForm(f => ({
                ...f,
                productoId: '',
                producto: '',
                codigo: '',
                unidadMedida: 'DOCENAS' as UnidadMedida,
            }));
            return;
        }
        setForm(f => ({
            ...f,
            productoId: productoId,
            producto: producto.nombre,
            codigo: producto.codigo,
            unidadMedida: producto.unidadMedidaRegCalculo,
        }));
    };

    const selectedProducto = state.productos.find(p => p.id === form.productoId);

    const handleAgregarProducto = () => {
        if (!form.productoId || form.productoId === '') { 
            showToast('error', 'Selecciona un producto'); 
            return; 
        }
        if (!form.cantidad || form.cantidad <= 0) { 
            showToast('error', 'Ingresa una cantidad válida mayor a 0'); 
            return; 
        }

        const operador = resolvePersonaCombo(form.operador, form.operadorCustom);
        const registradoPor = resolvePersonaCombo(form.registradoPor, form.registradoCustom);
        if (form.operador === COMBO_OTROS_VALUE && !operador) {
            showToast('error', 'Indica el nombre del operador (OTROS)');
            return;
        }
        if (form.registradoPor === COMBO_OTROS_VALUE && !registradoPor) {
            showToast('error', 'Indica quién registra (OTROS)');
            return;
        }

        const nuevoProducto = {
            productoId: form.productoId,
            producto: form.producto,
            codigo: selectedProducto?.codigo || '',
            operacion: form.operacion,
            almacenSalida: form.almacenSalida,
            almacenIngreso: form.almacenIngreso,
            operador,
            cantidad: Number(form.cantidad),
            unidadMedida: form.unidadMedida,
            registradoPor,
            observaciones: form.observaciones,
        };

        setProductosAgregados([...productosAgregados, nuevoProducto]);
        
        setForm(f => ({
            ...f,
            cantidad: 0,
            observaciones: '',
        }));
        
        showToast('success', 'Producto agregado a la lista');
    };

    const handleEliminarProducto = (index: number) => {
        setProductosAgregados(productosAgregados.filter((_, i) => i !== index));
        if (editingIndex === index) setEditingIndex(null);
        else if (editingIndex !== null && editingIndex > index) setEditingIndex(editingIndex - 1);
        showToast('success', 'Producto eliminado de la lista');
    };

    const handleEditarProducto = (index: number) => {
        if (editingIndex === index) {
            setEditingIndex(null);
        } else {
            setEditingIndex(index);
        }
    };

    const handleProductoChangeInTable = (index: number, productoId: string, producto: Producto | null) => {
        setProductosAgregados(productosAgregados.map((p, i) => {
            if (i === index) {
                if (!producto) {
                    return {
                        ...p,
                        productoId: '',
                        producto: '',
                        codigo: '',
                        unidadMedida: 'DOCENAS' as UnidadMedida,
                    };
                }
                return {
                    ...p,
                    productoId: productoId,
                    producto: producto.nombre,
                    codigo: producto.codigo,
                    unidadMedida: producto.unidadMedidaRegCalculo,
                };
            }
            return p;
        }));
    };

    const handleActualizarProducto = (index: number, field: string, value: any) => {
        setProductosAgregados(productosAgregados.map((p, i) => {
            if (i === index) {
                return { ...p, [field]: value };
            }
            return p;
        }));
    };

    const handleFileSelectActas = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const nuevasActas = files.map(file => ({
            file,
            nombre: file.name.replace(/\.[^/.]+$/, ''),
            preview: URL.createObjectURL(file),
        }));
        setActas(prev => [...prev, ...nuevasActas]);
        e.target.value = '';
    };

    const handleRemoveActa = (index: number) => {
        setActas(prev => {
            const nueva = [...prev];
            URL.revokeObjectURL(nueva[index].preview);
            nueva.splice(index, 1);
            return nueva;
        });
    };

    const handleUpdateNombreActa = (index: number, nuevoNombre: string) => {
        setActas(prev => {
            const nueva = [...prev];
            nueva[index] = { ...nueva[index], nombre: nuevoNombre };
            return nueva;
        });
    };

    const prepararTrasladosData = () => {
        return productosAgregados.map(p => {
            const prod = state.productos.find(pr => pr.id === p.productoId);
            if (!prod) throw new Error(`Producto ${p.productoId} no encontrado`);

            const almacenSalidaStr = getCodigoAlmacenSalidaEntrada(p.almacenSalida);
            const almacenIngresoStr = getCodigoFromTienda(p.almacenIngreso);

            return {
                producto: prod.codigo,
                operacion: p.operacion,
                almacen_salida: almacenSalidaStr,
                almacen_ingreso: almacenIngresoStr,
                operador: p.operador,
                cantidad: p.cantidad,
                unidad_medida: p.unidadMedida,
                entregado_por: '',
                registrado_por: p.registradoPor,
                observaciones: p.observaciones,
            };
        });
    };

    const ejecutarGuardadoTraslados = async (password?: string) => {
        setIsSaving(true);
        try {
            if (productosAgregados.length === 0) {
                showToast('error', 'Agrega al menos un producto antes de guardar');
                return;
            }

            const trasladosData = prepararTrasladosData();

            const archivosActas =
                actas.length > 0 ? actas.map(a => ({ file: a.file, nombre: a.nombre })) : undefined;

            await api.createTrasladosMasivo(trasladosData, {
                actas: archivosActas,
                passwordAutorizacion: archivosActas ? undefined : password,
            });

            await Promise.all([refreshTraslados(), refreshProductos()]);

            actas.forEach(a => URL.revokeObjectURL(a.preview));
            setActas([]);
            setPasswordAutorizacion('');
            setModalActasOpen(false);
            setModalPasswordOpen(false);

            onClose();
            showToast('success', `${productosAgregados.length} producto(s) traslada(dos) exitosamente`);
        } catch (error: any) {
            showToast('error', error.message || 'Error al registrar traslados');
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmarPassword = async () => {
        if (!passwordAutorizacion.trim()) {
            showToast('error', 'Ingresa la contraseña de autorización');
            return;
        }
        setModalPasswordOpen(false);
        await ejecutarGuardadoTraslados(passwordAutorizacion);
    };

    useEffect(() => {
        if (modalPasswordOpen) {
            // Siempre abrir el modal de autorización con campo limpio.
            setPasswordAutorizacion('');
        }
    }, [modalPasswordOpen]);

    const handleSubmit = async () => {
        if (isEdit) {
            if (!form.productoId || form.productoId === '') { 
                showToast('error', 'Selecciona un producto'); 
                return; 
            }
            if (!form.cantidad || form.cantidad <= 0) { 
                showToast('error', 'Ingresa una cantidad válida mayor a 0'); 
                return; 
            }
            if (!form.motivoCambio.trim()) { 
                showToast('error', 'Ingresa el motivo del cambio'); 
                return; 
            }

            try {
                const operador = resolvePersonaCombo(form.operador, form.operadorCustom);
                const registradoPor = resolvePersonaCombo(form.registradoPor, form.registradoCustom);
                if (form.operador === COMBO_OTROS_VALUE && !operador) {
                    showToast('error', 'Indica el nombre del operador (OTROS)');
                    return;
                }
                if (form.registradoPor === COMBO_OTROS_VALUE && !registradoPor) {
                    showToast('error', 'Indica quién registra (OTROS)');
                    return;
                }
                await updateTraslado(editData!.id, {
                    productoId: form.productoId,
                    producto: form.producto,
                    operacion: form.operacion,
                    almacenSalida: form.almacenSalida,
                    almacenIngreso: form.almacenIngreso,
                    operador,
                    cantidad: Number(form.cantidad),
                    unidadMedida: form.unidadMedida,
                    entregado: '',
                    registradoPor,
                    observaciones: form.observaciones,
                }, form.motivoCambio);
                await Promise.all([refreshTraslados(), refreshProductos()]);
                onClose();
            } catch (error) {
            }
        } else {
            if (productosAgregados.length === 0) {
                showToast('error', 'Agrega al menos un producto antes de guardar');
                return;
            }

            if (actas.length === 0) {
                setPasswordAutorizacion('');
                setModalPasswordOpen(true);
                return;
            }

            await ejecutarGuardadoTraslados();
        }
    };

    if (!isOpen) return null;

    return (
        <>
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: isEdit ? 680 : 1200 }}>
                <div className="modal-header">
                    <div className="flex items-center gap-2">
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: '#E9F1FF' }}
                        >
                            <ArrowRightLeft className="w-4 h-4 text-[#002D5A]" />
                        </div>
                        <div>
                            <h6 style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#002D5A' }}>
                                {isEdit ? 'Editar Traslado' : 'Registrar Traslado'}
                            </h6>
                            <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>
                                {isEdit ? 'Modifica los datos del traslado seleccionado' : 'Completa los datos del traslado'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="modal-body">
                    <div className="grid grid-cols-2 gap-4">
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

                        <div>
                            <label className="form-label">Producto *</label>
                            <ProductoAutocomplete
                                productos={state.productos}
                                value={form.productoId}
                                onChange={handleProductoChange}
                                placeholder="Buscar producto..."
                            />
                        </div>

                        <div>
                            <label className="form-label">Código</label>
                            <input
                                type="text"
                                value={form.codigo || selectedProducto?.codigo || ''}
                                readOnly
                                className="form-input"
                                style={{ background: '#f8fafc', color: '#6b7280', fontSize: 12 }}
                                placeholder="Selecciona un producto"
                            />
                        </div>

                        {selectedProducto && (
                            <div className="col-span-2">
                                <label className="form-label">Existencia Almacén</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {TIENDAS.map(tienda => {
                                        const existencia = selectedProducto.existencia[tienda] || 0;
                                        const stockMinimo = selectedProducto.stockMinimo[tienda] || 0;
                                        const bajoStock = existencia < stockMinimo && stockMinimo > 0;
                                        return (
                                            <div
                                                key={tienda}
                                                className={`p-3 rounded-lg border-2 transition-all ${
                                                    bajoStock
                                                        ? 'bg-red-50 border-red-200'
                                                        : 'bg-blue-50 border-blue-200'
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
                            <label className="form-label">Operación *</label>
                            <div className="relative">
                                <select
                                    value={form.operacion}
                                    onChange={e => setForm(f => ({ ...f, operacion: e.target.value }))}
                                    className="form-input"
                                    style={{ paddingRight: 28, appearance: 'none', fontSize: 12 }}
                                >
                                    {OPS_TRASLADOS.map(op => <option key={op}>{op}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        <div>
                            <label className="form-label">Almacén / Tienda de Salida</label>
                            <div className="relative">
                                <select
                                    value={form.almacenSalida}
                                    onChange={e => setForm(f => ({ ...f, almacenSalida: e.target.value as AlmacenCompleto }))}
                                    className="form-input"
                                    style={{ paddingRight: 28, appearance: 'none', fontSize: 12 }}
                                >
                                    {ORIGENES_ALMACEN_SALIDA_ENTRADA_CALLAO.map(({ value, label }) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        <div>
                            <label className="form-label">Almacén / Tienda de Ingreso</label>
                            <div className="relative">
                                <select
                                    value={form.almacenIngreso}
                                    onChange={e => setForm(f => ({ ...f, almacenIngreso: e.target.value as Tienda }))}
                                    className="form-input"
                                    style={{ paddingRight: 28, appearance: 'none', fontSize: 12 }}
                                >
                                    {TIENDAS_ETIQUETA_MOVIMIENTOS_CALLAO.map(({ tienda, label }) => (
                                        <option key={tienda} value={tienda}>{label}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        <div>
                            <label className="form-label">Operador</label>
                            <div className="relative">
                                <select
                                    value={form.operador}
                                    onChange={e =>
                                        setForm(f => ({
                                            ...f,
                                            operador: e.target.value,
                                            operadorCustom: e.target.value !== COMBO_OTROS_VALUE ? '' : f.operadorCustom,
                                        }))
                                    }
                                    className="form-input"
                                    style={{ paddingRight: 28, appearance: 'none', fontSize: 12 }}
                                >
                                    {OPERADORES.map(o => (
                                        <option key={o} value={o}>
                                            {o}
                                        </option>
                                    ))}
                                    <option value={COMBO_OTROS_VALUE}>OTROS (especificar)</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                            {form.operador === COMBO_OTROS_VALUE && (
                                <input
                                    type="text"
                                    value={form.operadorCustom}
                                    onChange={e => setForm(f => ({ ...f, operadorCustom: e.target.value.toUpperCase() }))}
                                    className="form-input mt-2"
                                    style={{ fontSize: 12 }}
                                    placeholder="Nombre del operador"
                                />
                            )}
                        </div>

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
                                className="form-input"
                                style={{ fontSize: 12 }}
                                placeholder="0"
                            />
                        </div>

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

                        <div>
                            <label className="form-label">Registrado Por</label>
                            <div className="flex items-end gap-2">
                                <div className="relative flex-1">
                                    <select
                                        value={form.registradoPor}
                                        onChange={e =>
                                            setForm(f => ({
                                                ...f,
                                                registradoPor: e.target.value,
                                                registradoCustom: e.target.value !== COMBO_OTROS_VALUE ? '' : f.registradoCustom,
                                            }))
                                        }
                                        className="form-input"
                                        style={{ paddingRight: 28, appearance: 'none', fontSize: 12 }}
                                    >
                                        {REGISTRADORES.map(r => (
                                            <option key={r} value={r}>
                                                {r}
                                            </option>
                                        ))}
                                        <option value={COMBO_OTROS_VALUE}>OTROS (especificar)</option>
                                    </select>
                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                </div>
                                {!isEdit && (
                                    <button
                                        type="button"
                                        onClick={() => setModalActasOpen(true)}
                                        className="flex items-center gap-2 px-3 py-2 bg-[#002D5A] hover:bg-[#001f3d] text-white rounded-xl font-bold text-[10px] transition-all shadow-sm"
                                        style={{ whiteSpace: 'nowrap' }}
                                    >
                                        <Upload className="w-4 h-4" />
                                        <span>Subir Acta</span>
                                        {actas.length > 0 && (
                                            <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                                {actas.length}
                                            </span>
                                        )}
                                    </button>
                                )}
                            </div>
                            {form.registradoPor === COMBO_OTROS_VALUE && (
                                <input
                                    type="text"
                                    value={form.registradoCustom}
                                    onChange={e => setForm(f => ({ ...f, registradoCustom: e.target.value.toUpperCase() }))}
                                    className="form-input mt-2"
                                    style={{ fontSize: 12 }}
                                    placeholder="Nombre"
                                />
                            )}
                        </div>

                        {/* Observaciones — ancho completo */}
                        <div className="col-span-2">
                            <label className="form-label">Observaciones</label>
                            <textarea
                                value={form.observaciones}
                                onChange={e => setForm(f => ({ ...f, observaciones: e.target.value.toUpperCase() }))}
                                className="form-input"
                                rows={3}
                                style={{ resize: 'vertical', fontSize: 12 }}
                                placeholder="Ej: Traslado urgente, mercadería frágil..."
                            />
                        </div>

                        {isEdit && (
                            <div className="col-span-2">
                                <label className="form-label" style={{ color: '#002D5A' }}>Motivo del Cambio *</label>
                                <textarea
                                    value={form.motivoCambio}
                                    onChange={e => setForm(f => ({ ...f, motivoCambio: e.target.value }))}
                                    className="form-input border-blue-200 bg-blue-50/30 h-[60px]"
                                    style={{ fontSize: 12, paddingTop: 8 }}
                                    placeholder="Explica por qué estás actualizando este registro..."
                                />
                            </div>
                        )}

                        {/* Botón Agregar Producto — fila propia, ancho completo */}
                        {!isEdit && (
                            <div className="col-span-2">
                                <button
                                    type="button"
                                    onClick={handleAgregarProducto}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-green-700 bg-green-50/50 hover:bg-green-100 border border-green-200 rounded-lg transition-all duration-200 group"
                                    style={{ fontSize: 12 }}
                                >
                                    <Plus className="w-4 h-4 text-green-600 group-hover:scale-110 transition-transform" />
                                    <span className="font-bold">Agregar Producto a la Lista</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {!isEdit && (
                        <div className="col-span-2 mt-4">
                            <label className="form-label mb-2">Productos Agregados</label>
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                                <div className="overflow-x-auto max-h-[300px]">
                                    <table className="w-full text-sm">
                                    <thead className="bg-[#002D5A] text-white sticky top-0 z-10">
                                        <tr className="text-[9px] uppercase tracking-tighter">
                                            <th className="px-3 py-2 text-left text-[9px] font-bold uppercase">Producto</th>
                                            <th className="px-3 py-2 text-left text-[9px] font-bold uppercase" style={{ minWidth: '100px' }}>Código</th>
                                            <th className="px-3 py-2 text-left text-[9px] font-bold uppercase">Operación</th>
                                            <th className="px-3 py-2 text-left text-[9px] font-bold uppercase">Almacén Salida</th>
                                            <th className="px-3 py-2 text-left text-[9px] font-bold uppercase">Ingreso</th>
                                            <th className="px-3 py-2 text-left text-[9px] font-bold uppercase">Operador</th>
                                            <th className="px-2 py-2 text-center text-[9px] font-bold uppercase" style={{ width: '60px' }}>Cant.</th>
                                            <th className="px-3 py-2 text-left text-[9px] font-bold uppercase">U.M</th>
                                            <th className="px-3 py-2 text-center text-[9px] font-bold uppercase">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {productosAgregados.length === 0 ? (
                                            <tr>
                                                <td colSpan={9} className="px-4 py-8 text-center text-gray-400 text-xs">
                                                    No hay productos agregados. Completa el formulario y presiona "Agregar Producto a la Lista"
                                                </td>
                                            </tr>
                                        ) : (
                                        productosAgregados.map((p, i) => (
                                            <tr
                                                key={i}
                                                onClick={() => handleEditarProducto(i)}
                                                title="Haz clic para editar esta fila"
                                                className={`hover:bg-gray-50 cursor-pointer ${editingIndex === i ? 'bg-yellow-50 border-l-4 border-yellow-500' : ''}`}
                                            >
                                                <td className="px-4 py-2">
                                                    {editingIndex === i ? (
                                                        <ProductoAutocomplete
                                                            productos={state.productos}
                                                            value={p.productoId}
                                                            onChange={(id, prod) => handleProductoChangeInTable(i, id, prod)}
                                                            placeholder="Buscar producto..."
                                                        />
                                                    ) : (
                                                        <span className="text-[10px] font-medium text-gray-900">{p.producto}</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2" style={{ minWidth: '100px' }}>
                                                    <span className="text-[10px] text-gray-700 uppercase font-medium">{p.codigo || '-'}</span>
                                                </td>
                                                <td className="px-4 py-2">
                                                    {editingIndex === i ? (
                                                        <div className="relative">
                                                            <select
                                                                value={p.operacion}
                                                                onChange={e => handleActualizarProducto(i, 'operacion', e.target.value)}
                                                                onClick={e => e.stopPropagation()}
                                                                className="form-input text-[9px] py-1 px-2"
                                                                style={{ paddingRight: 20, appearance: 'none' }}
                                                            >
                                                                {OPS_TRASLADOS.map(op => <option key={op}>{op}</option>)}
                                                            </select>
                                                            <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                                                        </div>
                                                    ) : (
                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${getOperacionColor(p.operacion).bg} ${getOperacionColor(p.operacion).text}`}>{p.operacion}</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2">
                                                    {editingIndex === i ? (
                                                        <div className="relative">
                                                            <select
                                                                value={p.almacenSalida}
                                                                onChange={e => handleActualizarProducto(i, 'almacenSalida', e.target.value)}
                                                                onClick={e => e.stopPropagation()}
                                                                className="form-input text-[9px] py-1 px-2"
                                                                style={{ paddingRight: 20, appearance: 'none' }}
                                                            >
                                                                {ORIGENES_ALMACEN_SALIDA_ENTRADA_CALLAO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                            </select>
                                                            <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-700">{etiquetaOrigenAlmacenSalidaEntrada(p.almacenSalida)}</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2">
                                                    {editingIndex === i ? (
                                                        <div className="relative">
                                                            <select
                                                                value={p.almacenIngreso}
                                                                onChange={e => handleActualizarProducto(i, 'almacenIngreso', e.target.value)}
                                                                onClick={e => e.stopPropagation()}
                                                                className="form-input text-[9px] py-1 px-2"
                                                                style={{ paddingRight: 20, appearance: 'none' }}
                                                            >
                                                                {TIENDAS_ETIQUETA_MOVIMIENTOS_CALLAO.map(o => <option key={o.tienda} value={o.tienda}>{o.label}</option>)}
                                                            </select>
                                                            <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-700">{etiquetaTiendaMovimientosCallao(p.almacenIngreso)}</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 text-[10px] text-gray-700">
                                                    {editingIndex === i ? (
                                                        <input
                                                            type="text"
                                                            value={p.operador}
                                                            onChange={e => handleActualizarProducto(i, 'operador', e.target.value.toUpperCase())}
                                                            onClick={e => e.stopPropagation()}
                                                            className="w-full p-1 text-[11px] border rounded"
                                                        />
                                                    ) : p.operador}
                                                </td>
                                                <td className="px-2 py-2 text-center text-[10px]" style={{ width: '60px' }}>
                                                    {editingIndex === i ? (
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={p.cantidad}
                                                            onChange={e => handleActualizarProducto(i, 'cantidad', Number(e.target.value))}
                                                            onClick={e => e.stopPropagation()}
                                                            className="form-input text-[10px] py-1 px-1 w-full text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                            style={{ fontSize: 10 }}
                                                        />
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-gray-900">{p.cantidad}</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span className="text-[10px] text-gray-700">{p.unidadMedida}</span>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {editingIndex === i ? (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditingIndex(null);
                                                                }}
                                                                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                                                                title="Guardar"
                                                            >
                                                                <Save className="w-4 h-4" />
                                                            </button>
                                                        ) : null}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEliminarProducto(i);
                                                            }}
                                                            className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                                            title="Eliminar de la lista"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )))}
                                    </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors uppercase">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-8 py-2 bg-[#002D5A] hover:bg-[#001F3D] disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-900/20 transition-all active:scale-95"
                    >
                        {isSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        <span>{isEdit ? 'GUARDAR CAMBIOS' : 'REGISTRAR TODO'}</span>
                    </button>
                </div>
            </div>
        </div>

        {/* Modal Subir Actas (solo para modo nuevo) */}
        {modalActasOpen && !isEdit && (
            <div
                className="modal-backdrop"
                style={{ zIndex: 20000 }}
                onClick={e => e.target === e.currentTarget && setModalActasOpen(false)}
            >
                <div className="modal-box" style={{ maxWidth: '90vw', width: 900, zIndex: 20001 }}>
                    <div className="modal-header">
                        <div>
                            <h6 style={{ margin: 0, fontWeight: 700, fontSize: 16, color: '#002D5A' }}>
                                Subir Actas (Globales)
                            </h6>
                            <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>
                                Sube una o más actas y asigna un nombre a cada una
                            </p>
                        </div>
                        <button onClick={() => setModalActasOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
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
                                    onChange={handleFileSelectActas}
                                    className="hidden"
                                    id="file-input-actas-mov-traslados"
                                />
                                <label
                                    htmlFor="file-input-actas-mov-traslados"
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

                        {actas.length > 0 && (
                            <div className="space-y-4">
                                <h6 className="text-sm font-bold text-gray-700 mb-3">
                                    Actas Seleccionadas ({actas.length})
                                </h6>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {actas.map((acta, index) => (
                                        <div
                                            key={index}
                                            className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
                                        >
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
                                                            onChange={e => handleUpdateNombreActa(index, e.target.value)}
                                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                            placeholder="Ej: Acta revisión 01"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemoveActa(index)}
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
                            onClick={() => setModalActasOpen(false)}
                            className="btn btn-secondary"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={() => setModalActasOpen(false)}
                            className="btn"
                            style={{ backgroundColor: '#002D5A', color: 'white' }}
                            onMouseOver={(e) => e.currentTarget && (e.currentTarget.style.backgroundColor = '#001f3d')}
                            onMouseOut={(e) => e.currentTarget && (e.currentTarget.style.backgroundColor = '#002D5A')}
                        >
                            Aceptar
                        </button>
                    </div>
                </div>
            </div>
        )}

        {modalPasswordOpen && (
            <div
                className="modal-backdrop"
                style={{ zIndex: 20010 }}
                onClick={e => e.target === e.currentTarget && setModalPasswordOpen(false)}
            >
                <div className="modal-box" style={{ maxWidth: 520, width: '90vw', zIndex: 20011 }}>
                    <div className="modal-header">
                        <div>
                            <h6 style={{ margin: 0, fontWeight: 700, fontSize: 16, color: '#002D5A' }}>
                                Confirmación Requerida
                            </h6>
                            <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>
                                No se han adjuntado actas. Para proceder con el guardado, ingrese la contraseña de autorización
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                setModalPasswordOpen(false);
                                setPasswordAutorizacion('');
                            }}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    <div className="modal-body">
                        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                            <Lock className="w-5 h-5 text-[#002D5A] flex-shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-[#002D5A] mb-1">Contraseña de autorización requerida</p>
                                <p className="text-xs text-blue-700">
                                    Se valida contra la contraseña dinámica del sistema.
                                </p>
                            </div>
                        </div>

                        <div>
                            <label className="form-label">Contraseña de autorización *</label>
                            <input
                                type="password"
                                name="pass_autorizacion_traslado"
                                autoComplete="off"
                                data-lpignore="true"
                                inputMode="text"
                                value={passwordAutorizacion}
                                onChange={e => setPasswordAutorizacion(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleConfirmarPassword()}
                                className="form-input"
                                style={{ fontSize: 12 }}
                                placeholder="Ingrese contraseña"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button
                            onClick={() => {
                                setModalPasswordOpen(false);
                                setPasswordAutorizacion('');
                            }}
                            className="btn btn-secondary"
                            disabled={isSaving}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirmarPassword}
                            className="btn"
                            style={{ backgroundColor: '#002D5A', color: 'white' }}
                            onMouseOver={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#001f3d')}
                            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#002D5A')}
                            disabled={isSaving || !passwordAutorizacion.trim()}
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aceptar'}
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}

// ─── Componente Principal ────────────────────────────────────────────────────
export default function TrasladoPage() {
    const { state, refreshTraslados, refreshProductos, showToast } = useCallao();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const PER_PAGE = 15;

    const [modalOpen, setModalOpen] = useState(false);
    const [editData, setEditData] = useState<RegistroTraslado | null>(null);
    
    // Estados para Cascada
    const [cargas, setCargas] = useState<api.TrasladoCascadaDB[]>([]);
    const [loadingCargas, setLoadingCargas] = useState(false);
    const [expandedCodigos, setExpandedCodigos] = useState<Set<string>>(new Set());

    // Estados para Actas
    const [modalVerActasOpen, setModalVerActasOpen] = useState(false);
    const [actasSeleccionadas, setActasSeleccionadas] = useState<api.ActaMovimientoDB[]>([]);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    
    const [modalSubirActasOpen, setModalSubirActasOpen] = useState(false);
    const [repIdActasTraslado, setRepIdActasTraslado] = useState<number | null>(null);
    const [actasParaSubir, setActasParaSubir] = useState<Array<{ file: File; nombre: string; preview: string }>>([]);
    const [subiendoActas, setSubiendoActas] = useState(false);

    // Estados para Observaciones
    const [modalObsOpen, setModalObsOpen] = useState(false);
    const [observacionesSeleccionadas, setObservacionesSeleccionadas] = useState('');

    const refreshCargas = useCallback(async () => {
        try {
            setLoadingCargas(true);
            const data = await api.getTrasladosCascada();
            setCargas(data);
        } catch (error: any) {
            console.error('Error cargando traslados cascada:', error);
            showToast('error', 'Error al cargar historial agrupado');
        } finally {
            setLoadingCargas(false);
        }
    }, [showToast]);

    useEffect(() => {
        void refreshCargas();
        refreshProductos();
    }, [refreshCargas, refreshProductos]);

    const filteredCargas = useMemo(() => {
        const q = search.toLowerCase();
        if (!q.trim()) return cargas;

        return cargas.filter(c => {
            const baseMatch =
                (c.codigo_carga || '').toLowerCase().includes(q) ||
                (c.operador || '').toLowerCase().includes(q) ||
                (c.fecha_primera || '').toLowerCase().includes(q);

            const detailMatch = c.detalles.some(d => {
                return (
                    (d.producto_nombre || '').toLowerCase().includes(q) ||
                    (d.operacion || '').toLowerCase().includes(q) ||
                    (d.tienda_salida_codigo || '').toLowerCase().includes(q) ||
                    (d.tienda_ingreso_codigo || '').toLowerCase().includes(q) ||
                    (d.operador || '').toLowerCase().includes(q)
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

    const openNew = () => { setEditData(null); setModalOpen(true); };
    const openEdit = (e: RegistroTraslado) => { setEditData(e); setModalOpen(true); };
    const handleCloseModalTraslado = () => {
        setModalOpen(false);
        setEditData(null);
        void refreshCargas();
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

    const guardarActasTraslado = async () => {
        if (subiendoActas) return;
        if (!repIdActasTraslado) {
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
            await api.agregarActaTraslado(
                repIdActasTraslado,
                actasParaSubir.map(a => ({ file: a.file, nombre: a.nombre }))
            );

            actasParaSubir.forEach(a => URL.revokeObjectURL(a.preview));
            setActasParaSubir([]);
            setModalSubirActasOpen(false);
            setRepIdActasTraslado(null);
            await refreshCargas();
            showToast('success', 'Actas subidas exitosamente');
        } catch (error: any) {
            console.error('Error subiendo actas traslado:', error);
            showToast('error', error.message || 'Error al subir las actas');
        } finally {
            setSubiendoActas(false);
        }
    };

    return (
        <div id="view-traslados" className="animate-in fade-in duration-500 font-poppins">
            <div className="container mx-auto">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6 transition-all">
                    <header className="flex justify-between items-center flex-wrap gap-4 mb-8">
                        <div className="flex items-center space-x-3">
                            <div className="w-11 h-11 bg-gradient-to-br from-[#002D5A] to-[#0056b3] rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-900/10 transition-transform hover:scale-110">
                                <ArrowRightLeft className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="font-bold text-gray-900 m-0 tracking-tight" style={{ fontSize: '18px' }}>
                                    Traslado entre Almacenes
                                </h1>
                                <p className="text-[11px] text-gray-400 mt-0.5 font-medium italic opacity-80">
                                    Gestiona el movimiento de productos entre tiendas y almacenes
</p>
                            </div>
                        </div>
                        <button
                            onClick={openNew}
                            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl font-bold transition-all duration-300 shadow-md text-[10px] bg-[#002D5A] hover:bg-[#001F3D] text-white hover:shadow-lg hover:-translate-y-0.5 active:scale-95 border-b-2 border-black/20"
                        >
                            <Plus className="w-3.5 h-3.5 stroke-[3px]" />
                            <span>REGISTRAR TRASLADO</span>
                        </button>
                    </header>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 mb-2 bg-transparent">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <Search className="w-4 h-4 text-[#002D5A]" />
                            </div>
                            <span className="font-bold text-gray-800" style={{ fontSize: 13 }}>
                                Total: {totalCargas} traslados
                            </span>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-72">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar por producto, operador, tienda..."
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
                                <div className="p-10 text-center text-gray-400">Cargando datos en cascada...</div>
                            ) : totalCargas === 0 ? (
                                <div className="p-10 text-center text-gray-400">
                                    {search ? 'No se encontraron traslados con ese criterio' : 'No hay traslados en cascada aún.'}
                                </div>
                            ) : (
                                paginatedCargas.map((carga, idx) => {
                                    const detalleRep = carga.detalles[0];
                                    const cargaKey = `${carga.codigo_carga || 'sin-codigo'}-${idx}`;
                                    const isOpen = expandedCodigos.has(cargaKey);
                                    const { fecha, hora } = formatFechaDosLineas(carga.fecha_primera);
                                    const itemsTotales = carga.detalles.reduce((acc, d) => acc + d.cantidad, 0);

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
                                                            <ChevronDown className="w-4 h-4 text-white" />
                                                        ) : (
                                                            <ChevronRight className="w-4 h-4 text-white" />
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
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 text-[10px] text-gray-600 whitespace-nowrap flex-shrink-0">
                                                    <span className="inline-flex items-center gap-2">
                                                        <ArrowRightLeft className="w-4 h-4 text-[#002D5A]" />
                                                        <span>
                                                            <span className="font-bold text-gray-900">{itemsTotales}</span> total
                                                        </span>
                                                    </span>
                                                    <span className="inline-flex items-center gap-2">
                                                        <FileImage className="w-4 h-4 text-[#002D5A]" />
                                                        <span>
                                                            <span className="font-bold text-gray-900">{carga.actas.length}</span> actas
                                                        </span>
                                                    </span>
                                                </div>
                                            </div>

                                            {isOpen && (
                                                <div className="pb-5">
                                                    <div className="bg-white rounded-2xl border border-gray-100 p-4">
                                                        <div className="flex items-start justify-between gap-4 mb-4">
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                                                                <div className="w-full sm:w-[180px]">
                                                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">REGISTRADOR</div>
                                                                    <div className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-[11px] font-bold text-gray-900">
                                                                        {detalleRep?.registrado_por || '-'}
                                                                    </div>
                                                                </div>
                                                                <div className="w-full sm:w-[180px]">
                                                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">OPERADOR</div>
                                                                    <div className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-[11px] font-bold text-gray-900">
                                                                        {detalleRep?.operador || '-'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <div className="text-[10px] text-gray-500">
                                                                    Actas: {' '}
                                                                    <span className="text-gray-900 font-bold">{carga.actas.length}</span>
                                                                </div>
                                                                <button
                                                                    onClick={() => {
                                                                        setActasSeleccionadas(carga.actas);
                                                                        setModalVerActasOpen(true);
                                                                    }}
                                                                    disabled={carga.actas.length === 0}
                                                                    className="shrink-0 px-4 py-2 text-[10px] rounded-xl font-bold bg-[#002D5A] hover:bg-[#001f3d] text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-start"
                                                                >
                                                                    <span>Ver Actas</span>
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Tabla interna */}
                                                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                                                            <div className="overflow-x-auto">
                                                                <table className="w-full text-sm">
                                                                    <thead className="bg-[#002D5A] text-white">
                                                                        <tr className="text-[9px] uppercase">
                                                                            <th className="px-4 py-3 text-left font-bold">PRODUCTO</th>
                                                                            <th className="px-4 py-3 text-left font-bold w-[160px]">OPERACIÓN</th>
                                                                            <th className="px-4 py-3 text-left font-bold w-[90px]">CANT.</th>
                                                                            <th className="px-4 py-3 text-left font-bold w-[120px]">U. MEDIDA</th>
                                                                            <th className="px-4 py-3 text-left font-bold w-[110px]">SALIÓ DE</th>
                                                                            <th className="px-4 py-3 text-left font-bold w-[120px]">INGRESÓ A</th>
                                                                            <th className="px-4 py-3 text-left font-bold w-[100px]">OBS.</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {carga.detalles.map(d => (
                                                                            <tr key={d.id} className="border-t border-gray-100 text-[11px] hover:bg-blue-50/30 transition-colors">
                                                                                <td className="px-4 py-3 text-gray-800 font-medium">{d.producto_nombre}</td>
                                                                                <td className="px-4 py-3">
                                                                                    {(() => {
                                                                                        const color = getOperacionColor(d.operacion);
                                                                                        return (
                                                                                            <span
                                                                                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${color.bg} ${color.text}`}
                                                                                            >
                                                                                                {d.operacion}
                                                                                            </span>
                                                                                        );
                                                                                    })()}
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
                                    className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                >
                                    «
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
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
                                    className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                >
                                    ›
                                </button>
                                <button
                                    onClick={() => setPage(pagesCargas)}
                                    disabled={page === pagesCargas}
                                    className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                >
                                    »
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Ver Actas */}
            {modalVerActasOpen && (
                <div
                    className="modal-backdrop animate-in fade-in duration-200 z-[30001] bg-black/60 backdrop-blur-sm"
                    onClick={e => e.target === e.currentTarget && setModalVerActasOpen(false)}
                >
                    <div className="modal-box max-w-5xl w-[95vw] max-h-[90vh] overflow-auto bg-white rounded-3xl shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100">
                            <div>
                                <h6 className="m-0 font-black text-lg text-[#002D5A] uppercase tracking-tight">
                                    Actas de Traslado
                                </h6>
                                <p className="m-0 text-[11px] text-gray-400 font-medium italic">
                                    {actasSeleccionadas.length} acta(s) encontrada(s)
                                </p>
                            </div>
                            <button
                                onClick={() => setModalVerActasOpen(false)}
                                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                <X className="w-6 h-6 text-gray-400" />
                            </button>
                        </div>

                        <div className="p-6">
                            {actasSeleccionadas.length === 0 ? (
                                <div className="py-20 flex flex-col items-center text-center opacity-30">
                                    <FileImage className="w-16 h-16 text-gray-300 mb-4" />
                                    <p className="text-gray-600 font-black uppercase tracking-widest">No hay actas registradas</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {actasSeleccionadas.map(acta => (
                                        <div
                                            key={acta.id}
                                            className="group border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-xl transition-all cursor-pointer hover:-translate-y-1"
                                            onClick={() => setLightboxUrl(acta.url_imagen)}
                                        >
                                            <div className="relative aspect-video bg-gray-50 overflow-hidden">
                                                <img
                                                    src={acta.url_imagen}
                                                    alt={acta.nombre_imagen}
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src =
                                                            'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23f9fafb" width="400" height="300"/%3E%3Ctext fill="%23d1d5db" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImagen no disponible%3C/text%3E%3C/svg%3E';
                                                    }}
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                    <Eye className="w-8 h-8 text-white drop-shadow-lg" />
                                                </div>
                                            </div>
                                            <div className="p-4 border-t border-gray-50">
                                                <div className="text-[11px] font-black text-gray-900 line-clamp-2 uppercase tracking-tight">
                                                    {acta.nombre_imagen}
                                                </div>
                                                <div className="text-[10px] text-gray-400 mt-2 flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                    Subido por: <span className="font-bold text-gray-600 uppercase italic">{acta.registrado_por || '-'}</span>
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
                    className="modal-backdrop animate-in fade-in duration-300 z-[40001] bg-black/95 backdrop-blur-xl"
                    onClick={() => setLightboxUrl(null)}
                >
                    <div className="relative w-full h-full flex items-center justify-center p-8">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setLightboxUrl(null);
                            }}
                            className="absolute top-8 right-8 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all flex items-center justify-center backdrop-blur-md shadow-2xl"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <img
                            src={lightboxUrl}
                            alt="Acta completa"
                            className="max-w-full max-h-full object-contain rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300 select-none"
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
                                        id="file-input-actas-subir-traslados-listado"
                                    />
                                    <label
                                        htmlFor="file-input-actas-subir-traslados-listado"
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

            <ModalTraslado
                isOpen={modalOpen}
                onClose={handleCloseModalTraslado}
                editData={editData}
            />

            {modalObsOpen && (
                <ModalObservaciones
                    isOpen={modalObsOpen}
                    onClose={() => setModalObsOpen(false)}
                    observaciones={observacionesSeleccionadas}
                />
            )}
        </div>
    );
}
