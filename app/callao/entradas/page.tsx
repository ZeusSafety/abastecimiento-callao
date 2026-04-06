'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
    useCallao,
    TIENDAS,
    OPERADORES,
    REGISTRADORES,
    OPS_ENTRADA,
    ORIGENES_ALMACEN_SALIDA_ENTRADA_CALLAO,
    TIENDAS_ETIQUETA_MOVIMIENTOS_CALLAO,
    getCodigoAlmacenSalidaEntrada,
    getCodigoFromTienda,
    etiquetaOrigenAlmacenSalidaEntrada,
    etiquetaTiendaMovimientosCallao,
    RegistroEntrada,
    Tienda,
    AlmacenCompleto,
    UnidadMedida,
    Producto,
    getOperacionColor,
} from '../../context/CallaoContext';
import {
    Plus,
    Search,
    Edit3,
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
    Check,
    XCircle,
    Image as ImageIcon,
    Calendar,
    Clock3
} from 'lucide-react';
import TableSkeleton from '../../components/TableSkeleton';
import ProductoAutocomplete from '../../components/ProductoAutocomplete';
import * as api from '../../services/api';

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

// ─── Modal Observaciones (por fila) ────────────────────────────────────────
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
    const { state, addEntrada, updateEntrada, showToast, refreshEntradas, refreshProductos } = useCallao();

    const [form, setForm] = useState({
        productoId: editData?.productoId ?? '',
        producto: editData?.producto ?? '',
        codigo: '', // Agregar código al estado del formulario
        operacion: editData?.operacion ?? OPS_ENTRADA[0],
        operacionPersonalizada: '',
        almacenSalida: (editData?.almacenSalida ?? 'ALMACEN MALVINAS') as AlmacenCompleto,
        almacenIngreso: (editData?.almacenIngreso ?? 'TIENDA OFICINA') as Tienda,
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
                operacion: OPS_ENTRADA[0],
                operacionPersonalizada: '',
                almacenSalida: 'ALMACEN MALVINAS',
                almacenIngreso: 'TIENDA OFICINA',
                operador: OPERADORES[0],
                cantidad: 0,
                unidadMedida: 'DOCENAS' as UnidadMedida,
                entregado: OPERADORES[0],
                registradoPor: REGISTRADORES[0],
                observaciones: '',
                motivoCambio: '',
            });
        }
    }, [isOpen, isEdit]);

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

    // Auto-fill unidad/codigo al seleccionar producto
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

        const nuevoProducto = {
            productoId: form.productoId,
            producto: form.producto,
            codigo: selectedProducto?.codigo || '',
            operacion: form.operacion,
            almacenSalida: form.almacenSalida,
            almacenIngreso: form.almacenIngreso,
            operador: form.operador,
            cantidad: Number(form.cantidad),
            unidadMedida: form.unidadMedida,
            entregado: form.entregado,
            registradoPor: form.registradoPor,
            observaciones: form.observaciones,
        };

        setProductosAgregados([...productosAgregados, nuevoProducto]);
        
        // Limpiar formulario excepto campos comunes y el código del producto
        // El código se mantiene hasta que el usuario cambie el producto
        setForm(f => ({
            ...f,
            cantidad: 0,
            observaciones: '',
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

    const prepararEntradasData = () => {
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
                entregado_por: p.entregado,
                registrado_por: p.registradoPor,
                observaciones: p.observaciones,
            };
        });
    };

    const ejecutarGuardadoEntradas = async (password?: string) => {
        setIsSaving(true);
        try {
            if (productosAgregados.length === 0) {
                showToast('error', 'Agrega al menos un producto antes de guardar');
                return;
            }

            const entradasData = prepararEntradasData();

            const archivosActas =
                actas.length > 0 ? actas.map(a => ({ file: a.file, nombre: a.nombre })) : undefined;

            await api.createEntradasMasivo(entradasData, {
                actas: archivosActas,
                passwordAutorizacion: archivosActas ? undefined : password,
            });

            await Promise.all([refreshEntradas(), refreshProductos()]);

            // Liberar previews
            actas.forEach(a => URL.revokeObjectURL(a.preview));
            setActas([]);
            setPasswordAutorizacion('');
            setModalActasOpen(false);
            setModalPasswordOpen(false);

            onClose();
            showToast('success', `${productosAgregados.length} producto(s) registrado(s) exitosamente`);
        } catch (error: any) {
            showToast('error', error.message || 'Error al registrar entradas');
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
        await ejecutarGuardadoEntradas(passwordAutorizacion);
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
                await Promise.all([refreshEntradas(), refreshProductos()]);
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

            // Seguridad: si NO hay actas, solicitar contraseña; si SÍ hay actas, guardar directo.
            if (actas.length === 0) {
                setModalPasswordOpen(true);
                return;
            }

            await ejecutarGuardadoEntradas();
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
                                    {ORIGENES_ALMACEN_SALIDA_ENTRADA_CALLAO.map(({ value, label }) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
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
                                    {TIENDAS_ETIQUETA_MOVIMIENTOS_CALLAO.map(({ tienda, label }) => (
                                        <option key={tienda} value={tienda}>{label}</option>
                                    ))}
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
                                    {OPERADORES.map(o => <option key={o} value={o}>{o.toUpperCase()}</option>)}
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
                                    {OPERADORES.map(o => <option key={o} value={o}>{o.toUpperCase()}</option>)}
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
                                        onChange={e => setForm(f => ({ ...f, registradoPor: e.target.value }))}
                                        className="form-input"
                                        style={{ paddingRight: 28, appearance: 'none', fontSize: 12 }}
                                    >
                                        {REGISTRADORES.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
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
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-green-700 bg-green-50/50 hover:bg-green-100 border border-green-200 rounded-lg transition-all duration-200 group"
                                style={{ fontSize: 12 }}
                            >
                                <Plus className="w-4 h-4 text-green-600 group-hover:scale-110 transition-transform" />
                                <span className="font-bold">Agregar Producto a la Lista</span>
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
                                                    <th className="px-3 py-2 text-left text-[9px] font-bold uppercase">Almacén Salida</th>
                                                    <th className="px-3 py-2 text-left text-[9px] font-bold uppercase">Ingreso</th>
                                                    <th className="px-2 py-2 text-center text-[9px] font-bold uppercase" style={{ width: '60px' }}>Cant.</th>
                                                    <th className="px-3 py-2 text-left text-[9px] font-bold uppercase">U.M</th>
                                                    <th className="px-3 py-2 text-center text-[9px] font-bold uppercase">Acción</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {productosAgregados.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-xs">
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
                                                                                {OPS_ENTRADA.map(op => <option key={op}>{op}</option>)}
                                                                            </select>
                                                                            <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                                                                        </div>
                                                                    ) : (
                                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${operacionColor.bg} ${operacionColor.text}`}>
                                                                            {p.operacion}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                {/* Almacén Salida */}
                                                                <td className="px-3 py-2">
                                                                    {isEditing ? (
                                                                        <div className="relative">
                                                                            <select
                                                                                value={p.almacenSalida}
                                                                                onChange={e => handleActualizarProducto(index, 'almacenSalida', e.target.value)}
                                                                                className="form-input text-[9px] py-1 px-2"
                                                                                style={{ paddingRight: 20, appearance: 'none' }}
                                                                                onClick={e => e.stopPropagation()}
                                                                            >
                                                                                {ORIGENES_ALMACEN_SALIDA_ENTRADA_CALLAO.map(({ value, label }) => (
                                                                                    <option key={value} value={value}>{label}</option>
                                                                                ))}
                                                                            </select>
                                                                            <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-[10px] text-gray-700">{etiquetaOrigenAlmacenSalidaEntrada(p.almacenSalida)}</span>
                                                                    )}
                                                                </td>
                                                                {/* Ingreso */}
                                                                <td className="px-3 py-2">
                                                                    {isEditing ? (
                                                                        <div className="relative">
                                                                            <select
                                                                                value={p.almacenIngreso}
                                                                                onChange={e => handleActualizarProducto(index, 'almacenIngreso', e.target.value)}
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
                                                                        <span className="text-[10px] text-gray-700">{etiquetaTiendaMovimientosCallao(p.almacenIngreso)}</span>
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
                                    id="file-input-actas-mov-entradas"
                                />
                                <label
                                    htmlFor="file-input-actas-mov-entradas"
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
                                name="pass_autorizacion_entradas"
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
export default function EntradasPage() {
    const { state, refreshEntradas, showToast } = useCallao();
    const [modalOpen, setModalOpen] = useState(false);
    const [editData, setEditData] = useState<RegistroEntrada | null>(null);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const PER_PAGE = 15;

    // ─── Vista Cascada (Listado de Entradas) ─────────────────────────────
    const [loadingCargas, setLoadingCargas] = useState(true);
    const [cargas, setCargas] = useState<api.EntradaCascadaDB[]>([]);
    const [expandedCodigos, setExpandedCodigos] = useState<Set<string>>(new Set());

    // ─── Actas (Ver / Subir) ─────────────────────────────────────────────
    const [modalVerActasOpen, setModalVerActasOpen] = useState(false);
    const [actasSeleccionadas, setActasSeleccionadas] = useState<api.ActaMovimientoDB[]>([]);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

    // ─── Observaciones (Modal por fila) ──────────────────────────────────
    const [modalObsOpen, setModalObsOpen] = useState(false);
    const [observacionesSeleccionadas, setObservacionesSeleccionadas] = useState<string>('');

    const [modalSubirActasOpen, setModalSubirActasOpen] = useState(false);
    const [repIdActasEntrada, setRepIdActasEntrada] = useState<number | null>(null);
    const [actasParaSubir, setActasParaSubir] = useState<Array<{ file: File; nombre: string; preview: string }>>([]);
    const [subiendoActas, setSubiendoActas] = useState(false);

    // Cargar entradas al montar el componente
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await refreshEntradas();
            setLoading(false);
        };
        loadData();
    }, [refreshEntradas]);

    // Cargar vista cascada por codigo_carga
    const refreshCargas = async () => {
        setLoadingCargas(true);
        try {
            const data = await api.getEntradasCascada();
            setCargas(data);
        } catch (error: any) {
            console.error('Error cargando entradas en cascada:', error);
            showToast('error', error.message || 'Error al cargar la vista en cascada');
        } finally {
            setLoadingCargas(false);
        }
    };

    useEffect(() => {
        refreshCargas();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
    const openEdit = (e: RegistroEntrada) => { setEditData(e); setModalOpen(true); };
    const handleCloseModalEntrada = () => {
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

    const guardarActasEntrada = async () => {
        if (subiendoActas) return;
        if (!repIdActasEntrada) {
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
            await api.agregarActaEntrada(
                repIdActasEntrada,
                actasParaSubir.map(a => ({ file: a.file, nombre: a.nombre }))
            );

            actasParaSubir.forEach(a => URL.revokeObjectURL(a.preview));
            setActasParaSubir([]);
            setModalSubirActasOpen(false);
            setRepIdActasEntrada(null);
            await refreshCargas();
            showToast('success', 'Actas subidas exitosamente');
        } catch (error: any) {
            console.error('Error subiendo actas entrada:', error);
            showToast('error', error.message || 'Error al subir las actas');
        } finally {
            setSubiendoActas(false);
        }
    };

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

                    {/* Cascada Accordion */}
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xl">
                        <div className="divide-y divide-gray-100">
                            {loadingCargas ? (
                                <div className="p-10 text-center text-gray-400">Cargando datos en cascada...</div>
                            ) : totalCargas === 0 ? (
                                <div className="p-10 text-center text-gray-400">
                                    {search ? 'No se encontraron cargas con ese criterio' : 'No hay movimientos en cascada aún.'}
                                </div>
                            ) : (
                                paginatedCargas.map((carga, idx) => {
                                    const detalleRep = carga.detalles[0];
                                    const repEntrada = detalleRep
                                        ? state.entradas.find(en => en.id === String(detalleRep.id)) || null
                                        : null;

                                    const cargaKey = `${carga.codigo_carga || 'sin-codigo'}-${idx}`;
                                    const isOpen = expandedCodigos.has(cargaKey);
                                    const { fecha, hora } = formatFechaDosLineas(carga.fecha_primera);
                                    const operacion = detalleRep?.operacion || '';
                                    const itemsTotales = carga.cantidad_items;

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
                                                        {/* Operación ya se muestra en la tabla interna */}
                                                    </div>
                                                </div>
                                                </div>

                                                <div className="flex items-center gap-4 text-[10px] text-gray-600 whitespace-nowrap flex-shrink-0">
                                                    <span className="inline-flex items-center gap-2">
                                                        <PackagePlus className="w-4 h-4 text-[#002D5A]" />
                                                        <span>
                                                            <span className="font-bold text-gray-900">{itemsTotales}</span> productos
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
                                                                    Actas:{' '}
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
                                    Página {page} de {pagesCargas}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.min(pagesCargas, p + 1))}
                                    disabled={page === pagesCargas}
                                    className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                    style={{ fontFamily: 'var(--font-poppins)' }}
                                >
                                    ›
                                </button>
                                <button
                                    onClick={() => setPage(pagesCargas)}
                                    disabled={page === pagesCargas}
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

            {/* Modal Ver Actas (Listado de Entradas) */}
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
                                    Actas de Entrada
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

                        <div className="modal-body">
                            {actasSeleccionadas.length === 0 ? (
                                <div className="py-12 flex flex-col items-center text-center">
                                    <FileImage className="w-12 h-12 text-gray-300 mb-4" />
                                    <p className="text-gray-600 font-semibold">No hay actas para esta carga</p>
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
                            onClick={(e) => {
                                e.stopPropagation();
                                setLightboxUrl(null);
                            }}
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

            {/* Modal Subir Acta (Listado de Entradas) */}
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
                                    Subir Acta (Entrada)
                                </h6>
                                <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>
                                    Selecciona imágenes y asigna un nombre a cada una
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    refreshActasSelectionReset();
                                    setModalSubirActasOpen(false);
                                    setRepIdActasEntrada(null);
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
                                        id="file-input-actas-subir-entradas-listado"
                                    />
                                    <label
                                        htmlFor="file-input-actas-subir-entradas-listado"
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
                                    setRepIdActasEntrada(null);
                                }}
                                className="btn btn-secondary"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={guardarActasEntrada}
                                disabled={actasParaSubir.length === 0 || subiendoActas}
                                className="btn"
                                style={{ backgroundColor: '#002D5A', color: 'white' }}
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

            {modalObsOpen && (
                <ModalObservaciones
                    isOpen={modalObsOpen}
                    onClose={() => setModalObsOpen(false)}
                    observaciones={observacionesSeleccionadas}
                />
            )}

            <ModalEntrada
                isOpen={modalOpen}
                onClose={handleCloseModalEntrada}
                editData={editData}
            />
        </div>
    );
}
