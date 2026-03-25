'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useMalvinas, TIENDAS, Tienda, Producto } from '../context/MalvinasContext';
import { Search, RefreshCw, TrendingUp, Package, AlertTriangle, Building, Box, Columns2, Check, X, Lock, FileSpreadsheet } from 'lucide-react';
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

const STORAGE_KEY_SELECTED = 'malvinas_inventario_selected';
const STORAGE_KEY_EDITING = 'malvinas_inventario_editing';

const PASSWORD_REQUIRED = '0427';

export default function StockTotalPage() {
    const { state, refreshProductos, showToast } = useMalvinas();
    const [search, setSearch] = useState('');
    const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
    const [editingProducts, setEditingProducts] = useState<Map<string, EditingProduct>>(new Map());
    const [isSaving, setIsSaving] = useState(false);
    const [isRestoring, setIsRestoring] = useState(true);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState(false);
    const isLoading = state.loading;

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
    const alertas = state.productos.filter(p =>
        TIENDAS.some(t => p.existencia[t] < p.stockMinimo[t])
    ).length;

    const stats = [
        { label: 'Productos', value: totalProductos, icon: Package, color: '#002D5A', bg: '#E9F1FF' },
        { label: 'Entradas', value: entradas, icon: TrendingUp, color: '#1e40af', bg: '#dbeafe' },
        { label: 'Salidas', value: salidas, icon: TrendingUp, color: '#9d174d', bg: '#fce7f3' },
        { label: 'Stock Bajo', value: alertas, icon: AlertTriangle, color: '#92400e', bg: '#fffbeb' },
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

    // Validar contraseña y confirmar cambios
    const handleConfirmAll = async () => {
        if (password !== PASSWORD_REQUIRED) {
            setPasswordError(true);
            showToast('error', 'Contraseña incorrecta');
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
            'STOCK GLOBAL',
            'U. MEDIDA',
            'EXISTENCIA ALMACEN',
            '',
            '',
            '',
            'DISPONIBLES',
            'STOCK DETALLADO',
            '',
            '',
        ];

        const headerBottom = [
            '',
            '',
            '',
            '3006',
            '3131',
            '412-A',
            '3133',
            '',
            '',
            '3006',
            '3131',
            '412-A',
            '3133',
            '',
            'CAJAS',
            'MED.',
            'U.MED',
        ];

        const rows = filtered.map(p => {
            const editing = editingProducts.get(p.id);
            const stockMin = editing ? editing.editing.stockMinimo : p.stockMinimo;
            const cantidadReg = editing ? editing.editing.cantidadRegCalculo : p.cantidadRegCalculo;
            const stockGlobalMin = TIENDAS.reduce((acc, t) => acc + (stockMin[t] || 0), 0);
            const disponibles = TIENDAS.reduce((acc, t) => acc + (p.existencia[t] || 0), 0);
            const cajas = cantidadReg > 0 ? Math.ceil(disponibles / cantidadReg) : 0;
            const medida = (cajas * cantidadReg) - disponibles;

            return [
                p.codigo,
                p.nombre,
                cantidadReg,
                stockMin['TIENDA 3006'] || 0,
                stockMin['TIENDA 3131'] || 0,
                stockMin['TIENDA 412-A'] || 0,
                stockMin['TIENDA 3133'] || 0,
                stockGlobalMin,
                p.unidadMedidaRegCalculo,
                p.existencia['TIENDA 3006'] || 0,
                p.existencia['TIENDA 3131'] || 0,
                p.existencia['TIENDA 412-A'] || 0,
                p.existencia['TIENDA 3133'] || 0,
                disponibles,
                cajas,
                Math.abs(medida),
                p.unidadMedidaRegCalculo,
            ];
        });

        const ws = XLSX.utils.aoa_to_sheet([headerTop, headerBottom, ...rows]);
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // CODIGO
            { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // PRODUCTO
            { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }, // CANT.
            { s: { r: 0, c: 3 }, e: { r: 0, c: 6 } }, // STOCK MINIMO
            { s: { r: 0, c: 7 }, e: { r: 1, c: 7 } }, // STOCK GLOBAL
            { s: { r: 0, c: 8 }, e: { r: 1, c: 8 } }, // U. MEDIDA
            { s: { r: 0, c: 9 }, e: { r: 0, c: 12 } }, // EXISTENCIA ALMACEN
            { s: { r: 0, c: 13 }, e: { r: 1, c: 13 } }, // DISPONIBLES
            { s: { r: 0, c: 14 }, e: { r: 0, c: 16 } }, // STOCK DETALLADO
        ];
        ws['!cols'] = [
            { wch: 12 }, { wch: 34 }, { wch: 8 },
            { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
            { wch: 12 }, { wch: 12 },
            { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
            { wch: 12 },
            { wch: 8 }, { wch: 8 }, { wch: 10 },
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
        XLSX.writeFile(wb, `Inventario_Malvinas_${new Date().toISOString().split('T')[0]}.xlsx`);
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
                                    Inventario Malvinas
                                </h1>
                                <p className="text-[11px] text-gray-400 mt-0.5 font-medium italic opacity-80">Vista general del stock y gestión por tienda</p>
                            </div>
                        </div>
                        {editingProducts.size > 0 && (
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-orange-600">
                                    {editingProducts.size} producto(s) en edición
                                </span>
                                <button
                                    onClick={handleConfirmAllClick}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all duration-300 shadow-md text-[11px] bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
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
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6 border-b border-gray-100 bg-transparent">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-100 rounded-xl shadow-sm">
                                <Search className="w-5 h-5 text-[#002D5A]" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 m-0" style={{ fontSize: 16 }}>
                                    Inventario Detallado
                                </h3>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Control de Stock en Tiempo Real</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-72">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar código o nombre..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-12 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-50 focus:border-[#002D5A] outline-none transition-all shadow-sm"
                                />
                            </div>
                            <button
                                onClick={handleExportExcel}
                                className="px-5 py-2.5 text-sm font-bold text-white bg-green-600 border border-green-600 rounded-2xl hover:bg-green-700 transition-all flex items-center gap-2 shadow-sm active:scale-95"
                            >
                                <FileSpreadsheet className="w-4 h-4" />
                                <span className="hidden sm:inline uppercase tracking-wider text-[10px]">Exportar Excel</span>
                            </button>
                            <button
                                onClick={() => setSearch('')}
                                className="px-5 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 hover:text-[#002D5A] transition-all flex items-center gap-2 shadow-sm active:scale-95"
                            >
                                <RefreshCw className="w-4 h-4" />
                                <span className="hidden sm:inline uppercase tracking-wider text-[10px]">Limpiar</span>
                            </button>
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
                                        <th rowSpan={2} className="px-4 py-3 border-r border-[#ffffff20] text-center">Cant.</th>
                                        <th colSpan={4} className="px-4 py-2 border-r border-[#ffffff20] text-center bg-[#1a4a7a]">
                                            Stock Mínimo
                                        </th>
                                        <th rowSpan={2} className="px-4 py-3 border-r border-[#ffffff20] text-center">Stock Global</th>
                                        <th rowSpan={2} className="px-4 py-3 border-r border-[#ffffff20] text-center">U. Medida</th>
                                        <th colSpan={4} className="px-4 py-2 border-r border-[#ffffff20] text-center bg-[#1a4a7a]">
                                            Existencia Almacén
                                        </th>
                                        <th rowSpan={2} className="px-4 py-3 border-r border-[#ffffff20] text-center bg-[#001F3D]">Disponibles</th>
                                        <th colSpan={3} className="px-4 py-2 text-center bg-[#1a4a7a]">Stock Detallado</th>
                                    </tr>
                                    <tr className="bg-[#1a4a7a] text-white border-t border-[#ffffff20]">
                                        {TIENDAS.map(t => (
                                            <th key={`min-${t}`} className="px-2 py-2 border-r border-[#ffffff20] text-center text-[9px]">
                                                {t.replace('TIENDA ', '')}
                                            </th>
                                        ))}
                                        {TIENDAS.map(t => (
                                            <th key={`ex-${t}`} className="px-2 py-2 border-r border-[#ffffff20] text-center text-[9px]">
                                                {t.replace('TIENDA ', '')}
                                            </th>
                                        ))}
                                        <th className="px-2 py-2 border-r border-[#ffffff20] text-center">Cajas</th>
                                        <th className="px-2 py-2 border-r border-[#ffffff20] text-center">Med.</th>
                                        <th className="px-2 py-2 text-center">U.Med</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {isLoading ? (
                                        <TableSkeleton rows={20} cols={17} />
                                    ) : filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={17} className="px-4 py-12 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <Package className="w-12 h-12 text-gray-300" />
                                                    <p className="text-gray-400 text-sm font-medium">
                                                        {search ? 'No se encontraron productos con ese criterio' : 'No hay productos registrados'}
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filtered.map(p => {
                                            const isSelected = selectedProducts.has(p.id);
                                            const editing = editingProducts.get(p.id);
                                            const isEditing = !!editing;
                                            
                                            const stockGlobalMin = TIENDAS.reduce((acc, t) => 
                                                acc + (editing ? editing.editing.stockMinimo[t] : p.stockMinimo[t]), 0
                                            );
                                            // Existencia siempre usa el valor original porque no se puede editar
                                            const disponibles = TIENDAS.reduce((acc, t) => 
                                                acc + p.existencia[t], 0
                                            );
                                            const cantidadReg = editing ? editing.editing.cantidadRegCalculo : p.cantidadRegCalculo;
                                            // Redondear hacia arriba: si es 11.1, 11.2, etc., se redondea a 12
                                            const cajas = cantidadReg > 0 ? Math.ceil(disponibles / cantidadReg) : 0;
                                            const medida = (cajas * cantidadReg) - disponibles;
                                            
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
                                                    {TIENDAS.map(t => (
                                                        <td key={`min-${t}`} className="px-2 py-3 text-center text-[11px]">
                                                            {isEditing ? (
                                                                <input
                                                                    type="number"
                                                                    value={editing.editing.stockMinimo[t] === 0 ? '' : editing.editing.stockMinimo[t]}
                                                                    onChange={e => updateEditingValue(p.id, 'stockMinimo', t, Number(e.target.value) || 0)}
                                                                    onClick={e => e.stopPropagation()}
                                                                    className="w-full px-2 py-1 border-2 border-yellow-500 rounded text-[10px] text-gray-900 font-semibold text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                    placeholder="0"
                                                                />
                                                            ) : (
                                                                <span className="text-gray-400">
                                                                    {p.stockMinimo[t] > 0 ? p.stockMinimo[t] : '-'}
                                                                </span>
                                                            )}
                                                        </td>
                                                    ))}
                                                    <td className="px-4 py-3 text-center font-bold text-[11px]">{stockGlobalMin}</td>
                                                    <td className="px-4 py-3 text-center text-[11px]">
                                                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[9px] font-bold">
                                                            {p.unidadMedidaRegCalculo}
                                                        </span>
                                                    </td>
                                                    {TIENDAS.map(t => {
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
                                                    <td className="px-4 py-3 text-center font-bold text-[11px]">{cajas}</td>
                                                    <td className="px-4 py-3 text-center font-bold text-[11px]" style={{ color: medida < 0 ? '#dc2626' : '#22c55e' }}>
                                                        {Math.abs(medida)}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-[9px] text-gray-400 font-medium whitespace-nowrap uppercase">
                                                        {p.unidadMedidaRegCalculo}
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
                                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                                    <Lock className="w-5 h-5 text-orange-600" />
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
                                            : 'border-gray-200 bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-100'
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
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                <p className="text-xs text-orange-800 font-medium">
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
                                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-semibold text-sm shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
        </div>
    );
}
