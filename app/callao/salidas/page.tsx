'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
    useCallao,
    TIENDAS,
    TIENDAS_ETIQUETA_MOVIMIENTOS_CALLAO,
    getCodigoFromTienda,
    etiquetaTiendaMovimientosCallao,
    OPERADORES,
    REGISTRADORES,
    COMBO_OTROS_VALUE,
    resolvePersonaCombo,
    OPS_SALIDA,
    RegistroSalida,
    Tienda,
    UnidadMedida,
    Producto,
    getOperacionColor,
} from '../../context/CallaoContext';
import {
    Plus, Search, Edit3, X, Save, PackageMinus, ChevronDown, Loader2, Trash2, Upload, Lock
} from 'lucide-react';
import ProductoAutocomplete from '../../components/ProductoAutocomplete';
import * as api from '../../services/api';
import CascadaMovimientosSalidas from './CascadaMovimientosSalidas';

// ─── Modal Salida ─────────────────────────────────────────────────────────────
function ModalSalida({
    isOpen,
    onClose,
    editData,
}: {
    isOpen: boolean;
    onClose: () => void;
    editData?: RegistroSalida | null;
}) {
    const { state, addSalida, updateSalida, showToast, refreshSalidas, refreshProductos } = useCallao();

    const [form, setForm] = useState({
        productoId: editData?.productoId ?? '',
        producto: editData?.producto ?? '',
        codigo: '', // Agregar código al estado del formulario
        operacion: editData?.operacion ?? OPS_SALIDA[0],
        operacionPersonalizada: '',
        comprobante: editData?.comprobante ?? '',
        asesor: editData?.asesor ?? '',
        cantidad: editData?.cantidad ?? 0,
        unidadMedida: (editData?.unidadMedida ?? 'DOCENAS') as UnidadMedida,
        almacen: (editData?.almacen ?? 'TIENDA OFICINA') as Tienda,
        entregado: OPERADORES[0],
        entregadoCustom: '',
        registradoPor: editData?.registradoPor ?? REGISTRADORES[0],
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
        comprobante: string;
        asesor: string;
        cantidad: number;
        unidadMedida: UnidadMedida;
        almacen: Tienda;
        entregado: string;
        registradoPor: string;
        observaciones: string;
    }>>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);

    // ─── Actas (globales por carga) + seguridad ───────────────────────────────
    const [modalActasOpen, setModalActasOpen] = useState(false);
    const [actas, setActas] = useState<Array<{ file: File; nombre: string; preview: string }>>([]);
    const [modalPasswordOpen, setModalPasswordOpen] = useState(false);
    const [passwordAutorizacion, setPasswordAutorizacion] = useState('');

    // Limpiar productos agregados cuando se abre el modal (solo para nuevo registro)
    useEffect(() => {
        if (isOpen && !isEdit) {
            setProductosAgregados([]);
            setEditingIndex(null);
            setForm({
                productoId: '',
                producto: '',
                codigo: '',
                operacion: OPS_SALIDA[0],
                operacionPersonalizada: '',
                comprobante: '',
                asesor: '',
                cantidad: 0,
                unidadMedida: 'DOCENAS' as UnidadMedida,
                almacen: 'TIENDA OFICINA',
                entregado: OPERADORES[0],
                entregadoCustom: '',
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
        const en = mapPersonaCombo(editData.entregado, OPERADORES);
        const reg = mapPersonaCombo(editData.registradoPor, REGISTRADORES);
        setForm(f => ({
            ...f,
            entregado: en.sel,
            entregadoCustom: en.custom,
            registradoPor: reg.sel,
            registradoCustom: reg.custom,
        }));
    }, [isEdit, editData]);

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
            codigo: producto.codigo, // Guardar código en el estado
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

        const registradoPor = resolvePersonaCombo(form.registradoPor, form.registradoCustom);
        if (form.registradoPor === COMBO_OTROS_VALUE && !registradoPor) {
            showToast('error', 'Indica quién registra (OTROS)');
            return;
        }

        const nuevoProducto = {
            productoId: form.productoId,
            producto: form.producto,
            codigo: selectedProducto?.codigo || '',
            operacion: form.operacion,
            comprobante: form.comprobante,
            asesor: form.asesor,
            cantidad: Number(form.cantidad),
            unidadMedida: form.unidadMedida,
            almacen: form.almacen,
            entregado: '',
            registradoPor,
            observaciones: form.observaciones,
        };

        setProductosAgregados([...productosAgregados, nuevoProducto]);
        
        // Limpiar formulario excepto campos comunes y el código del producto
        // El código se mantiene hasta que el usuario cambie el producto
        setForm(f => ({
            ...f,
            cantidad: 0,
            observaciones: '',
            // No limpiamos comprobante/asesor: deben permanecer hasta que el usuario los borre.
            // NO limpiar productoId, producto ni codigo para mantenerlos visibles
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
        // Si ya está editando esta fila, deseleccionarla
        if (editingIndex === index) {
            setEditingIndex(null);
        } else {
            setEditingIndex(index);
        }
    };

    const handleActualizarProducto = (index: number, campo: string, valor: any) => {
        setProductosAgregados(productosAgregados.map((p, i) => {
            if (i === index) {
                if (campo === 'productoId' || campo === 'producto') {
                    const producto = state.productos.find(pr => pr.id === valor);
                    return {
                        ...p,
                        productoId: valor,
                        producto: producto?.nombre || p.producto,
                        codigo: producto?.codigo || p.codigo,
                        unidadMedida: producto?.unidadMedidaRegCalculo || p.unidadMedida,
                    };
                }
                return { ...p, [campo]: valor };
            }
            return p;
        }));
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

    const prepararSalidasData = () => {
        return productosAgregados.map(p => {
            const prod = state.productos.find(pr => pr.id === p.productoId);
            if (!prod) throw new Error(`Producto ${p.productoId} no encontrado`);

            const almacenStr = getCodigoFromTienda(p.almacen);

            return {
                producto: prod.codigo,
                operacion: p.operacion,
                nro_comprobante: p.comprobante || undefined,
                asesor: p.asesor || undefined,
                cantidad: p.cantidad,
                unidad_medida: p.unidadMedida,
                almacen: almacenStr,
                entregado_por: undefined,
                registrado_por: p.registradoPor,
                observaciones: p.observaciones || undefined,
            };
        });
    };

    const ejecutarGuardadoSalidas = async (password?: string) => {
        setIsSaving(true);
        try {
            if (productosAgregados.length === 0) {
                showToast('error', 'Agrega al menos un producto antes de guardar');
                return;
            }

            const salidasData = prepararSalidasData();

            const archivosActas =
                actas.length > 0 ? actas.map(a => ({ file: a.file, nombre: a.nombre })) : undefined;

            await api.createSalidasMasivo(salidasData, {
                actas: archivosActas,
                passwordAutorizacion: archivosActas ? undefined : password,
            });

            await Promise.all([refreshSalidas(), refreshProductos()]);

            actas.forEach(a => URL.revokeObjectURL(a.preview));
            setActas([]);
            setPasswordAutorizacion('');
            setModalActasOpen(false);
            setModalPasswordOpen(false);

            onClose();
            showToast('success', `${productosAgregados.length} producto(s) registrado(s) exitosamente`);
        } catch (error: any) {
            showToast('error', error.message || 'Error al registrar salidas');
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
        await ejecutarGuardadoSalidas(passwordAutorizacion);
    };

    const handleSubmit = async () => {
        if (isEdit) {
            // Modo edición: comportamiento original
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
                const registradoPor = resolvePersonaCombo(form.registradoPor, form.registradoCustom);
                if (form.registradoPor === COMBO_OTROS_VALUE && !registradoPor) {
                    showToast('error', 'Indica quién registra (OTROS)');
                    return;
                }
                await updateSalida(editData!.id, {
                    productoId: form.productoId,
                    producto: form.producto,
                    operacion: form.operacion,
                    comprobante: form.comprobante,
                    asesor: form.asesor,
                    cantidad: Number(form.cantidad),
                    unidadMedida: form.unidadMedida,
                    almacen: form.almacen,
                    entregado: '',
                    registradoPor,
                    observaciones: form.observaciones,
                }, form.motivoCambio);
                await Promise.all([refreshSalidas(), refreshProductos()]);
                onClose();
            } catch (error) {
                // El error ya se maneja en las funciones del contexto
            }
        } else {
            // Modo nuevo: guardar todos los productos agregados
            if (productosAgregados.length === 0) {
                showToast('error', 'Agrega al menos un producto antes de guardar');
                return;
            }
            // Seguridad: si NO hay actas, pedir contraseña; si SÍ hay actas, guardar directo.
            if (actas.length === 0) {
                setModalPasswordOpen(true);
                return;
            }

            await ejecutarGuardadoSalidas();
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
                            style={{ background: '#fce7f3' }}
                        >
                            <PackageMinus className="w-4 h-4" style={{ color: '#9d174d' }} />
                        </div>
                        <div>
                            <h6 style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#002D5A' }}>
                                {isEdit ? 'Editar Salida' : 'Registrar Salida'}
                            </h6>
                            <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>
                                {isEdit ? 'Modifica los datos de la salida seleccionada' : 'Completa los datos de la salida'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="modal-body">
                    <div className="grid grid-cols-2 gap-4">
                        {/* Fecha */}
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
                            <ProductoAutocomplete
                                productos={state.productos}
                                value={form.productoId}
                                onChange={handleProductoChange}
                                placeholder="Buscar producto..."
                            />
                        </div>

                        {/* Código */}
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

                        {/* Existencia por Tienda */}
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

                        {/* Operación */}
                        <div>
                            <label className="form-label">Operación *</label>
                            <div className="relative">
                                <select
                                    value={form.operacion}
                                    onChange={e => {
                                        const nuevaOperacion = e.target.value;
                                        setForm(f => ({ 
                                            ...f, 
                                            operacion: nuevaOperacion, 
                                    // Mantener comprobante/asesor para no borrar lo que el usuario ingresó
                                        }));
                                    }}
                                    className="form-input"
                                    style={{ paddingRight: 28, appearance: 'none', fontSize: 12 }}
                                >
                                    {OPS_SALIDA.map(op => <option key={op}>{op}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* N° Comprobante */}
                        <div>
                            <label className="form-label">N° de Comprobante</label>
                            <input
                                type="text"
                                value={form.comprobante}
                                onChange={e => {
                                    let valor = e.target.value;
                                    // Detectar si hay una letra al inicio y formatearla: convertir a mayúscula y agregar espacio
                                    const match = valor.match(/^([a-zA-Z])(.*)$/);
                                    if (match) {
                                        const letra = match[1].toUpperCase();
                                        const resto = match[2].trim();
                                        // Si el resto no empieza con espacio, agregarlo
                                        valor = resto.startsWith(' ') ? `${letra}${resto}` : `${letra} ${resto}`;
                                    }
                                    setForm(f => ({ ...f, comprobante: valor }));
                                }}
                                className="form-input"
                                style={{ fontSize: 12 }}
                                placeholder="Ej: F001-00123"
                            />
                        </div>

                        {/* Asesor */}
                        <div>
                            <label className="form-label">Asesor</label>
                            <input
                                type="text"
                                value={form.asesor}
                                onChange={e => setForm(f => ({ ...f, asesor: e.target.value.toUpperCase() }))}
                                className="form-input"
                                style={{ fontSize: 12 }}
                                placeholder="Nombre del asesor"
                            />
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

                        {/* Unidad medida (auto) */}
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

                        {/* Almacén */}
                        <div>
                            <label className="form-label">Almacén</label>
                            <div className="relative">
                                <select
                                    value={form.almacen}
                                    onChange={e => setForm(f => ({ ...f, almacen: e.target.value as Tienda }))}
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

                        {/* Registrado por */}
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
                            </div>
                            {form.registradoPor === COMBO_OTROS_VALUE && (
                                <input
                                    type="text"
                                    value={form.registradoCustom}
                                    onChange={e => setForm(f => ({ ...f, registradoCustom: e.target.value.toUpperCase() }))}
                                    className="form-input w-full mt-2"
                                    style={{ fontSize: 12 }}
                                    placeholder="Nombre"
                                />
                            )}
                        </div>

                        {/* Observaciones */}
                        <div className="col-span-2">
                            <label className="form-label">Observaciones</label>
                            <textarea
                                value={form.observaciones}
                                    onChange={e => setForm(f => ({ ...f, observaciones: e.target.value.toUpperCase() }))}
                                className="form-input"
                                rows={3}
                                style={{ resize: 'vertical', fontSize: 12 }}
                                placeholder="Escribe una observación..."
                            />
                        </div>

                        {/* Botón Agregar Producto (solo en modo nuevo) */}
                        {!isEdit && (
                            <div className="col-span-2">
                                <button
                                    type="button"
                                    onClick={handleAgregarProducto}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
                                    style={{ fontSize: 12 }}
                                >
                                    <Plus className="w-4 h-4" />
                                    Agregar Producto a la Lista
                                </button>
                            </div>
                        )}

                        {/* Tabla Productos Agregados (solo en modo nuevo) */}
                        {!isEdit && (
                            <div className="col-span-2 mt-4">
                                <label className="form-label mb-2">Productos Agregados</label>
                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                    <div className="overflow-x-auto max-h-[300px]">
                                        <table className="w-full text-sm">
                                            <thead className="bg-[#002D5A] text-white sticky top-0">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-[9px] font-bold uppercase">Producto</th>
                                                    <th className="px-3 py-2 text-left text-[9px] font-bold uppercase" style={{ minWidth: '100px' }}>Código</th>
                                                    <th className="px-3 py-2 text-left text-[9px] font-bold uppercase">Operación</th>
                                                    <th className="px-3 py-2 text-left text-[9px] font-bold uppercase">Comprobante</th>
                                                    <th className="px-3 py-2 text-left text-[9px] font-bold uppercase">Asesor</th>
                                                    <th className="px-2 py-2 text-center text-[9px] font-bold uppercase" style={{ width: '60px' }}>Cant.</th>
                                                    <th className="px-3 py-2 text-left text-[9px] font-bold uppercase">U.M</th>
                                                    <th className="px-3 py-2 text-left text-[9px] font-bold uppercase">Almacén</th>
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
                                                    productosAgregados.map((p, index) => {
                                                        const operacionColor = getOperacionColor(p.operacion);
                                                        const isEditing = editingIndex === index;
                                                        return (
                                                            <tr 
                                                                key={index} 
                                                                className={`hover:bg-gray-50 ${isEditing ? 'bg-yellow-50 border-l-4 border-yellow-500' : ''}`}
                                                                onClick={() => handleEditarProducto(index)}
                                                                style={{ cursor: 'pointer' }}
                                                            >
                                                                {/* Producto */}
                                                                <td className="px-3 py-2">
                                                                    {isEditing ? (
                                                                        <div onClick={e => e.stopPropagation()}>
                                                                            <ProductoAutocomplete
                                                                                productos={state.productos}
                                                                                value={p.productoId}
                                                                                onChange={(productoId, producto) => handleProductoChangeInTable(index, productoId, producto)}
                                                                                placeholder="Buscar producto..."
                                                                            />
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-[10px] font-medium text-gray-900">{p.producto}</span>
                                                                    )}
                                                                </td>
                                                                {/* Código */}
                                                                <td className="px-3 py-2" style={{ minWidth: '100px' }}>
                                                                    <span className="text-[10px] text-gray-700 uppercase font-medium">{p.codigo || '-'}</span>
                                                                </td>
                                                                {/* Operación */}
                                                                <td className="px-3 py-2">
                                                                    {isEditing ? (
                                                                        <div className="relative">
                                                                            <select
                                                                                value={p.operacion}
                                                                                onChange={e => handleActualizarProducto(index, 'operacion', e.target.value)}
                                                                                className="form-input text-[9px] py-1 px-2"
                                                                                style={{ paddingRight: 20, appearance: 'none' }}
                                                                                onClick={e => e.stopPropagation()}
                                                                            >
                                                                                {OPS_SALIDA.map(op => <option key={op}>{op}</option>)}
                                                                            </select>
                                                                            <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                                                                        </div>
                                                                    ) : (
                                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${operacionColor.bg} ${operacionColor.text}`}>
                                                                            {p.operacion}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                {/* Comprobante */}
                                                                <td className="px-3 py-2">
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="text"
                                                                            value={p.comprobante}
                                                                            onChange={e => {
                                                                                let valor = e.target.value;
                                                                                // Detectar si hay una letra al inicio y formatearla: convertir a mayúscula y agregar espacio
                                                                                const match = valor.match(/^([a-zA-Z])(.*)$/);
                                                                                if (match) {
                                                                                    const letra = match[1].toUpperCase();
                                                                                    const resto = match[2].trim();
                                                                                    // Si el resto no empieza con espacio, agregarlo
                                                                                    valor = resto.startsWith(' ') ? `${letra}${resto}` : `${letra} ${resto}`;
                                                                                }
                                                                                handleActualizarProducto(index, 'comprobante', valor);
                                                                            }}
                                                                            className="form-input text-[10px] py-1 px-2"
                                                                            onClick={e => e.stopPropagation()}
                                                                        />
                                                                    ) : (
                                                                        <span className="text-[10px] text-gray-700">{p.comprobante || '-'}</span>
                                                                    )}
                                                                </td>
                                                                {/* Asesor */}
                                                                <td className="px-3 py-2">
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="text"
                                                                            value={p.asesor}
                                                                            onChange={e => handleActualizarProducto(index, 'asesor', e.target.value.toUpperCase())}
                                                                            className="form-input text-[10px] py-1 px-2"
                                                                            onClick={e => e.stopPropagation()}
                                                                        />
                                                                    ) : (
                                                                        <span className="text-[10px] text-gray-700">{p.asesor || '-'}</span>
                                                                    )}
                                                                </td>
                                                                {/* Cantidad */}
                                                                <td className="px-2 py-2 text-center" style={{ width: '60px' }}>
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            value={p.cantidad === 0 ? '' : p.cantidad}
                                                                            onChange={e => {
                                                                                const val = e.target.value === '' ? 0 : Number(e.target.value);
                                                                                handleActualizarProducto(index, 'cantidad', val);
                                                                            }}
                                                                            className="form-input text-[10px] py-1 px-1 w-full text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                            style={{ fontSize: 10 }}
                                                                            onClick={e => e.stopPropagation()}
                                                                        />
                                                                    ) : (
                                                                        <span className="text-[10px] font-bold text-gray-900">{p.cantidad}</span>
                                                                    )}
                                                                </td>
                                                                {/* U.M */}
                                                                <td className="px-3 py-2">
                                                                    <span className="text-[10px] text-gray-700">{p.unidadMedida}</span>
                                                                </td>
                                                                {/* Almacén */}
                                                                <td className="px-3 py-2">
                                                                    {isEditing ? (
                                                                        <div className="relative">
                                                                            <select
                                                                                value={p.almacen}
                                                                                onChange={e => handleActualizarProducto(index, 'almacen', e.target.value)}
                                                                                className="form-input text-[9px] py-1 px-2"
                                                                                style={{ paddingRight: 20, appearance: 'none' }}
                                                                                onClick={e => e.stopPropagation()}
                                                                            >
                                                                                {TIENDAS_ETIQUETA_MOVIMIENTOS_CALLAO.map(({ tienda, label }) => (
                                                                                    <option key={tienda} value={tienda}>{label}</option>
                                                                                ))}
                                                                            </select>
                                                                            <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-[10px] text-gray-700">{etiquetaTiendaMovimientosCallao(p.almacen)}</span>
                                                                    )}
                                                                </td>
                                                                {/* Acción */}
                                                                <td className="px-3 py-2 text-center">
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        {isEditing ? (
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
                                                                                handleEliminarProducto(index);
                                                                            }}
                                                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                            title="Eliminar"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Motivo cambio (solo edición) */}
                        {isEdit && (
                            <div className="col-span-2">
                                <label className="form-label" style={{ color: '#dc2626' }}>Motivo del Cambio *</label>
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
                    <button onClick={onClose} className="btn btn-secondary" disabled={isSaving}>Cancelar</button>
                    <button 
                        onClick={handleSubmit} 
                        className="btn btn-primary"
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                {isEdit ? 'Guardar Cambios' : `Guardar ${productosAgregados.length > 0 ? `(${productosAgregados.length})` : ''}`}
                            </>
                        )}
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
                                    id="file-input-actas-mov-salidas"
                                />
                                <label
                                    htmlFor="file-input-actas-mov-salidas"
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

        {/* Modal Contraseña (solo si NO hay actas al guardar) */}
        {modalPasswordOpen && !isEdit && (
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
                                name="pass_autorizacion_salidas"
                                autoComplete="new-password"
                                data-lpignore="true"
                                inputMode="text"
                                value={passwordAutorizacion}
                                onChange={e => setPasswordAutorizacion(e.target.value)}
                                className="form-input"
                                style={{ fontSize: 12 }}
                                placeholder="Ingrese contraseña"
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
                            Aceptar
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SalidasPage() {
    const { state, refreshSalidas } = useCallao();
    const [modalOpen, setModalOpen] = useState(false);
    const [editData, setEditData] = useState<RegistroSalida | null>(null);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const PER_PAGE = 15;
    const [cascadaRefreshKey, setCascadaRefreshKey] = useState(0);
    const [wasModalOpen, setWasModalOpen] = useState(false);

    useEffect(() => {
        if (wasModalOpen && !modalOpen) {
            setCascadaRefreshKey(k => k + 1);
        }
        setWasModalOpen(modalOpen);
    }, [modalOpen, wasModalOpen]);

    return (
        <div id="view-salidas" className="animate-in fade-in duration-500 font-poppins">
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
                                    Movimientos de Salidas
                                </h1>
                                <p className="text-[11px] text-gray-400 mt-0.5 font-medium italic opacity-80">Registro completo de todas las salidas</p>
                            </div>
                        </div>
                        <div className="header-actions flex gap-3">
                            <button
                                onClick={() => { setEditData(null); setModalOpen(true); }}
                                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl font-bold transition-all duration-300 shadow-md text-[10px] bg-[#002D5A] hover:bg-[#001F3D] text-white hover:shadow-lg hover:-translate-y-0.5 active:scale-95 border-b-2 border-black/20"
                            >
                                <Plus className="w-3.5 h-3.5 stroke-[3px]" />
                                <span>REGISTRAR SALIDA</span>
                            </button>
                        </div>
                    </header>

                    {/* Toolbar - Moved out of the card table area */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 mb-2 bg-transparent">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-pink-50 rounded-lg">
                                <Search className="w-4 h-4 text-[#9d174d]" />
                            </div>
                            <span className="font-bold text-gray-800" style={{ fontSize: 14 }}>
                                Listado de Salidas
                            </span>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-72">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar producto, asesor..."
                                    value={search}
                                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-pink-50 focus:border-[#9d174d] outline-none transition-all shadow-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Cascada Accordion */}
                    <CascadaMovimientosSalidas
                        search={search}
                        page={page}
                        setPage={setPage}
                        PER_PAGE={PER_PAGE}
                        refreshKey={cascadaRefreshKey}
                    />
                </div>
            </div>

            <ModalSalida
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditData(null); }}
                editData={editData}
            />
        </div>
    );
}
