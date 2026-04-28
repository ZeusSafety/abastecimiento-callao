'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  useCallao,
  TIENDAS,
  TIENDAS_VISTA_INVENTARIO_CALLAO,
  Tienda,
  Producto,
  OPERADORES,
  REGISTRADORES,
  COMBO_OTROS_VALUE,
  resolvePersonaCombo,
} from '../context/CallaoContext';
import { Search, RefreshCw, TrendingUp, Package, AlertTriangle, Building, Box, Columns2, Check, X, Lock, FileSpreadsheet, Upload } from 'lucide-react';
import TableSkeleton from '../components/TableSkeleton';
import * as api from '../services/api';
import * as XLSX from 'xlsx';

interface EditingProduct extends Producto {
    editing: {
        cantidadRegCalculo: number;
        stockMinimo: Record<Tienda, number>;
        // Existencia no se edita, solo se actualiza con entradas/salidas
    };
}

function StockBadge({ value, min }: { value: number; min: number }) {
    if (value === 0) return <span className="text-gray-400">0</span>;
    if (value < min && min > 0) {
        return (
            <span className="text-white font-bold px-2 py-1 rounded" style={{ backgroundColor: '#dc2626' }}>
                {value}
            </span>
        );
    }
    return <span className="text-gray-900 font-medium">{value}</span>;
}

const STORAGE_KEY_SELECTED = 'callao_inventario_selected';
const STORAGE_KEY_EDITING = 'callao_inventario_editing';
const TIENDAS_DISPONIBLES_CALLAO: ReadonlyArray<Tienda> = [
    'TIENDA OFICINA',
    'TIENDA CALLAO-1-A',
    'TIENDA CALLAO-1-B',
    'TIENDA CALLAO-2',
];

export default function StockTotalPage() {
    const { state, refreshProductos, refreshEntradas, showToast } = useCallao();
    const [search, setSearch] = useState('');
    const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
    const [editingProducts, setEditingProducts] = useState<Map<string, EditingProduct>>(new Map());
    const [isSaving, setIsSaving] = useState(false);
    const [isRestoring, setIsRestoring] = useState(true);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState(false);
    const isLoading = state.loading;

    // ─── Importación Excel -> Movimientos de Entrada (OTROS) ───────────────────
    const [importFile, setImportFile] = useState<File | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importMovs, setImportMovs] = useState<api.ImportStockTotalResult['movimientos_entrada_sugeridos']>([]);
    const [importNegativos, setImportNegativos] = useState<api.ImportStockTotalResult['ajustes_negativos']>([]);
    const [importFilasConfig, setImportFilasConfig] = useState(0);
    const [isImportingPreview, setIsImportingPreview] = useState(false);
    const [isImportSaving, setIsImportSaving] = useState(false);

    const [importForm, setImportForm] = useState({
        operacion: 'OTROS',
        almacenSalida: 'MALVINAS',
        operador: OPERADORES[0],
        operadorCustom: '',
        entregado: OPERADORES[0],
        entregadoCustom: '',
        registradoPor: REGISTRADORES[0],
        registradoCustom: '',
        observaciones: '',
    });
    const [importActas, setImportActas] = useState<Array<{ id: string; file: File; nombre: string; preview: string }>>([]);
    const [showImportPasswordModal, setShowImportPasswordModal] = useState(false);
    const [importPassword, setImportPassword] = useState('');

    // Restaurar datos del localStorage al cargar (solo una vez cuando los productos estén listos)
    useEffect(() => {
        // Solo restaurar si los productos están cargados y no estamos en estado de carga
        if (isLoading || state.productos.length === 0) return;

        try {
            const savedSelected = localStorage.getItem(STORAGE_KEY_SELECTED);
            const savedEditing = localStorage.getItem(STORAGE_KEY_EDITING);

            if (savedSelected) {
                const selectedArray = JSON.parse(savedSelected);
                if (Array.isArray(selectedArray) && selectedArray.length > 0) {
                    // Verificar que los productos seleccionados aún existen
                    const validSelected = selectedArray.filter(id => 
                        state.productos.some(p => p.id === id)
                    );
                    if (validSelected.length > 0) {
                        setSelectedProducts(new Set(validSelected));
                    }
                }
            }

            if (savedEditing) {
                const editingData = JSON.parse(savedEditing);
                if (typeof editingData === 'object' && editingData !== null) {
                    const restoredEditing = new Map<string, EditingProduct>();
                    
                    Object.entries(editingData).forEach(([productId, editing]: [string, any]) => {
                        // Verificar que el producto aún existe en la lista
                        const producto = state.productos.find(p => p.id === productId);
                        if (producto && editing && editing.editing) {
                            restoredEditing.set(productId, {
                                ...producto,
                                editing: {
                                    cantidadRegCalculo: editing.editing.cantidadRegCalculo ?? producto.cantidadRegCalculo,
                                    stockMinimo: editing.editing.stockMinimo || { ...producto.stockMinimo },
                                },
                            });
                        }
                    });
                    
                    if (restoredEditing.size > 0) {
                        setEditingProducts(restoredEditing);
                        // Restaurar también los seleccionados si no se restauraron antes
                        if (!savedSelected) {
                            setSelectedProducts(new Set(restoredEditing.keys()));
                        }
                        showToast('info', `Se restauraron ${restoredEditing.size} producto(s) en edición`);
                    }
                }
            }
        } catch (error) {
            console.error('Error al restaurar datos del localStorage:', error);
        } finally {
            setIsRestoring(false);
        }
    }, [isLoading, state.productos]); // Ejecutar cuando los productos se carguen

    // Guardar selectedProducts en localStorage
    useEffect(() => {
        if (!isRestoring) {
            try {
                const selectedArray = Array.from(selectedProducts);
                localStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify(selectedArray));
            } catch (error) {
                console.error('Error al guardar selectedProducts:', error);
            }
        }
    }, [selectedProducts, isRestoring]);

    // Guardar editingProducts en localStorage
    useEffect(() => {
        if (isRestoring) return;

        try {
            if (editingProducts.size > 0) {
                const editingData: Record<string, any> = {};
                editingProducts.forEach((editing, productId) => {
                    editingData[productId] = {
                        editing: {
                            cantidadRegCalculo: editing.editing.cantidadRegCalculo,
                            stockMinimo: editing.editing.stockMinimo,
                        },
                    };
                });
                localStorage.setItem(STORAGE_KEY_EDITING, JSON.stringify(editingData));
            } else {
                // Solo limpiar editingProducts del localStorage cuando no hay productos en edición
                localStorage.removeItem(STORAGE_KEY_EDITING);
            }
        } catch (error) {
            console.error('Error al guardar/limpiar editingProducts:', error);
        }
    }, [editingProducts, isRestoring]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return state.productos.filter(
            p => p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)
        );
    }, [state.productos, search]);

    // Stats cards
    const totalProductos = state.productos.length;
    const entradas = state.entradas.length;
    const salidas = state.salidas.length;
    const traslados = state.traslados.length;
    const alertas = state.productos.filter(p =>
        TIENDAS.some(t => p.existencia[t] < p.stockMinimo[t])
    ).length;

    const stats = [
        { label: 'Productos', value: totalProductos, icon: Package, color: '#002D5A', bg: '#E9F1FF' },
        { label: 'Entradas', value: entradas, icon: TrendingUp, color: '#1eaf4e', bg: '#dbfeec' },
        { label: 'Salidas', value: salidas, icon: TrendingUp, color: '#9d174d', bg: '#fce7f3' },
        { label: 'Traslados', value: traslados, icon: TrendingUp, color: '#3a9ced', bg: '#e9f4fe' },
    ];

    // Manejar selección de fila
    const handleRowClick = (productId: string) => {
        const newSelected = new Set(selectedProducts);
        if (newSelected.has(productId)) {
            newSelected.delete(productId);
            // Si estaba editando, cancelar edición
            const newEditing = new Map(editingProducts);
            newEditing.delete(productId);
            setEditingProducts(newEditing);
        } else {
            newSelected.add(productId);
            // Iniciar modo edición
            const producto = state.productos.find(p => p.id === productId);
            if (producto) {
                const newEditing = new Map(editingProducts);
                newEditing.set(productId, {
                    ...producto,
                    editing: {
                        cantidadRegCalculo: producto.cantidadRegCalculo,
                        stockMinimo: { ...producto.stockMinimo },
                        // Existencia no se edita, solo se actualiza con entradas/salidas
                    },
                });
                setEditingProducts(newEditing);
            }
        }
        setSelectedProducts(newSelected);
    };

    // Actualizar valor en edición
    const updateEditingValue = (productId: string, field: 'cantidadRegCalculo' | 'stockMinimo', tienda?: Tienda, value?: number) => {
        const editing = editingProducts.get(productId);
        if (!editing) return;

        const newEditing = new Map(editingProducts);
        const updated = { ...editing };
        
        if (field === 'cantidadRegCalculo') {
            updated.editing.cantidadRegCalculo = value || 0;
        } else if (field === 'stockMinimo' && tienda) {
            updated.editing.stockMinimo[tienda] = value || 0;
        }
        
        newEditing.set(productId, updated);
        setEditingProducts(newEditing);
    };

    // Abrir modal de contraseña antes de confirmar
    const handleConfirmAllClick = () => {
        if (editingProducts.size === 0) return;
        setShowPasswordModal(true);
        setPassword('');
        setPasswordError(false);
    };

    // Misma clave que movimientos sin acta (configuracion_sistema_callao.pass_movimiento_sin_acta)
    const handleConfirmAll = async () => {
        const ingresada = password.trim();
        if (!ingresada) {
            setPasswordError(true);
            showToast('error', 'Ingresa la contraseña');
            return;
        }
        try {
            const conf = await api.obtenerPasswordMovimientos();
            if ((conf.password || '') !== ingresada) {
                setPasswordError(true);
                showToast('error', 'Contraseña incorrecta');
                return;
            }
        } catch {
            setPasswordError(true);
            showToast('error', 'No se pudo validar la contraseña. Revisa la conexión.');
            return;
        }

        setShowPasswordModal(false);
        setPassword('');
        setPasswordError(false);

        if (editingProducts.size === 0) return;

        setIsSaving(true);
        try {
            // Preparar payload masivo para el backend
            const productosPayload = Array.from(editingProducts.entries()).map(([productId, editing]) => {
                const stockMinimoMap: Record<string, number> = {};
                TIENDAS.forEach(t => {
                    const codigo = t.replace('TIENDA ', '');
                    stockMinimoMap[codigo] = editing.editing.stockMinimo[t];
                });
                return {
                    id: parseInt(productId),
                    cantidad_reg_calculo: editing.editing.cantidadRegCalculo,
                    stock_minimo: stockMinimoMap,
                };
            });

            await api.updateProductosMasivo(productosPayload);

            // Refrescar UNA sola vez
            await refreshProductos();

            // Limpiar selección/edición de UNA sola vez
            setSelectedProducts(new Set());
            setEditingProducts(new Map());

            // Limpiar localStorage después de guardar exitosamente
            try {
                localStorage.removeItem(STORAGE_KEY_EDITING);
                localStorage.removeItem(STORAGE_KEY_SELECTED);
            } catch (error) {
                console.error('Error al limpiar localStorage:', error);
            }

            showToast('success', 'Productos actualizados exitosamente');
        } catch (error: any) {
            showToast('error', error.message || 'Error al actualizar productos');
        } finally {
            setIsSaving(false);
        }
    };

    // Cancelar edición de un producto
    const handleCancelProduct = (productId: string) => {
        const newSelected = new Set(selectedProducts);
        newSelected.delete(productId);
        setSelectedProducts(newSelected);
        
        const newEditing = new Map(editingProducts);
        newEditing.delete(productId);
        setEditingProducts(newEditing);
    };

    const handleExportExcel = () => {
        const headerTop = [
            'CODIGO',
            'PRODUCTO',
            'CANT.',
            'STOCK MINIMO',
            '',
            '',
            '',
            '',
            'STOCK GLOBAL',
            'U. MEDIDA',
            'EXISTENCIA ALMACEN',
            '',
            '',
            '',
            '',
            'DISPONIBLES',
            'STOCK DETALLADO',
        ];

        const headerBottom = [
            '',
            '',
            '',
            ...TIENDAS_VISTA_INVENTARIO_CALLAO.map(({ etiqueta }) => etiqueta),
            'TOTAL',
            'U.MED',
            ...TIENDAS_VISTA_INVENTARIO_CALLAO.map(({ etiqueta }) => etiqueta),
            'TOTAL',
            'DOC,DEC,UNI SUELTAS',
        ];

        const rows = filtered.map(p => {
            const editing = editingProducts.get(p.id);
            const stockMin = editing ? editing.editing.stockMinimo : p.stockMinimo;
            const cantidadReg = editing ? editing.editing.cantidadRegCalculo : p.cantidadRegCalculo;
            const stockGlobalMin = TIENDAS_VISTA_INVENTARIO_CALLAO.reduce(
                (acc, { tienda }) => acc + (stockMin[tienda] || 0),
                0
            );
            const disponibles = TIENDAS_DISPONIBLES_CALLAO.reduce(
                (acc, tienda) => acc + (p.existencia[tienda] || 0),
                0
            );
            // Doc,Dec,Uni Sueltas refleja exclusivamente la sede Oficina-Docenas por producto.
            const medidaValor = p.existencia['TIENDA OFICINA-DOCENAS'] || 0;

            return [
                p.codigo, // 0
                p.nombre, // 1
                cantidadReg, // 2
                ...TIENDAS_VISTA_INVENTARIO_CALLAO.map(({ tienda }) => stockMin[tienda] || 0), // 3,4,5,6,7
                stockGlobalMin, // 8
                p.unidadMedidaRegCalculo, // 9
                ...TIENDAS_VISTA_INVENTARIO_CALLAO.map(({ tienda }) => p.existencia[tienda] || 0), // 10,11,12,13,14
                disponibles, // 15
                medidaValor, // 16
            ];
        });

        const ws = XLSX.utils.aoa_to_sheet([headerTop, headerBottom, ...rows]);
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // CODIGO
            { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // PRODUCTO
            { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }, // CANT.
            { s: { r: 0, c: 3 }, e: { r: 0, c: 7 } }, // STOCK MINIMO (5 stores)
            { s: { r: 0, c: 8 }, e: { r: 1, c: 8 } }, // STOCK GLOBAL
            { s: { r: 0, c: 9 }, e: { r: 1, c: 9 } }, // U. MEDIDA
            { s: { r: 0, c: 10 }, e: { r: 0, c: 14 } }, // EXISTENCIA ALMACEN (5 stores)
            { s: { r: 0, c: 15 }, e: { r: 1, c: 15 } }, // DISPONIBLES
            { s: { r: 0, c: 16 }, e: { r: 1, c: 16 } }, // STOCK DETALLADO (1 col)
        ];
        ws['!cols'] = [
            { wch: 12 }, { wch: 34 }, { wch: 8 },
            { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
            { wch: 12 }, { wch: 12 },
            { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
            { wch: 12 }, { wch: 20 },
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
        XLSX.writeFile(wb, `Inventario_Callao_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleImportExcelClick = () => {
        const el = document.getElementById('stock-total-import-excel-input') as HTMLInputElement | null;
        el?.click();
    };

    const handleImportExcelSelected = async (file: File | null) => {
        if (!file) return;
        setIsImportingPreview(true);
        try {
            const preview = await api.importStockTotalExcel(file, 'preview');
            setImportFile(file);
            setImportMovs(preview.movimientos_entrada_sugeridos || []);
            setImportNegativos(preview.ajustes_negativos || []);
            const filasCfg = preview.filas_con_cambio_cant_reg_o_stock_min ?? 0;
            setImportFilasConfig(filasCfg);

            const hayMovs = (preview.movimientos_entrada_sugeridos || []).length > 0;
            const haySoloConfig = !hayMovs && filasCfg > 0;

            if (!hayMovs && !haySoloConfig) {
                showToast(
                    'info',
                    'No hay cambios: ni deltas de existencia para ingresos ni diferencias en cantidad registrada / stock mínimo.',
                );
                return;
            }
            if (haySoloConfig) {
                showToast(
                    'info',
                    `Se aplicará cantidad registrada y stock mínimo desde el Excel (${filasCfg} fila(s) con cambios). No hay movimientos de entrada automáticos.`,
                );
            }
            setShowImportModal(true);
        } catch (error: any) {
            showToast('error', error.message || 'Error al leer el Excel');
        } finally {
            setIsImportingPreview(false);
            // limpiar input para permitir re-seleccionar el mismo archivo
            const el = document.getElementById('stock-total-import-excel-input') as HTMLInputElement | null;
            if (el) el.value = '';
        }
    };

    const handleAddImportActas = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const nuevas = Array.from(files).map(file => ({
            id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file,
            nombre: file.name,
            preview: URL.createObjectURL(file),
        }));
        setImportActas(prev => [...prev, ...nuevas]);
    };

    const removeImportActa = (idx: number) => {
        setImportActas(prev => {
            const copy = [...prev];
            const removed = copy.splice(idx, 1)[0];
            if (removed?.preview) URL.revokeObjectURL(removed.preview);
            return copy;
        });
    };

    const confirmImportSave = async (passwordAutorizacion?: string) => {
        if (!importFile) {
            showToast('error', 'No se encontró el archivo Excel seleccionado');
            return;
        }
        const soloConfig = importMovs.length === 0 && importFilasConfig > 0;
        if (importMovs.length === 0 && !soloConfig) {
            showToast('error', 'No hay movimientos ni cambios de configuración para aplicar');
            return;
        }

        if (!soloConfig) {
            const operador = resolvePersonaCombo(importForm.operador, importForm.operadorCustom);
            const entregado = resolvePersonaCombo(importForm.entregado, importForm.entregadoCustom);
            const registrado = resolvePersonaCombo(importForm.registradoPor, importForm.registradoCustom);
            if (importForm.operador === COMBO_OTROS_VALUE && !operador) {
                showToast('error', 'Indica el nombre del operador (OTROS)');
                return;
            }
            if (importForm.entregado === COMBO_OTROS_VALUE && !entregado) {
                showToast('error', 'Indica quién entrega (OTROS)');
                return;
            }
            if (importForm.registradoPor === COMBO_OTROS_VALUE && !registrado) {
                showToast('error', 'Indica quién registra (OTROS)');
                return;
            }
        }

        setIsImportSaving(true);
        try {
            await api.importStockTotalExcel(importFile, 'aplicar');

            if (soloConfig) {
                await refreshProductos();
                showToast('success', 'Cantidad registrada y stock mínimo actualizados desde el Excel.');
            } else {
                const actasPayload = importActas.length > 0 ? importActas.map(a => ({ file: a.file, nombre: a.nombre })) : undefined;
                const operador = resolvePersonaCombo(importForm.operador, importForm.operadorCustom);
                const entregado = resolvePersonaCombo(importForm.entregado, importForm.entregadoCustom);
                const registrado = resolvePersonaCombo(importForm.registradoPor, importForm.registradoCustom);
                const entradasPayload = importMovs.map(m => ({
                    producto: m.producto,
                    operacion: importForm.operacion || 'OTROS',
                    almacen_salida: importForm.almacenSalida || 'MALVINAS',
                    almacen_ingreso: m.almacen_ingreso,
                    operador,
                    cantidad: m.cantidad,
                    unidad_medida: m.unidad_medida,
                    entregado_por: entregado,
                    registrado_por: registrado,
                    observaciones: importForm.observaciones,
                }));

                await api.createEntradasMasivo(entradasPayload, {
                    actas: actasPayload,
                    passwordAutorizacion: actasPayload ? undefined : passwordAutorizacion,
                });

                await Promise.all([refreshProductos(), refreshEntradas()]);
                showToast('success', `Importación exitosa: ${importMovs.length} ingreso(s) registrado(s)`);
            }

            importActas.forEach(a => URL.revokeObjectURL(a.preview));
            setImportActas([]);
            setImportFile(null);
            setImportMovs([]);
            setImportNegativos([]);
            setImportFilasConfig(0);
            setImportPassword('');
            setShowImportPasswordModal(false);
            setShowImportModal(false);
        } catch (error: any) {
            showToast('error', error.message || 'Error al guardar la importación');
        } finally {
            setIsImportSaving(false);
        }
    };

    return (
        <div id="view-malvinas" className="animate-in fade-in duration-500 font-poppins">
            <div className="container mx-auto">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6 transition-all">
                    {/* Header Principal */}
                    <header className="flex justify-between items-center flex-wrap gap-4 mb-8">
                        <div className="flex items-center space-x-3">
                            <div className="w-11 h-11 bg-gradient-to-br from-[#002D5A] to-[#0056b3] rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-900/10 transition-transform hover:scale-110">
                                <Building className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="font-bold text-gray-900 m-0 tracking-tight" style={{ fontSize: '18px' }}>
                                    Abastecimiento Callao
                                </h1>
                                <p className="text-[11px] text-gray-400 mt-0.5 font-medium italic opacity-80">Vista general del stock y gestión por tienda</p>
                            </div>
                        </div>
                        {editingProducts.size > 0 && (
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-blue-600">
                                    {editingProducts.size} producto(s) en edición
                                </span>
                                <button
                                    onClick={handleConfirmAllClick}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all duration-300 shadow-md text-[11px] bg-gradient-to-r from-[#002D5A] to-[#003d7a] hover:from-[#001f3d] hover:to-[#002D5A] text-white hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
                                >
                                    <Check className="w-4 h-4" />
                                    <span>Confirmar Todo</span>
                                </button>
                            </div>
                        )}
                    </header>

                    {/* Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {stats.map(s => {
                            const Icon = s.icon;
                            return (
                                <div key={s.label} className="bg-white p-4 rounded-xl border border-gray-100 hover:shadow-md transition-all duration-300 group flex items-center gap-3">
                                    <div
                                        className="flex items-center justify-center rounded-lg transition-all group-hover:scale-110 shadow-sm"
                                        style={{ width: 40, height: 40, background: s.bg }}
                                    >
                                        <Icon className="w-5 h-5" style={{ color: s.color }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                                        <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Toolbar */}
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 py-6 border-b border-gray-100 bg-transparent">
                        <div className="flex items-center gap-2">
                            <div className="p-2.5 bg-blue-100 rounded-xl shadow-sm">
                                <Search className="w-5 h-5 text-[#002D5A]" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 m-0" style={{ fontSize: 16 }}>
                                    Productos Detallados
                                </h3>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Control de Stock en Tiempo Real</p>
                            </div>
                        </div>
                        <div className="flex flex-col lg:flex-row lg:items-center gap-3 w-full lg:w-auto">
                            <div className="relative w-full md:w-72 lg:w-72">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar código o nombre..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-12 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-50 focus:border-[#002D5A] outline-none transition-all shadow-sm"
                                />
                            </div>
                            <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2 w-full lg:w-auto">
                                <button
                                    onClick={handleExportExcel}
                                    className="px-5 py-2.5 text-sm font-bold text-white bg-green-600 border border-green-600 rounded-2xl hover:bg-green-700 transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 w-full sm:w-auto"
                                >
                                    <FileSpreadsheet className="w-4 h-4" />
                                    <span className="hidden sm:inline uppercase tracking-wider text-[10px]">Exportar Excel</span>
                                </button>
                                <input
                                    id="stock-total-import-excel-input"
                                    type="file"
                                    accept=".xlsx,.xlsm,.xltx,.xltm"
                                    className="hidden"
                                    onChange={e => handleImportExcelSelected(e.target.files?.[0] || null)}
                                />
                                <button
                                    onClick={handleImportExcelClick}
                                    disabled={isImportingPreview || isLoading}
                                    className="px-5 py-2.5 text-sm font-bold text-white bg-[#002D5A] border border-[#002D5A] rounded-2xl hover:bg-[#001f3d] transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 disabled:opacity-60 w-full sm:w-auto"
                                >
                                    <Upload className={`w-4 h-4 ${isImportingPreview ? 'animate-pulse' : ''}`} />
                                    <span className="hidden sm:inline uppercase tracking-wider text-[10px]">
                                        {isImportingPreview ? 'Leyendo...' : 'Importar datos'}
                                    </span>
                                </button>
                                <button
                                    onClick={() => {
                                        setSearch('');
                                        refreshProductos();
                                        refreshEntradas();
                                        showToast('info', 'Datos actualizados');
                                    }}
                                    className="px-5 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 hover:text-[#002D5A] transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 w-full sm:w-auto"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    <span className="hidden sm:inline uppercase tracking-wider text-[10px]">Recargar</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Table card */}
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xl mt-2">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-[9px] uppercase font-bold tracking-wider">
                                    <tr className="bg-[#002D5A] text-white">
                                        <th rowSpan={2} className="px-4 py-3 border-r border-[#ffffff20]">Código</th>
                                        <th rowSpan={2} className="px-4 py-3 border-r border-[#ffffff20] min-w-[200px]">Producto</th>
                                        <th rowSpan={2} className="px-4 py-3 border-r border-[#ffffff20] text-center">Cant. en Caja</th>
                                        <th rowSpan={2} className="px-4 py-3 border-r border-[#ffffff20] text-center">U. Medida</th>
                                        <th colSpan={5} className="px-4 py-2 border-r border-[#ffffff20] text-center bg-[#1a4a7a]">
                                            Existencia Almacén
                                        </th>
                                        <th colSpan={2} className="px-4 py-3 border-r border-[#ffffff20] text-center bg-[#002D5A]">Disponibles</th>
                                        
                                        <th rowSpan={2} className="px-2 py-2 border-r border-[#ffffff20] text-center bg-[#002D5A]">
                                            Doc,Dec,Uni Sueltas
                                        </th>
                                    </tr>
                                    <tr className="bg-[#1a4a7a] text-white border-t border-[#ffffff20]">

                                        {TIENDAS_VISTA_INVENTARIO_CALLAO.map(({ tienda, etiqueta }) => (
                                            <th key={`ex-${tienda}`} className="px-2 py-2 border-r border-[#ffffff20] text-center text-[9px]">
                                                {etiqueta}
                                            </th>
                                        ))}
                                        <th className="px-2 py-2 border-r border-[#ffffff20] text-center text-[9px] bg-[#002D5A]">
                                            Total
                                        </th>
                                        <th className="px-2 py-2 border-r border-[#ffffff20] text-center text-[9px] bg-[#002D5A]">
                                            U.MED
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {isLoading ? (
                                        <TableSkeleton rows={20} cols={11} />
                                    ) : filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={11} className="px-4 py-12 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <Package className="w-12 h-12 text-gray-300" />
                                                    <p className="text-gray-400 text-sm font-medium">
                                                        {search ? 'No se encontraron productos con ese criterio' : 'No hay productos registrados'}
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filtered.map((p, idx) => {
                                            const isSelected = selectedProducts.has(p.id);
                                            const editing = editingProducts.get(p.id);
                                            const isEditing = !!editing;
                                            
                                            const stockGlobalMin = TIENDAS_VISTA_INVENTARIO_CALLAO.reduce(
                                                (acc, { tienda: t }) =>
                                                    acc + (editing ? editing.editing.stockMinimo[t] : p.stockMinimo[t]),
                                                0
                                            );
                                            // Existencia siempre usa el valor original porque no se puede editar
                                            const disponibles = TIENDAS_DISPONIBLES_CALLAO.reduce(
                                                (acc, t) => acc + p.existencia[t],
                                                0
                                            );
                                            const cantidadReg = editing ? editing.editing.cantidadRegCalculo : p.cantidadRegCalculo;
                                            const medida = p.existencia['TIENDA OFICINA-DOCENAS'] || 0;
                                            
                                            return (
                                                <tr
                                                    key={p.id}
                                                    onClick={() => handleRowClick(p.id)}
                                                    className={`transition-all duration-200 cursor-pointer border-b border-gray-100 ${
                                                        isEditing
                                                            ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-l-4 border-yellow-500 shadow-sm'
                                                            : isSelected
                                                            ? 'bg-blue-50'
                                                            : 'hover:bg-blue-50/30'
                                                    }`}
                                                >
                                                    <td className="px-4 py-3 font-bold text-[#002D5A] text-[11px]">{p.codigo}</td>
                                                    <td className="px-4 py-3 font-medium text-gray-700 text-[11px] uppercase tracking-tight">{p.nombre}</td>
                                                    <td className="px-4 py-3 text-center font-bold text-gray-800 text-[11px]">
                                                        {isEditing ? (
                                                            <input
                                                                type="number"
                                                                value={editing.editing.cantidadRegCalculo === 0 ? '' : editing.editing.cantidadRegCalculo}
                                                                onChange={e => updateEditingValue(p.id, 'cantidadRegCalculo', undefined, Number(e.target.value) || 0)}
                                                                onClick={e => e.stopPropagation()}
                                                                className="w-full px-2 py-1 border-2 border-yellow-500 rounded text-[10px] text-gray-900 font-semibold text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                placeholder="0"
                                                            />
                                                        ) : (
                                                            p.cantidadRegCalculo
                                                        )}
                                                    </td>
                                                    
                                                    <td className="px-4 py-3 text-center text-[11px]">
                                                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[9px] font-bold">
                                                            {p.unidadMedida}
                                                        </span>
                                                    </td>
                                                    {TIENDAS_VISTA_INVENTARIO_CALLAO.map(({ tienda: t }) => {
                                                        // Calcular el stock mínimo actual (puede estar en edición)
                                                        const stockMinActual = editing ? editing.editing.stockMinimo[t] : p.stockMinimo[t];
                                                        const existenciaActual = p.existencia[t];
                                                        
                                                        return (
                                                            <td 
                                                                key={`ex-${t}`} 
                                                                className={`px-2 py-3 text-center text-[11px] ${
                                                                    existenciaActual < stockMinActual && stockMinActual > 0 
                                                                        ? 'bg-red-50' 
                                                                        : ''
                                                                }`}
                                                            >
                                                                <StockBadge value={existenciaActual} min={stockMinActual} />
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-4 py-3 text-center font-extrabold text-[#002D5A] bg-blue-50/50 text-[11px]">{disponibles}</td>
                                                    <td className="px-4 py-3 text-center font-extrabold text-[#002D5A] bg-blue-50/50 text-[11px]">{p.unidadMedidaRegCalculo}</td>
                                                    <td className="px-4 py-3 text-center font-bold text-[11px]" style={{ color: '#22c55e' }}>
                                                        {medida}
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
            </div>

            {/* Modal de Contraseña */}
            {showPasswordModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 z-[10000]">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <Lock className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">Confirmar Cambios</h2>
                                    <p className="text-sm text-gray-500 mt-0.5">Ingresa la contraseña para continuar</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setShowPasswordModal(false);
                                    setPassword('');
                                    setPasswordError(false);
                                }}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            <div className="mb-4">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Contraseña *
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        setPasswordError(false);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleConfirmAll();
                                        }
                                    }}
                                    className={`w-full px-4 py-3 border-2 rounded-xl text-sm font-medium transition-all outline-none ${
                                        passwordError
                                            ? 'border-red-500 bg-red-50 focus:border-red-600 focus:ring-4 focus:ring-red-100'
                                            : 'border-gray-200 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
                                    }`}
                                    placeholder="Ingresa la contraseña"
                                    autoFocus
                                />
                                {passwordError && (
                                    <p className="mt-2 text-sm text-red-600 font-medium">
                                        Contraseña incorrecta. Intenta nuevamente.
                                    </p>
                                )}
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <p className="text-xs text-blue-800 font-medium">
                                    Se actualizarán <strong>{editingProducts.size} producto(s)</strong>. Esta acción no se puede deshacer.
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                            <button
                                onClick={() => {
                                    setShowPasswordModal(false);
                                    setPassword('');
                                    setPasswordError(false);
                                }}
                                className="px-6 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmAll}
                                disabled={isSaving || !password}
                                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#002D5A] to-[#003d7a] hover:from-[#001f3d] hover:to-[#002D5A] text-white rounded-xl font-semibold text-sm shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Confirmar
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Importar Excel -> Registro de Entrada Masivo */}
            {showImportModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col z-[10000]">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Importar Excel - Registro de entrada</h2>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    Se registrarán ingresos con la operación elegida y el <strong>origen de salida</strong> indicado abajo (Malvinas, Oficina o Callao 1 - 2).
                                </p>
                                {importNegativos.length > 0 && (
                                    <p className="text-xs text-blue-700 mt-2 font-semibold">
                                        Aviso: se detectaron {importNegativos.length} ajuste(s) negativo(s) (Excel menor que sistema). No se registrarán automáticamente.
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => {
                                    setShowImportModal(false);
                                    setImportPassword('');
                                    setShowImportPasswordModal(false);
                                }}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                disabled={isImportSaving}
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">Operación</label>
                                    <select
                                        value={importForm.operacion}
                                        onChange={e => setImportForm(f => ({ ...f, operacion: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold"
                                    >
                                        <option value="OTROS">OTROS</option>
                                        <option value="TRASLADO">TRASLADO</option>
                                        <option value="REPOSICION">REPOSICION</option>
                                        <option value="DEVOLUCION">DEVOLUCION</option>
                                        <option value="CAMBIO">CAMBIO</option>
                                        <option value="MERMA">MERMA</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">Almacén salida</label>
                                    <select
                                        value={importForm.almacenSalida}
                                        onChange={e => setImportForm(f => ({ ...f, almacenSalida: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold"
                                    >
                                        <option value="MALVINAS">ALMACEN MALVINAS</option>
                                        <option value="OFICINA">OFICINA</option>
                                        <option value="CALLAO-1">CALLAO 1</option>
                                        <option value="CALLAO-2">CALLAO 2</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">Operador</label>
                                    <select
                                        value={importForm.operador}
                                        onChange={e =>
                                            setImportForm(f => ({
                                                ...f,
                                                operador: e.target.value,
                                                operadorCustom: e.target.value !== COMBO_OTROS_VALUE ? '' : f.operadorCustom,
                                            }))
                                        }
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold"
                                    >
                                        {OPERADORES.map(o => (
                                            <option key={o} value={o}>
                                                {o}
                                            </option>
                                        ))}
                                        <option value={COMBO_OTROS_VALUE}>OTROS (especificar)</option>
                                    </select>
                                    {importForm.operador === COMBO_OTROS_VALUE && (
                                        <input
                                            type="text"
                                            value={importForm.operadorCustom}
                                            onChange={e => setImportForm(f => ({ ...f, operadorCustom: e.target.value }))}
                                            className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold"
                                            placeholder="Nombre del operador"
                                        />
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">Entregado por</label>
                                    <select
                                        value={importForm.entregado}
                                        onChange={e =>
                                            setImportForm(f => ({
                                                ...f,
                                                entregado: e.target.value,
                                                entregadoCustom: e.target.value !== COMBO_OTROS_VALUE ? '' : f.entregadoCustom,
                                            }))
                                        }
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold"
                                    >
                                        {OPERADORES.map(o => (
                                            <option key={o} value={o}>
                                                {o}
                                            </option>
                                        ))}
                                        <option value={COMBO_OTROS_VALUE}>OTROS (especificar)</option>
                                    </select>
                                    {importForm.entregado === COMBO_OTROS_VALUE && (
                                        <input
                                            type="text"
                                            value={importForm.entregadoCustom}
                                            onChange={e => setImportForm(f => ({ ...f, entregadoCustom: e.target.value }))}
                                            className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold"
                                            placeholder="Nombre"
                                        />
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">Registrado por</label>
                                    <select
                                        value={importForm.registradoPor}
                                        onChange={e =>
                                            setImportForm(f => ({
                                                ...f,
                                                registradoPor: e.target.value,
                                                registradoCustom: e.target.value !== COMBO_OTROS_VALUE ? '' : f.registradoCustom,
                                            }))
                                        }
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold"
                                    >
                                        {REGISTRADORES.map(r => (
                                            <option key={r} value={r}>
                                                {r}
                                            </option>
                                        ))}
                                        <option value={COMBO_OTROS_VALUE}>OTROS (especificar)</option>
                                    </select>
                                    {importForm.registradoPor === COMBO_OTROS_VALUE && (
                                        <input
                                            type="text"
                                            value={importForm.registradoCustom}
                                            onChange={e => setImportForm(f => ({ ...f, registradoCustom: e.target.value }))}
                                            className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold"
                                            placeholder="Nombre"
                                        />
                                    )}
                                </div>
                                <div className="lg:col-span-3">
                                    <label className="block text-xs font-bold text-gray-600 mb-1">Observaciones</label>
                                    <textarea
                                        value={importForm.observaciones}
                                        onChange={e => setImportForm(f => ({ ...f, observaciones: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold min-h-[70px]"
                                        placeholder="Observaciones (opcional)"
                                    />
                                </div>
                            </div>

                            <div className="border border-gray-200 rounded-2xl overflow-hidden">
                                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                                    <div className="text-xs font-black uppercase tracking-wider text-gray-700">
                                        Productos a registrar ({importMovs.length})
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input
                                            id="import-actas-input"
                                            type="file"
                                            className="hidden"
                                            multiple
                                            onChange={e => handleAddImportActas(e.target.files)}
                                        />
                                        <label
                                            htmlFor="import-actas-input"
                                            className="px-3 py-1.5 text-xs font-black text-white bg-[#002D5A] rounded-xl cursor-pointer hover:bg-[#003d7a] transition-colors"
                                        >
                                            Subir actas ({importActas.length})
                                        </label>
                                    </div>
                                </div>
                                {importActas.length > 0 && (
                                    <div className="px-4 py-3 border-b border-gray-200">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {importActas.map((a, idx) => (
                                                <div key={a.id} className="flex items-center gap-2">
                                                    <input
                                                        value={a.nombre}
                                                        onChange={e => {
                                                            const v = e.target.value;
                                                            setImportActas(prev => prev.map((x, i) => (i === idx ? { ...x, nombre: v } : x)));
                                                        }}
                                                        className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold"
                                                    />
                                                    <button
                                                        onClick={() => removeImportActa(idx)}
                                                        className="px-3 py-2 text-xs font-black bg-red-50 text-red-700 rounded-xl hover:bg-red-100"
                                                        type="button"
                                                    >
                                                        Quitar
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-white sticky top-0">
                                            <tr className="text-[10px] uppercase tracking-wider font-black text-gray-600 border-b border-gray-200">
                                                <th className="px-4 py-3 text-left">Código</th>
                                                <th className="px-4 py-3 text-left">Tienda ingreso</th>
                                                <th className="px-4 py-3 text-right">Cantidad</th>
                                                <th className="px-4 py-3 text-center">U. Med</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {importMovs.map((m, idx) => (
                                                <tr key={`${m.producto}-${m.almacen_ingreso}-${idx}`} className="text-[11px]">
                                                    <td className="px-4 py-2 font-bold text-[#002D5A]">{m.producto}</td>
                                                    <td className="px-4 py-2 font-semibold text-gray-700">{m.almacen_ingreso}</td>
                                                    <td className="px-4 py-2 text-right font-extrabold">{m.cantidad}</td>
                                                    <td className="px-4 py-2 text-center text-gray-600 font-bold">{m.unidad_medida}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                            <button
                                onClick={() => setShowImportModal(false)}
                                className="px-6 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                                disabled={isImportSaving}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    const soloCfg = importMovs.length === 0 && importFilasConfig > 0;
                                    if (soloCfg) {
                                        confirmImportSave(undefined);
                                        return;
                                    }
                                    if (importActas.length === 0) {
                                        setShowImportPasswordModal(true);
                                        setImportPassword('');
                                    } else {
                                        confirmImportSave(undefined);
                                    }
                                }}
                                disabled={isImportSaving}
                                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#002D5A] to-[#0056b3] hover:from-[#003d7a] hover:to-[#0066cc] text-white rounded-xl font-semibold text-sm shadow-lg transition-all disabled:opacity-50"
                            >
                                {isImportSaving ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Guardar
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal contraseña importación (solo si no hay actas) */}
            {showImportPasswordModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 z-[10000]">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                                    <Lock className="w-5 h-5 text-orange-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">Autorización</h2>
                                    <p className="text-sm text-gray-500 mt-0.5">No hay actas. Ingresa la contraseña para guardar</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowImportPasswordModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                disabled={isImportSaving}
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="p-6">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Contraseña *</label>
                            <input
                                type="password"
                                value={importPassword}
                                onChange={e => setImportPassword(e.target.value)}
                                className="w-full px-4 py-3 border-2 rounded-xl text-sm font-medium transition-all outline-none border-gray-200 bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                                placeholder="Ingresa la contraseña"
                                autoFocus
                            />
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-4">
                                <p className="text-xs text-orange-800 font-medium">
                                    Se guardarán <strong>{importMovs.length}</strong> ingreso(s) sin actas.
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                            <button
                                onClick={() => setShowImportPasswordModal(false)}
                                className="px-6 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                                disabled={isImportSaving}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => confirmImportSave(importPassword)}
                                disabled={isImportSaving || !importPassword}
                                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-semibold text-sm shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isImportSaving ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Confirmar
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
