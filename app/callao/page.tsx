'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
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
  UnidadMedida,
} from '../context/CallaoContext';
import {
    Search,
    RefreshCw,
    TrendingUp,
    Package,
    AlertTriangle,
    Building,
    Box,
    Columns2,
    Check,
    X,
    Lock,
    FileSpreadsheet,
    Upload,
    Trash2,
} from 'lucide-react';
import TableSkeleton from '../components/TableSkeleton';
import { PrettySelect } from '../components/PrettySelect';
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
    'TIENDA SMP-1',
    'TIENDA SMP-2',
];

function UnidadMedidaFilter({
    value,
    onChange,
    counts,
}: {
    value: '__TODAS__' | UnidadMedida;
    onChange: (v: '__TODAS__' | UnidadMedida) => void;
    counts: Record<string, number>;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);

    const options = useMemo(() => {
        const keys = Object.keys(counts).sort();
        return keys as UnidadMedida[];
    }, [counts]);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (!ref.current) return;
            if (e.target instanceof Node && ref.current.contains(e.target)) return;
            setOpen(false);
        };
        window.addEventListener('mousedown', onDown);
        return () => window.removeEventListener('mousedown', onDown);
    }, [open]);

    const label = value === '__TODAS__' ? 'U. Medida' : value;

    return (
        <div ref={ref} className="relative w-full md:w-44 lg:w-44">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm bg-white border border-gray-200 rounded-2xl shadow-sm transition-all outline-none ${
                    open ? 'ring-4 ring-blue-50 border-[#002D5A]' : 'hover:border-gray-300'
                }`}
            >
                <span className={`truncate ${value === '__TODAS__' ? 'text-gray-400 font-medium' : 'text-gray-700 font-medium'}`}>
                    {label}
                </span>
                <span className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
            </button>

            {open && (
                <div className="absolute z-[60] mt-2 w-full rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden">
                    <button
                        type="button"
                        onClick={() => {
                            onChange('__TODAS__');
                            setOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                            value === '__TODAS__' ? 'bg-blue-50 text-[#002D5A]' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                    >
                        U. Medida
                    </button>
                    <div className="max-h-64 overflow-auto">
                        {options.map(u => (
                            <button
                                key={u}
                                type="button"
                                onClick={() => {
                                    onChange(u);
                                    setOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors flex items-center justify-between ${
                                    value === u ? 'bg-blue-50 text-[#002D5A]' : 'hover:bg-gray-50 text-gray-700'
                                }`}
                            >
                                <span className="truncate">{u}</span>
                                <span className="text-xs font-bold text-gray-400">{counts[u] || 0}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function StockTotalPage() {
    const {
        state,
        refreshProductos,
        refreshEntradas,
        refreshSalidas,
        refreshHistorialEntradas,
        refreshHistorialSalidas,
        showToast,
    } = useCallao();
    const [search, setSearch] = useState('');
    const [unidadFilter, setUnidadFilter] = useState<'__TODAS__' | UnidadMedida>('__TODAS__');
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
    const [importSalidas, setImportSalidas] = useState<NonNullable<api.ImportStockTotalResult['movimientos_salida_sugeridos']>>([]);
    const [importNegativos, setImportNegativos] = useState<api.ImportStockTotalResult['ajustes_negativos']>([]);
    const [importFilasConfig, setImportFilasConfig] = useState(0);
    const [importFilasProcesadas, setImportFilasProcesadas] = useState(0);
    const [importPreviewDetalle, setImportPreviewDetalle] = useState<api.ImportStockTotalResult['preview_detalle']>([]);
    const [importNoEncontrados, setImportNoEncontrados] = useState<string[]>([]);
    const [isImportingPreview, setIsImportingPreview] = useState(false);
    const [isImportSaving, setIsImportSaving] = useState(false);

    const [importForm, setImportForm] = useState({
        operacion: 'ENTRADA',
        almacenSalida: 'MALVINAS',
        operador: OPERADORES[0],
        operadorCustom: '',
        registradoPor: REGISTRADORES[0],
        registradoCustom: '',
        observaciones: '',
    });
    const [importActas, setImportActas] = useState<Array<{ id: string; file: File; nombre: string; preview: string }>>([]);
    const [importActasModalOpen, setImportActasModalOpen] = useState(false);
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
        return state.productos.filter(p => {
            const matchText = p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q);
            const matchUnidad = unidadFilter === '__TODAS__' ? true : p.unidadMedida === unidadFilter;
            return matchText && matchUnidad;
        });
    }, [state.productos, search, unidadFilter]);

    const unidadCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const p of state.productos) {
            const k = (p.unidadMedida || 'UNIDADES') as string;
            counts[k] = (counts[k] || 0) + 1;
        }
        return counts;
    }, [state.productos]);

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
            'CANT. EN CAJA',
            'U. MEDIDA',
            'EXISTENCIA ALMACEN',
            '',
            '',
            '',
            '',
            '',
            'DISPONIBLES',
            '',
            'DOC,DEC,UNI SUELTAS',
        ];

        const headerBottom = [
            '',
            '',
            '',
            '',
            ...TIENDAS_VISTA_INVENTARIO_CALLAO.map(({ etiqueta }) => etiqueta),
            'TOTAL',
            'U.MED',
            '',
        ];

        const rows = filtered.map(p => {
            const editing = editingProducts.get(p.id);
            const cantidadReg = editing ? editing.editing.cantidadRegCalculo : p.cantidadRegCalculo;
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
                p.unidadMedida, // 3
                ...TIENDAS_VISTA_INVENTARIO_CALLAO.map(({ tienda }) => p.existencia[tienda] || 0),
                disponibles,
                p.unidadMedida,
                medidaValor,
            ];
        });

        const nTiendas = TIENDAS_VISTA_INVENTARIO_CALLAO.length;
        const colExistEnd = 3 + nTiendas; // inclusive index of last tienda col
        const colDispTotal = colExistEnd + 1;
        const colDispUmed = colDispTotal + 1;
        const colMedida = colDispUmed + 1;

        const ws = XLSX.utils.aoa_to_sheet([headerTop, headerBottom, ...rows]);
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // CODIGO
            { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // PRODUCTO
            { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }, // CANT. EN CAJA
            { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } }, // U. MEDIDA
            { s: { r: 0, c: 4 }, e: { r: 0, c: colExistEnd } }, // EXISTENCIA ALMACEN
            { s: { r: 0, c: colDispTotal }, e: { r: 0, c: colDispUmed } }, // DISPONIBLES
            { s: { r: 0, c: colMedida }, e: { r: 1, c: colMedida } }, // DOC,DEC,UNI SUELTAS
        ];
        ws['!cols'] = [
            { wch: 12 }, // CODIGO
            { wch: 34 }, // PRODUCTO
            { wch: 14 }, // CANT. EN CAJA
            { wch: 12 }, // U. MEDIDA
            ...Array.from({ length: nTiendas }, () => ({ wch: 12 })),
            { wch: 12 }, // DISPONIBLES total
            { wch: 10 }, // U.MED
            { wch: 18 }, // DOC,DEC,UNI SUELTAS
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
            setImportSalidas(preview.movimientos_salida_sugeridos || []);
            setImportNegativos(preview.ajustes_negativos || []);
            setImportFilasProcesadas(preview.filas_procesadas ?? 0);
            setImportPreviewDetalle(preview.preview_detalle || []);
            setImportNoEncontrados(preview.productos_no_encontrados_muestra || []);
            const filasCfg = preview.filas_con_cambio_cant_reg_o_stock_min ?? 0;
            setImportFilasConfig(filasCfg);

            const hayMovs = (preview.movimientos_entrada_sugeridos || []).length > 0;
            const haySoloConfig = !hayMovs && filasCfg > 0;

            if (haySoloConfig) {
                showToast(
                    'info',
                    `Se aplicará cantidad registrada y stock mínimo desde el Excel (${filasCfg} fila(s) con cambios). No hay movimientos de entrada automáticos.`,
                );
            }
            if (!hayMovs && !haySoloConfig) {
                showToast('info', 'Excel leído. No se detectaron cambios para aplicar.');
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

    const isImportActaImageFile = (file: File) => {
        if (/image\/(jpeg|png|webp)/i.test(file.type)) return true;
        return /\.(jpe?g|png|webp)$/i.test(file.name);
    };

    const handleAddImportActas = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const picked = Array.from(files).filter(isImportActaImageFile);
        if (picked.length === 0) {
            showToast('error', 'Solo se permiten imágenes JPG, PNG o WEBP');
            return;
        }
        const nuevas = picked.map(file => {
            const sinExt = file.name.replace(/\.[^/.]+$/i, '');
            return {
                id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                file,
                nombre: sinExt || file.name,
                preview: URL.createObjectURL(file),
            };
        });
        setImportActas(prev => [...prev, ...nuevas]);
    };

    useEffect(() => {
        if (!showImportModal) setImportActasModalOpen(false);
    }, [showImportModal]);

    const importCambiosDetectados = useMemo(() => {
        const detalle = importPreviewDetalle || [];
        return detalle.filter(d => {
            const cantCajaCambio = (d.cant_caja_excel ?? 0) !== (d.cant_caja_sistema ?? 0);
            const exist = d.existencias || ({} as any);
            const hayDelta =
                (exist['OFICINA']?.delta || 0) !== 0 ||
                (exist['OFICINA-DOCENAS']?.delta || 0) !== 0 ||
                (exist['CALLAO-1-A']?.delta || 0) !== 0 ||
                (exist['CALLAO-1-B']?.delta || 0) !== 0 ||
                (exist['SMP-1']?.delta || 0) !== 0 ||
                (exist['SMP-2']?.delta || 0) !== 0;
            return cantCajaCambio || hayDelta;
        });
    }, [importPreviewDetalle]);

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
        const totalMovs = importMovs.length + importSalidas.length;
        const soloConfig = totalMovs === 0 && importFilasConfig > 0;
        if (totalMovs === 0 && !soloConfig) {
            showToast('error', 'No hay movimientos ni cambios de configuración para aplicar');
            return;
        }

        if (!soloConfig) {
            const operador = resolvePersonaCombo(importForm.operador, importForm.operadorCustom);
            const registrado = resolvePersonaCombo(importForm.registradoPor, importForm.registradoCustom);
            if (importForm.operador === COMBO_OTROS_VALUE && !operador) {
                showToast('error', 'Indica el nombre del operador (OTROS)');
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
                await Promise.all([refreshProductos(), refreshHistorialEntradas(), refreshHistorialSalidas()]);
                showToast('success', 'Cantidad registrada y stock mínimo actualizados desde el Excel.');
            } else {
                const actasPayload = importActas.length > 0 ? importActas.map(a => ({ file: a.file, nombre: a.nombre })) : undefined;
                const operador = resolvePersonaCombo(importForm.operador, importForm.operadorCustom);
                const registrado = resolvePersonaCombo(importForm.registradoPor, importForm.registradoCustom);
                const entradasPayload = importMovs.map(m => ({
                    producto: m.producto,
                    operacion: importForm.operacion || 'OTROS',
                    almacen_salida: importForm.almacenSalida || 'MALVINAS',
                    almacen_ingreso: m.almacen_ingreso,
                    operador,
                    cantidad: m.cantidad,
                    unidad_medida: m.unidad_medida,
                    entregado_por: operador,
                    registrado_por: registrado,
                    observaciones: importForm.observaciones,
                }));
                const salidasPayload = importSalidas.map(s => ({
                    producto: s.producto,
                    operacion: 'OTROS',
                    almacen: s.almacen,
                    cantidad: s.cantidad,
                    unidad_medida: s.unidad_medida,
                    entregado_por: operador,
                    registrado_por: registrado,
                    observaciones: importForm.observaciones,
                }));

                const opts = {
                    actas: actasPayload,
                    passwordAutorizacion: actasPayload ? undefined : passwordAutorizacion,
                };
                if (entradasPayload.length > 0) {
                    await api.createEntradasMasivo(entradasPayload, opts);
                }
                if (salidasPayload.length > 0) {
                    await api.createSalidasMasivo(salidasPayload, opts);
                }

                await Promise.all([
                    refreshProductos(),
                    refreshEntradas(),
                    refreshSalidas(),
                    refreshHistorialEntradas(),
                    refreshHistorialSalidas(),
                ]);
                showToast(
                    'success',
                    `Importación exitosa: ${entradasPayload.length} ingreso(s) y ${salidasPayload.length} salida(s) registrada(s)`,
                );
            }

            importActas.forEach(a => URL.revokeObjectURL(a.preview));
            setImportActas([]);
            setImportFile(null);
            setImportMovs([]);
            setImportSalidas([]);
            setImportNegativos([]);
            setImportFilasConfig(0);
            setImportPassword('');
            setShowImportPasswordModal(false);
            setShowImportModal(false);

            // Post-import: mostrar resultados inmediatamente (evita "no se encontraron" por filtros previos).
            setSearch('');
            setUnidadFilter('__TODAS__');
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
                            <UnidadMedidaFilter value={unidadFilter} onChange={setUnidadFilter} counts={unidadCounts} />
                            <div className="flex items-center justify-start lg:justify-end gap-2 w-full lg:w-auto flex-nowrap overflow-x-auto">
                                <button
                                    onClick={handleExportExcel}
                                    className="px-5 py-2.5 text-sm font-bold text-white bg-green-600 border border-green-600 rounded-2xl hover:bg-green-700 transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 whitespace-nowrap"
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
                                    className="relative overflow-hidden px-5 py-2.5 text-sm font-bold text-white bg-[#002D5A] border border-[#002D5A] rounded-2xl hover:bg-[#001f3d] transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 disabled:opacity-60 whitespace-nowrap"
                                >
                                    {isImportingPreview && (
                                        <>
                                            {/* Capa oscura sutil */}
                                            <div className="absolute inset-0 bg-black/10" />
                                            {/* Barra de carga indeterminada */}
                                            <div className="absolute inset-y-0 left-0 w-1/2 bg-white/25 animate-[importbar_1.1s_ease-in-out_infinite]" />
                                            <style jsx>{`
                                                @keyframes importbar {
                                                    0% {
                                                        transform: translateX(-120%);
                                                    }
                                                    100% {
                                                        transform: translateX(240%);
                                                    }
                                                }
                                            `}</style>
                                        </>
                                    )}
                                    <Upload className={`w-4 h-4 ${isImportingPreview ? 'animate-pulse' : ''}`} />
                                    <span className="relative hidden sm:inline uppercase tracking-wider text-[10px]">
                                        {isImportingPreview ? 'Leyendo...' : 'Importar datos'}
                                    </span>
                                </button>
                                <button
                                    onClick={() => {
                                        setSearch('');
                                        refreshProductos();
                                        refreshEntradas();
                                        refreshSalidas();
                                        refreshHistorialEntradas();
                                        refreshHistorialSalidas();
                                        showToast('info', 'Datos actualizados');
                                    }}
                                    className="p-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 hover:text-[#002D5A] transition-all flex items-center justify-center shadow-sm active:scale-95 whitespace-nowrap"
                                    aria-label="Recargar"
                                    title="Recargar"
                                >
                                    <RefreshCw className="w-4 h-4" />
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
                                        <th colSpan={6} className="px-4 py-2 border-r border-[#ffffff20] text-center bg-[#1a4a7a]">
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
                                        <TableSkeleton rows={20} cols={13} />
                                    ) : filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={13} className="px-4 py-12 text-center">
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
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                    onClick={e => e.target === e.currentTarget && !isImportSaving && setShowImportModal(false)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col z-[10000] border border-gray-100"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-200 bg-gradient-to-b from-slate-50/90 to-white">
                            <div className="flex items-center gap-4 min-w-0 flex-1">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#002D5A] shadow-md shadow-[#002D5A]/20">
                                    <Upload className="w-6 h-6 text-white" strokeWidth={2.25} />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-base font-bold text-[#002D5A] m-0 leading-tight tracking-tight">
                                        Importar Excel
                                    </h2>
                                    <p className="text-sm text-gray-500 mt-1.5 m-0 leading-relaxed font-medium">
                                        Registro de entrada masivo desde el archivo Excel exportado desde la vista{' '}
                                        <span className="text-gray-700 font-semibold">Productos Detallados</span>.
                                    </p>
                                    <p className="text-sm text-gray-500 mt-2 m-0 leading-relaxed font-medium">
                                        Los ingresos se registrarán con la operación elegida y el{' '}
                                        <span className="text-gray-700 font-semibold">origen de salida</span> que indiques en los campos de
                                        abajo.
                                    </p>
                                    <div className="mt-4 flex flex-wrap gap-2" role="status" aria-live="polite">
                                        <span className="inline-flex items-center gap-2 rounded-lg border border-gray-200/90 bg-white px-3 py-1.5 text-xs shadow-sm">
                                            <span className="text-gray-500 font-semibold uppercase tracking-wide">Filas</span>
                                            <span className="tabular-nums font-bold text-[#002D5A]">{importFilasProcesadas}</span>
                                        </span>
                                        <span className="inline-flex items-center gap-2 rounded-lg border border-gray-200/90 bg-white px-3 py-1.5 text-xs shadow-sm">
                                            <span className="text-gray-500 font-semibold uppercase tracking-wide">Movimientos</span>
                                            <span className="tabular-nums font-bold text-[#002D5A]">{importMovs.length}</span>
                                        </span>
                                        <span className="inline-flex items-center gap-2 rounded-lg border border-gray-200/90 bg-white px-3 py-1.5 text-xs shadow-sm">
                                            <span className="text-gray-500 font-semibold uppercase tracking-wide">Cambios config</span>
                                            <span className="tabular-nums font-bold text-[#002D5A]">{importFilasConfig}</span>
                                        </span>
                                        <span className="inline-flex items-center gap-2 rounded-lg border border-gray-200/90 bg-white px-3 py-1.5 text-xs shadow-sm">
                                            <span className="text-gray-500 font-semibold uppercase tracking-wide">Cambios detectados</span>
                                            <span className="tabular-nums font-bold text-[#002D5A]">{importCambiosDetectados.length}</span>
                                        </span>
                                    </div>
                                    {importNegativos.length > 0 && (
                                        <p className="text-xs text-[#002D5A] mt-3 m-0 font-semibold rounded-lg border border-[#002D5A]/15 bg-[#E9F1FF] px-3 py-2">
                                            Aviso: se detectaron {importNegativos.length} ajuste(s) negativo(s) (Excel menor que sistema). No
                                            se registrarán automáticamente.
                                        </p>
                                    )}
                                    {importNoEncontrados.length > 0 && (
                                        <p className="text-xs text-amber-900 mt-3 m-0 font-semibold rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                                            Aviso: hay {importNoEncontrados.length} código(s) del Excel que no existen en el sistema (muestra):
                                            <span className="ml-1 font-black">{importNoEncontrados.join(', ')}</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowImportModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0 self-start"
                                aria-label="Cerrar"
                                disabled={isImportSaving}
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">Operación</label>
                                    <PrettySelect
                                        value={importForm.operacion}
                                        onChange={v => setImportForm(f => ({ ...f, operacion: v }))}
                                        options={[
                                            { value: 'ENTRADA', label: 'ENTRADA' },
                                            { value: 'OTROS', label: 'OTROS' },
                                        ]}
                                        size="md"
                                        placement="below"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">Almacén salida</label>
                                    <PrettySelect
                                        value={importForm.almacenSalida}
                                        onChange={v => setImportForm(f => ({ ...f, almacenSalida: v }))}
                                        options={[
                                            { value: 'IMPORTACION', label: 'IMPORTACION' },
                                            { value: 'MALVINAS', label: 'ALMACEN MALVINAS' },
                                            { value: 'OFICINA', label: 'OFICINA' },
                                            { value: 'OFICINA-DOCENAS', label: 'OFICINA-DOCENAS' },
                                            { value: 'CALLAO-1-A', label: 'CALLAO 1-A' },
                                            { value: 'CALLAO-1-B', label: 'CALLAO 1-B' },
                                            { value: 'SMP-1', label: 'SMP-1' },
                                            { value: 'SMP-2', label: 'SMP-2' },
                                        ]}
                                        size="md"
                                        placement="below"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">Operador</label>
                                    <PrettySelect
                                        value={importForm.operador}
                                        onChange={v =>
                                            setImportForm(f => ({
                                                ...f,
                                                operador: v,
                                                operadorCustom: v !== COMBO_OTROS_VALUE ? '' : f.operadorCustom,
                                            }))
                                        }
                                        options={[
                                            ...OPERADORES.map(o => ({ value: o, label: o })),
                                            { value: COMBO_OTROS_VALUE, label: 'OTROS (especificar)' },
                                        ]}
                                        size="md"
                                        placement="below"
                                    />
                                    {importForm.operador === COMBO_OTROS_VALUE && (
                                        <input
                                            type="text"
                                            value={importForm.operadorCustom}
                                            onChange={e => setImportForm(f => ({ ...f, operadorCustom: e.target.value.toUpperCase() }))}
                                            className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold"
                                            placeholder="Nombre del operador"
                                        />
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">Registrado por</label>
                                    <PrettySelect
                                        value={importForm.registradoPor}
                                        onChange={v =>
                                            setImportForm(f => ({
                                                ...f,
                                                registradoPor: v,
                                                registradoCustom: v !== COMBO_OTROS_VALUE ? '' : f.registradoCustom,
                                            }))
                                        }
                                        options={[
                                            ...REGISTRADORES.map(r => ({ value: r, label: r })),
                                            { value: COMBO_OTROS_VALUE, label: 'OTROS (especificar)' },
                                        ]}
                                        size="md"
                                        placement="below"
                                    />
                                    {importForm.registradoPor === COMBO_OTROS_VALUE && (
                                        <input
                                            type="text"
                                            value={importForm.registradoCustom}
                                            onChange={e => setImportForm(f => ({ ...f, registradoCustom: e.target.value.toUpperCase() }))}
                                            className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold"
                                            placeholder="Nombre"
                                        />
                                    )}
                                </div>
                                <div className="lg:col-span-3">
                                    <label className="block text-xs font-bold text-gray-600 mb-1">Observaciones</label>
                                    <textarea
                                        value={importForm.observaciones}
                                        onChange={e => setImportForm(f => ({ ...f, observaciones: e.target.value.toUpperCase() }))}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold min-h-[70px]"
                                        placeholder="Observaciones (opcional)"
                                    />
                                </div>
                            </div>

                            <div className="border border-gray-200 rounded-2xl overflow-hidden">
                                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                                    <div className="text-xs font-black uppercase tracking-wider text-gray-700">
                                        Movimientos a registrar ({importMovs.length + importSalidas.length})
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setImportActasModalOpen(true)}
                                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-white bg-[#002D5A] border border-[#002D5A] hover:bg-[#001f3d] transition-all shadow-sm active:scale-[0.98]"
                                    >
                                        <Upload className="w-3.5 h-3.5 shrink-0" />
                                        <span>Subir Actas</span>
                                        {importActas.length > 0 && (
                                            <span className="bg-white/20 px-1.5 py-px rounded-full text-[10px] font-bold tabular-nums min-w-[1.25rem] text-center">
                                                {importActas.length}
                                            </span>
                                        )}
                                    </button>
                                </div>
                                {importActas.length > 0 && (
                                    <div className="px-4 py-2 border-b border-gray-200 bg-blue-50/40 text-xs font-semibold text-[#002D5A]">
                                        {importActas.length} acta(s) adjunta(s). Puedes editarlas con &quot;Subir Actas&quot;.
                                    </div>
                                )}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="sticky top-0">
                                            <tr className="bg-[#002D5A] text-white text-[10px] uppercase tracking-wider font-black border-b border-[#ffffff20]">
                                                <th className="px-4 py-3 text-left">Código</th>
                                                <th className="px-4 py-3 text-left">Nombre</th>
                                                <th className="px-4 py-3 text-left">Tienda ingreso</th>
                                                <th className="px-4 py-3 text-right">Cantidad</th>
                                                <th className="px-4 py-3 text-center">U. Med</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {importMovs.length + importSalidas.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-10 text-center text-xs font-semibold text-gray-500">
                                                        No se detectaron movimientos (deltas) para registrar.
                                                    </td>
                                                </tr>
                                            ) : (
                                                <>
                                                    {importMovs.map((m, idx) => (
                                                        <tr key={`E-${m.producto}-${m.almacen_ingreso}-${idx}`} className="text-[11px]">
                                                            <td className="px-4 py-2 font-bold text-[#002D5A]">{m.producto}</td>
                                                            <td className="px-4 py-2 font-semibold text-gray-700 uppercase">{m.nombre || ''}</td>
                                                            <td className="px-4 py-2 font-semibold text-gray-700">{m.almacen_ingreso}</td>
                                                            <td className="px-4 py-2 text-right font-extrabold text-emerald-700">+{m.cantidad}</td>
                                                            <td className="px-4 py-2 text-center text-gray-600 font-bold">{m.unidad_medida}</td>
                                                        </tr>
                                                    ))}
                                                    {importSalidas.map((s, idx) => (
                                                        <tr key={`S-${s.producto}-${s.almacen}-${idx}`} className="text-[11px]">
                                                            <td className="px-4 py-2 font-bold text-[#002D5A]">{s.producto}</td>
                                                            <td className="px-4 py-2 font-semibold text-gray-700 uppercase">{s.nombre || ''}</td>
                                                            <td className="px-4 py-2 font-semibold text-gray-700">{s.almacen}</td>
                                                            <td className="px-4 py-2 text-right font-extrabold text-rose-700">-{s.cantidad}</td>
                                                            <td className="px-4 py-2 text-center text-gray-600 font-bold">{s.unidad_medida}</td>
                                                        </tr>
                                                    ))}
                                                </>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="mt-5 border border-gray-200 rounded-2xl overflow-hidden">
                                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                                    <div className="text-xs font-black uppercase tracking-wider text-gray-700">
                                        Filas con cambios detectados ({importCambiosDetectados.length})
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="sticky top-0">
                                            <tr className="bg-[#0B3A6B] text-white text-[10px] uppercase tracking-wider font-black border-b border-[#ffffff20]">
                                                <th className="px-4 py-3 text-left">Código</th>
                                                <th className="px-4 py-3 text-left">Nombre (Excel)</th>
                                                <th className="px-4 py-3 text-right">Δ Oficina</th>
                                                <th className="px-4 py-3 text-right">Δ Docenas</th>
                                                <th className="px-4 py-3 text-right">Δ 1-A</th>
                                                <th className="px-4 py-3 text-right">Δ 1-B</th>
                                                <th className="px-4 py-3 text-right">Δ SMP-1</th>
                                                <th className="px-4 py-3 text-right">Δ SMP-2</th>
                                                <th className="px-4 py-3 text-right">Δ Cant/Caja</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {importCambiosDetectados.length === 0 ? (
                                                <tr>
                                                    <td colSpan={9} className="px-4 py-10 text-center text-xs font-semibold text-gray-500">
                                                        No se detectaron diferencias entre Excel y sistema para ninguna fila.
                                                    </td>
                                                </tr>
                                            ) : (
                                                importCambiosDetectados.slice(0, 200).map((d, idx) => {
                                                    const ex = d.existencias as any;
                                                    const dc = (d.cant_caja_excel ?? 0) - (d.cant_caja_sistema ?? 0);
                                                    const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);
                                                    return (
                                                        <tr key={`${d.producto}-${idx}`} className="text-[11px]">
                                                            <td className="px-4 py-2 font-bold text-[#002D5A]">{d.producto}</td>
                                                            <td className="px-4 py-2 font-semibold text-gray-700 uppercase">{d.nombre_excel || ''}</td>
                                                            <td className="px-4 py-2 text-right font-extrabold">{fmt(ex?.['OFICINA']?.delta || 0)}</td>
                                                            <td className="px-4 py-2 text-right font-extrabold">{fmt(ex?.['OFICINA-DOCENAS']?.delta || 0)}</td>
                                                            <td className="px-4 py-2 text-right font-extrabold">{fmt(ex?.['CALLAO-1-A']?.delta || 0)}</td>
                                                            <td className="px-4 py-2 text-right font-extrabold">{fmt(ex?.['CALLAO-1-B']?.delta || 0)}</td>
                                                            <td className="px-4 py-2 text-right font-extrabold">{fmt(ex?.['SMP-1']?.delta || 0)}</td>
                                                            <td className="px-4 py-2 text-right font-extrabold">{fmt(ex?.['SMP-2']?.delta || 0)}</td>
                                                            <td className="px-4 py-2 text-right font-extrabold">{fmt(dc)}</td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {importCambiosDetectados.length > 200 && (
                                    <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 text-[11px] font-semibold text-gray-600">
                                        Mostrando 200 de {importCambiosDetectados.length} filas con cambios.
                                    </div>
                                )}
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
                                        // Requerimiento: siempre pedir contraseña antes de guardar
                                        setShowImportPasswordModal(true);
                                        setImportPassword('');
                                        return;
                                    }
                                    if (importMovs.length === 0 && importFilasConfig === 0) {
                                        showToast('info', 'No hay cambios para guardar.');
                                        return;
                                    }
                                    // Requerimiento: siempre pedir contraseña antes de guardar (haya o no actas)
                                    setShowImportPasswordModal(true);
                                    setImportPassword('');
                                }}
                                disabled={isImportSaving || (importMovs.length === 0 && importFilasConfig === 0)}
                                className="px-6 py-2.5 text-sm font-bold text-white bg-[#002D5A] border border-[#002D5A] rounded-2xl hover:bg-[#001f3d] transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 disabled:opacity-60"
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

            {/* Modal Subir Actas (importación masiva) — mismo diseño que Traslado / referencia */}
            {importActasModalOpen && (
                <div
                    className="fixed inset-0 z-[10100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                    onClick={e => e.target === e.currentTarget && setImportActasModalOpen(false)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col z-[10101]"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-200">
                            <div className="min-w-0">
                                <h2 className="text-base font-bold text-[#002D5A] m-0 leading-tight">
                                    Subir Actas (Globales)
                                </h2>
                                <p className="text-sm text-gray-500 mt-1 m-0 font-medium">
                                    Sube una o más actas y asigna un nombre a cada una
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setImportActasModalOpen(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
                                aria-label="Cerrar"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="px-6 py-5 overflow-y-auto flex-1">
                            <div className="mb-6">
                                <label className="block mb-2 text-sm font-bold text-[#002D5A]">
                                    Seleccionar Imágenes
                                </label>
                                <div
                                    className="border-2 border-dashed border-[#002D5A]/25 rounded-2xl p-8 text-center hover:border-[#002D5A]/45 transition-colors bg-[#002D5A]/5"
                                    onDragOver={e => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }}
                                    onDrop={e => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleAddImportActas(e.dataTransfer.files);
                                    }}
                                >
                                    <input
                                        id="import-actas-modal-input"
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                                        multiple
                                        className="hidden"
                                        onChange={e => {
                                            handleAddImportActas(e.target.files);
                                            e.target.value = '';
                                        }}
                                    />
                                    <label
                                        htmlFor="import-actas-modal-input"
                                        className="cursor-pointer flex flex-col items-center gap-3"
                                    >
                                        <div className="w-14 h-14 bg-[#002D5A] rounded-full flex items-center justify-center shadow-md">
                                            <Upload className="w-7 h-7 text-white" strokeWidth={2.25} />
                                        </div>
                                        <div>
                                            <span className="text-[#002D5A] font-bold text-sm block">
                                                Haz clic para seleccionar
                                            </span>
                                            <span className="text-gray-500 text-sm block mt-1 font-medium">
                                                o arrastra las imágenes aquí
                                            </span>
                                        </div>
                                        <span className="text-xs text-gray-400 font-medium">
                                            Formatos: JPG, PNG, WEBP
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {importActas.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-gray-800">
                                        Actas Seleccionadas ({importActas.length})
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {importActas.map((acta, index) => (
                                            <div
                                                key={acta.id}
                                                className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
                                            >
                                                <div className="flex gap-3">
                                                    <div className="flex-shrink-0">
                                                        <img
                                                            src={acta.preview}
                                                            alt={`Vista previa ${index + 1}`}
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
                                                                onChange={e => {
                                                                    const v = e.target.value;
                                                                    setImportActas(prev =>
                                                                        prev.map((x, i) => (i === index ? { ...x, nombre: v } : x)),
                                                                    );
                                                                }}
                                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#002D5A]/30 focus:border-[#002D5A] outline-none"
                                                                placeholder="Ej: Acta revisión 01"
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeImportActa(index)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-semibold transition-colors"
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

                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50/80">
                            <button
                                type="button"
                                onClick={() => setImportActasModalOpen(false)}
                                className="px-6 py-2.5 text-sm font-bold text-[#002D5A] bg-white border-2 border-[#002D5A] rounded-xl hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => setImportActasModalOpen(false)}
                                className="px-6 py-2.5 text-sm font-bold text-white bg-[#002D5A] rounded-xl hover:bg-[#001f3d] transition-colors shadow-sm"
                            >
                                Aceptar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal contraseña importación (siempre) */}
            {showImportPasswordModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 z-[10000] border border-gray-100">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#E9F1FF]">
                                    <Lock className="w-5 h-5 text-[#002D5A]" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-[#002D5A]">Autorización</h2>
                                    <p className="text-sm text-gray-500 mt-0.5">Ingresa la contraseña para guardar</p>
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
                                className="w-full px-4 py-3 border-2 rounded-xl text-sm font-medium transition-all outline-none border-gray-200 bg-white focus:border-[#002D5A] focus:ring-4 focus:ring-blue-100"
                                placeholder="Ingresa la contraseña"
                                autoFocus
                            />
                            <div className="bg-[#E9F1FF] border border-[#002D5A]/20 rounded-lg p-3 mt-4">
                                <p className="text-xs text-[#002D5A] font-medium">
                                    Se guardarán <strong>{importMovs.length}</strong> ingreso(s).
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
                                onClick={() => confirmImportSave(importPassword.trim())}
                                disabled={isImportSaving || !importPassword.trim()}
                                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#002D5A] to-[#003d7a] hover:from-[#001f3d] hover:to-[#002D5A] text-white rounded-xl font-semibold text-sm shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
