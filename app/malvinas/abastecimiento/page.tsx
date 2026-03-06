'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    useMalvinas,
    TIENDAS,
    Tienda,
    AbastecimientoRow,
    UnidadMedida,
} from '../../context/MalvinasContext';
import * as api from '../../services/api';
import { Save, Eraser, X, Search, RefreshCw, ChevronDown, Image as ImageIcon, Download } from 'lucide-react';
import TableSkeleton from '../../components/TableSkeleton';
import { exportToPDF } from '../../utils/export';

// ─── Modal Guardar Abastecimiento ─────────────────────────────────────────────
function ModalGuardar({
    isOpen,
    onClose,
    rows,
}: {
    isOpen: boolean;
    onClose: () => void;
    rows: AbastecimientoRow[];
}) {
    const { guardarAbastecimiento, showToast } = useMalvinas();
    const [nombre, setNombre] = useState('');
    const [registradoPor, setRegistradoPor] = useState('');
    const [localRows, setLocalRows] = useState<AbastecimientoRow[]>(rows);

    // Actualizar localRows cuando rows cambia o cuando se abre el modal
    useEffect(() => {
        if (isOpen) {
            if (rows.length > 0) {
                setLocalRows(rows);
            } else {
                setLocalRows([]);
            }
        }
    }, [isOpen, rows]);

    const limpiarNegativos = () => {
        setLocalRows(prev =>
            prev.map(r => ({
                ...r,
                tiendas: Object.fromEntries(
                    TIENDAS.map(t => [t, Math.max(0, r.tiendas[t])])
                ) as Record<Tienda, number>,
            }))
        );
        showToast('info', 'Valores negativos limpiados a cero');
    };

    const handleGuardar = async () => {
        if (!nombre.trim()) { showToast('error', 'Ingresa un nombre para el abastecimiento'); return; }
        if (!registradoPor.trim()) { showToast('error', 'Ingresa el nombre de quien registra'); return; }
        if (localRows.length === 0) { showToast('error', 'No hay productos para guardar'); return; }
        
        try {
            await guardarAbastecimiento(nombre, registradoPor, localRows);
            showToast('success', `Abastecimiento "${nombre}" guardado correctamente`);
            setNombre('');
            setRegistradoPor('');
            onClose();
        } catch (error) {
            // El error ya se maneja en guardarAbastecimiento
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: '90vw', width: 1100 }}>
                <div className="modal-header">
                    <div>
                        <h6 style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#002D5A' }}>
                            Guardar Abastecimiento
                        </h6>
                        <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>
                            Revisa y confirma los datos del abastecimiento
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="modal-body">
                    {/* Nombre y Registrado por */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="form-label">Nombre del Abastecimiento *</label>
                            <input
                                type="text"
                                value={nombre}
                                onChange={e => setNombre(e.target.value)}
                                className="form-input"
                                style={{ fontSize: 12 }}
                                placeholder="Ej: Abastecimiento Semana 10"
                            />
                        </div>
                        <div>
                            <label className="form-label">Registrado Por *</label>
                            <input
                                type="text"
                                value={registradoPor}
                                onChange={e => setRegistradoPor(e.target.value)}
                                className="form-input"
                                style={{ fontSize: 12 }}
                                placeholder="Nombre de quien registra"
                            />
                        </div>
                    </div>

                    {/* Botón limpiar negativos */}
                    <div className="mb-3 flex items-center justify-between">
                        <span style={{ fontSize: 12, color: '#6b7280' }}>
                            {localRows.length} productos en este abastecimiento
                        </span>
                        <button onClick={limpiarNegativos} className="btn btn-warning btn-sm">
                            <Eraser className="w-3.5 h-3.5" />
                            Limpiar Negativos
                        </button>
                    </div>

                    {/* Tabla resumen */}
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Código</th>
                                    <th>Nombre</th>
                                    <th style={{ textAlign: 'center' }}>Cantidad</th>
                                    <th>U. Medida</th>
                                    {TIENDAS.map(t => (
                                        <th key={t} style={{ textAlign: 'center' }}>{t}</th>
                                    ))}
                                    <th style={{ textAlign: 'center' }}>Abastecer Cajas</th>
                                    <th style={{ textAlign: 'center' }}>Enviar</th>
                                </tr>
                            </thead>
                            <tbody>
                                {localRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                                <Search className="w-12 h-12" style={{ opacity: 0.3 }} />
                                                <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
                                                    No hay productos en el abastecimiento
                                                </p>
                                                <p style={{ fontSize: 12, margin: 0, opacity: 0.7 }}>
                                                    Los datos se están cargando o no hay productos para abastecer
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    localRows.map(r => (
                                        <tr key={r.productoId}>
                                            <td style={{ fontSize: 11, fontWeight: 600, color: '#002D5A' }}>{r.codigo}</td>
                                            <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nombre}</td>
                                            <td style={{ textAlign: 'center' }}>{r.cantidad}</td>
                                            <td><span className="badge badge-entrada" style={{ fontSize: 10 }}>{r.unidadMedida}</span></td>
                                            {TIENDAS.map(t => (
                                                <td key={t} style={{ textAlign: 'center' }}>
                                                    <span className={r.tiendas[t] < 0 ? 'value-negative' : r.tiendas[t] === 0 ? 'value-zero' : 'value-positive'}>
                                                        {r.tiendas[t]}
                                                    </span>
                                                </td>
                                            ))}
                                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.abastecerCajas}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest ${r.enviar === 'SI' ? 'bg-emerald-100 text-emerald-700 shadow-sm' : 'bg-red-100 text-red-700 shadow-sm'}`}>
                                                    {r.enviar}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="modal-footer">
                    <button onClick={onClose} className="btn btn-secondary">Cancelar</button>
                    <button onClick={handleGuardar} className="btn btn-success">
                        <Save className="w-4 h-4" />
                        Guardar Abastecimiento
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AbastecimientoPage() {
    const { state, showToast, refreshProductos } = useMalvinas();
    const [search, setSearch] = useState('');
    const [filtroEnviar, setFiltroEnviar] = useState<'SI' | 'NO' | 'TODOS'>('SI');
    const [modalOpen, setModalOpen] = useState(false);
    const [rows, setRows] = useState<AbastecimientoRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalImagenOpen, setModalImagenOpen] = useState(false);
    const [generandoImagen, setGenerandoImagen] = useState(false);
    const [fechaGeneracion, setFechaGeneracion] = useState<string>('');
    const capturaRef = useRef<HTMLDivElement | null>(null);

    // Inicializar fecha solo en el cliente para evitar errores de hidratación
    useEffect(() => {
        setFechaGeneracion(new Date().toLocaleString());
    }, []);

    // Cargar datos de abastecimiento desde la API
    useEffect(() => {
        const cargarAbastecimiento = async () => {
            setLoading(true);
            try {
                const abastecimientoData = await api.calcularAbastecimiento();
                
                // Convertir datos de la API al formato del frontend
                const productosMap = new Map(state.productos.map(p => [p.codigo, p]));
                
                const rowsCalculados: AbastecimientoRow[] = abastecimientoData.map(item => {
                    const producto = productosMap.get(item.codigo);
                    const productoId = producto?.id || '';
                    
                    return {
                        productoId,
                        codigo: item.codigo,
                        nombre: item.nombre,
                        cantidad: item.cantidad,
                        unidadMedida: item.unidad_medida as UnidadMedida,
                        tiendas: {
                            'TIENDA 3006': item.abastecer_3006,
                            'TIENDA 3131': item.abastecer_3131,
                            'TIENDA 412-A': item.abastecer_412a,
                            'TIENDA 3133': item.abastecer_3133,
                        },
                        abastecerCajas: item.abastecer_cajas,
                        enviar: item.enviar as 'SI' | 'NO',
                    };
                });
                
                setRows(rowsCalculados);
            } catch (error: any) {
                console.error('Error cargando abastecimiento:', error);
                showToast('error', 'Error al cargar datos de abastecimiento');
            } finally {
                setLoading(false);
            }
        };

        if (state.productos.length > 0) {
            cargarAbastecimiento();
        } else {
            setLoading(false);
        }
    }, [state.productos, showToast]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return rows.filter(r => {
            const matchSearch = r.nombre.toLowerCase().includes(q) || r.codigo.toLowerCase().includes(q);
            const matchEnviar = filtroEnviar === 'TODOS' || r.enviar === filtroEnviar;
            return matchSearch && matchEnviar;
        });
    }, [rows, search, filtroEnviar]);

    const paraSI = rows.filter(r => r.enviar === 'SI').length;
    
    // Filtrar productos según el filtro seleccionado para la imagen
    const rowsParaImagen = useMemo(() => {
        if (filtroEnviar === 'SI') {
            return rows.filter(r => r.enviar === 'SI');
        } else if (filtroEnviar === 'NO') {
            return rows.filter(r => r.enviar === 'NO');
        } else {
            // TODOS
            return rows;
        }
    }, [rows, filtroEnviar]);

    const handleAbrirPrevisualizacion = () => {
        if (rowsParaImagen.length === 0) {
            const mensaje = filtroEnviar === 'SI' 
                ? 'No hay productos con ENVIAR = SI para generar la imagen'
                : filtroEnviar === 'NO'
                ? 'No hay productos con ENVIAR = NO para generar la imagen'
                : 'No hay productos para generar la imagen';
            showToast('error', mensaje);
            return;
        }
        setModalImagenOpen(true);
    };

    const handleDescargarPDF = () => {
        const productosSI = rows.filter(r => r.enviar === 'SI');
        
        if (productosSI.length === 0) {
            showToast('error', 'No hay productos con ENVIAR = SI para descargar');
            return;
        }

        // Preparar datos para el PDF
        const datosPDF = productosSI.map(row => ({
            codigo: row.codigo,
            producto: row.nombre,
            cantidad: row.cantidad,
            unidadMedida: row.unidadMedida,
            tienda3006: row.tiendas['TIENDA 3006'],
            tienda3131: row.tiendas['TIENDA 3131'],
            tienda412A: row.tiendas['TIENDA 412-A'],
            tienda3133: row.tiendas['TIENDA 3133'],
            abastecerCajas: row.abastecerCajas,
            enviar: row.enviar,
        }));

        // Definir columnas para el PDF
        const columns = [
            { header: 'CÓDIGO', dataKey: 'codigo' },
            { header: 'PRODUCTO', dataKey: 'producto' },
            { header: 'CANT.', dataKey: 'cantidad' },
            { header: 'U. MEDIDA', dataKey: 'unidadMedida' },
            { header: 'TIENDA 3006', dataKey: 'tienda3006' },
            { header: 'TIENDA 3131', dataKey: 'tienda3131' },
            { header: 'TIENDA 412-A', dataKey: 'tienda412A' },
            { header: 'TIENDA 3133', dataKey: 'tienda3133' },
            { header: 'ABASTECER CAJAS', dataKey: 'abastecerCajas' },
            { header: 'ENVIAR', dataKey: 'enviar' },
        ];

        const fecha = new Date().toISOString().split('T')[0];
        exportToPDF(datosPDF, columns, `Abastecimiento_Stock_SI_${fecha}`, 'ABASTECIMIENTO AUTOMÁTICO - STOCK (ENVIAR = SI)');
        showToast('success', `PDF descargado con ${productosSI.length} producto(s)`);
    };

    const handleDescargarImagen = async () => {
        if (generandoImagen) return;
        if (!capturaRef.current) {
            showToast('error', 'No se encontró el contenedor para generar la imagen');
            return;
        }

        setGenerandoImagen(true);
        try {
            const html2canvas = (await import('html2canvas')).default;

            const original = capturaRef.current;
            const clone = original.cloneNode(true) as HTMLElement;
            clone.style.width = '1600px';
            clone.style.position = 'absolute';
            clone.style.left = '-9999px';
            clone.style.top = '0';
            clone.style.zIndex = '-1';
            clone.style.backgroundColor = '#ffffff';
            document.body.appendChild(clone);

            // Esperar un tick para que el DOM aplique estilos
            await new Promise(resolve => setTimeout(resolve, 120));

            const height = Math.max(clone.scrollHeight, clone.offsetHeight, 600);

            const canvas = await html2canvas(clone, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                width: 1600,
                height,
                windowWidth: 1600,
                windowHeight: height,
                imageTimeout: 20000,
                removeContainer: true,
                onclone: (clonedDoc) => {
                    // Forzar antialiasing para texto
                    const all = clonedDoc.querySelectorAll('*');
                    all.forEach((el: any) => {
                        try {
                            el.style.webkitFontSmoothing = 'antialiased';
                            el.style.mozOsxFontSmoothing = 'grayscale';
                            el.style.textRendering = 'optimizeLegibility';
                        } catch {}
                    });
                },
            });

            // Descargar como JPG
            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            const a = document.createElement('a');
            const fecha = new Date().toISOString().split('T')[0];
            a.href = imgData;
            a.download = `abastecimiento_stock_${fecha}.jpg`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => document.body.removeChild(a), 100);

            document.body.removeChild(clone);
            showToast('success', 'Imagen generada y descargada correctamente');
            setModalImagenOpen(false);
        } catch (e: any) {
            console.error('Error generando imagen stock:', e);
            showToast('error', e?.message || 'Error al generar la imagen');
        } finally {
            setGenerandoImagen(false);
        }
    };

    return (
        <div id="view-abastecimiento" className="animate-in fade-in duration-500 font-poppins">
            <div className="container mx-auto">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6 transition-all">
                    {/* Header Principal */}
                    <header className="flex justify-between items-center flex-wrap gap-4 mb-8">
                        <div className="flex items-center space-x-3">
                            <div className="w-11 h-11 bg-gradient-to-br from-[#059669] to-[#10b981] rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-900/10 transition-transform hover:scale-110">
                                <RefreshCw className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="font-bold text-gray-900 m-0 tracking-tight" style={{ fontSize: '18px' }}>
                                    Abastecimiento Automático
                                </h1>
                                <p className="text-[11px] text-gray-400 mt-0.5 font-medium italic opacity-80">Cálculo de reposición basado en stock mínimo de Malvinas</p>
                            </div>
                        </div>
                        <div className="header-actions flex items-center gap-4">
                            {paraSI > 0 && (
                                <div className="hidden lg:flex flex-col items-end mr-1">
                                    <span className="text-[9px] uppercase font-black text-amber-600 tracking-widest opacity-60">Pendientes</span>
                                    <span className="text-xl font-black text-amber-700 leading-none">{paraSI}</span>
                                </div>
                            )}
                            <button
                                onClick={handleAbrirPrevisualizacion}
                                disabled={rowsParaImagen.length === 0}
                                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl font-bold transition-all duration-300 shadow-md text-[10px] bg-[#0f172a] hover:bg-[#0b1223] text-white hover:shadow-lg hover:-translate-y-0.5 active:scale-95 border-b-2 border-black/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                            >
                                <ImageIcon className="w-3.5 h-3.5 stroke-[3px]" />
                                <span>GENERAR IMAGEN STOCK</span>
                            </button>
                            <button
                                onClick={handleDescargarPDF}
                                disabled={rows.filter(r => r.enviar === 'SI').length === 0}
                                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl font-bold transition-all duration-300 shadow-md text-[10px] bg-[#dc2626] hover:bg-[#b91c1c] text-white hover:shadow-lg hover:-translate-y-0.5 active:scale-95 border-b-2 border-black/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                            >
                                <Download className="w-3.5 h-3.5 stroke-[3px]" />
                                <span>DESCARGAR PDF</span>
                            </button>
                            <button
                                onClick={() => setModalOpen(true)}
                                disabled={rows.length === 0}
                                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl font-bold transition-all duration-300 shadow-md text-[10px] bg-[#059669] hover:bg-[#047857] text-white hover:shadow-lg hover:-translate-y-0.5 active:scale-95 border-b-2 border-black/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                            >
                                <Save className="w-3.5 h-3.5 stroke-[3px]" />
                                <span>GUARDAR REPORTE</span>
                            </button>
                        </div>
                    </header>

                    {/* Contenedor oculto para generar la imagen (solo ENVIAR = SI) */}
                    <div
                        ref={capturaRef}
                        style={{
                            position: 'absolute',
                            left: -9999,
                            top: 0,
                            width: 1600,
                            background: '#ffffff',
                            padding: 16,
                            color: '#0f172a',
                            fontFamily: 'var(--font-poppins)',
                        }}
                    >
                        <div
                            style={{
                                background: '#002D5A',
                                color: 'white',
                                padding: '14px 16px',
                                borderRadius: 12,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: 12,
                            }}
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 0.2 }}>
                                    ABASTECIMIENTO AUTOMÁTICO - STOCK
                                </div>
                                <div style={{ fontSize: 12, opacity: 0.85 }}>
                                    Generado: {fechaGeneracion || 'Cargando...'}
                                </div>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 800 }}>
                                Total: {rowsParaImagen.length}
                            </div>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                                <tr style={{ background: '#001f3d', color: 'white' }}>
                                    <th style={{ textAlign: 'left', padding: 10, border: '1px solid #0b2b52' }}>Código</th>
                                    <th style={{ textAlign: 'left', padding: 10, border: '1px solid #0b2b52' }}>Producto</th>
                                    <th style={{ textAlign: 'center', padding: 10, border: '1px solid #0b2b52' }}>Cant.</th>
                                    <th style={{ textAlign: 'center', padding: 10, border: '1px solid #0b2b52' }}>U. Medida</th>
                                    {TIENDAS.map(t => (
                                        <th key={`img-${t}`} style={{ textAlign: 'center', padding: 10, border: '1px solid #0b2b52' }}>
                                            {t.replace('TIENDA ', '')}
                                        </th>
                                    ))}
                                    <th style={{ textAlign: 'center', padding: 10, border: '1px solid #0b2b52' }}>Abastecer Cajas</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rowsParaImagen.map((r, idx) => (
                                    <tr key={`img-row-${r.productoId}-${idx}`} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                        <td style={{ padding: 10, border: '1px solid #e5e7eb', fontWeight: 800, color: '#002D5A' }}>{r.codigo}</td>
                                        <td style={{ padding: 10, border: '1px solid #e5e7eb', fontWeight: 700 }}>{r.nombre}</td>
                                        <td style={{ padding: 10, border: '1px solid #e5e7eb', textAlign: 'center', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
                                            {r.cantidad}
                                        </td>
                                        <td style={{ padding: 10, border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 800, color: '#1d4ed8' }}>
                                            {r.unidadMedida}
                                        </td>
                                        {TIENDAS.map(t => {
                                            const val = r.tiendas[t];
                                            const color =
                                                val === 0 ? '#94a3b8' : val < 0 ? '#dc2626' : '#059669';
                                            const text = val > 0 ? `+${val}` : `${val}`;
                                            return (
                                                <td
                                                    key={`img-cell-${r.productoId}-${t}`}
                                                    style={{
                                                        padding: 10,
                                                        border: '1px solid #e5e7eb',
                                                        textAlign: 'center',
                                                        fontWeight: 900,
                                                        color,
                                                    }}
                                                >
                                                    {text}
                                                </td>
                                            );
                                        })}
                                        <td style={{ padding: 10, border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 900, fontSize: 14, color: '#059669' }}>
                                            {r.abastecerCajas}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Toolbar - Moved out of the card table area */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 mb-2 bg-transparent">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-emerald-50 rounded-lg">
                                <Search className="w-4 h-4 text-[#059669]" />
                            </div>
                            <span className="font-bold text-gray-800" style={{ fontSize: 14 }}>
                                Listado de Reposición
                            </span>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-72">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar producto..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-[#059669] outline-none transition-all shadow-sm"
                                />
                            </div>
                            <div className="relative">
                                <select
                                    value={filtroEnviar}
                                    onChange={e => setFiltroEnviar(e.target.value as 'SI' | 'NO' | 'TODOS')}
                                    className="w-full pl-4 pr-8 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-[#059669] outline-none transition-all shadow-sm appearance-none"
                                    style={{ paddingRight: 32 }}
                                >
                                    <option value="SI">Si</option>
                                    <option value="NO">No</option>
                                    <option value="TODOS">Todos</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                            <button onClick={() => { setSearch(''); setFiltroEnviar('SI'); }} className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all shadow-sm active:scale-95">
                                <RefreshCw className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>
                    </div>

                    {/* Table card */}
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xl">

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="text-[9px] uppercase font-bold tracking-wider">
                                    <tr className="bg-[#002D5A] text-white">
                                        <th rowSpan={2} className="px-4 py-4 border-r border-[#ffffff1a]">Código</th>
                                        <th rowSpan={2} className="px-4 py-4 border-r border-[#ffffff1a] min-w-[200px]">Producto</th>
                                        <th rowSpan={2} className="px-4 py-4 border-r border-[#ffffff1a] text-center">Cant.</th>
                                        <th rowSpan={2} className="px-4 py-4 border-r border-[#ffffff1a]">U. Medida</th>
                                        <th colSpan={4} className="px-4 py-2 text-center border-b border-[#ffffff1a] bg-[#001f3d]">Abastecer por Tienda</th>
                                        <th rowSpan={2} className="px-4 py-4 border-l border-[#ffffff1a] text-center">Abastecer Cajas</th>
                                        <th rowSpan={2} className="px-4 py-4 text-center">Enviar</th>
                                    </tr>
                                    <tr className="bg-[#001f3d] text-white">
                                        {TIENDAS.map(t => (
                                            <th key={t} className="px-2 py-3 text-center border-r border-[#ffffff1a] last:border-r-0">{t}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 font-poppins">
                                    {loading ? (
                                        <TableSkeleton rows={5} cols={10} />
                                    ) : filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className="px-4 py-20 text-center">
                                                <div className="flex flex-col items-center justify-center opacity-40">
                                                    <Search className="w-12 h-12 mb-4" />
                                                    <p className="font-black text-gray-900 tracking-tight uppercase italic text-sm">
                                                        {search || filtroEnviar !== 'TODOS' ? 'No se encontraron productos con ese criterio' : 'No hay productos para abastecer'}
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filtered.map(r => (
                                        <tr key={r.productoId} className="hover:bg-emerald-50/30 transition-colors">
                                            <td className="px-4 py-3 font-bold text-[#002D5A] border-r border-gray-50 text-[11px] uppercase tracking-tight">{r.codigo}</td>
                                            <td className="px-4 py-3 font-semibold text-gray-800 border-r border-gray-50 text-[11px] uppercase tracking-tight">{r.nombre}</td>
                                            <td className="px-4 py-3 text-center text-gray-600 border-r border-gray-50 font-mono text-[11px]">{r.cantidad}</td>
                                            <td className="px-4 py-3 border-r border-gray-50 text-center">
                                                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[9px] font-bold uppercase">
                                                    {r.unidadMedida}
                                                </span>
                                            </td>
                                            {TIENDAS.map(t => (
                                                <td key={t} className="px-2 py-3 text-center border-r border-gray-50 text-[11px]">
                                                    {r.tiendas[t] === 0 ? (
                                                        <span className="text-gray-300">0</span>
                                                    ) : r.tiendas[t] < 0 ? (
                                                        <span className="text-red-500 font-bold">{r.tiendas[t]}</span>
                                                    ) : (
                                                        <span className="text-emerald-600 font-bold">+{r.tiendas[t]}</span>
                                                    )}
                                                </td>
                                            ))}
                                            <td className="px-4 py-3 text-center border-l border-gray-50 font-black text-base">
                                                {r.abastecerCajas > 0 ? (
                                                    <span className="text-[#059669]">{r.abastecerCajas}</span>
                                                ) : (
                                                    <span className="text-gray-300">0</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest ${r.enviar === 'SI' ? 'bg-emerald-100 text-emerald-700 shadow-sm' : 'bg-red-100 text-red-700 shadow-sm'
                                                    }`}>
                                                    {r.enviar}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <ModalGuardar
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                rows={rows}
            />

            {/* Modal Previsualización Imagen */}
            {modalImagenOpen && (
                <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setModalImagenOpen(false)}>
                    <div className="modal-box" style={{ maxWidth: '95vw', width: 1400, maxHeight: '95vh', overflow: 'auto' }}>
                        <div className="modal-header">
                            <div>
                                <h6 style={{ margin: 0, fontWeight: 700, fontSize: 16, color: '#002D5A' }}>
                                    Previsualización de Imagen Stock
                                </h6>
                                <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>
                                    Vista previa de la imagen que se generará 
                                    {filtroEnviar === 'SI' && ' (solo productos con ENVIAR = SI)'}
                                    {filtroEnviar === 'NO' && ' (solo productos con ENVIAR = NO)'}
                                    {filtroEnviar === 'TODOS' && ' (todos los productos)'}
                                </p>
                            </div>
                            <button onClick={() => setModalImagenOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="modal-body" style={{ padding: 0 }}>
                            <div
                                style={{
                                    width: '100%',
                                    background: '#ffffff',
                                    padding: 16,
                                    color: '#0f172a',
                                    fontFamily: 'var(--font-poppins)',
                                }}
                            >
                                <div
                                    style={{
                                        background: '#002D5A',
                                        color: 'white',
                                        padding: '14px 16px',
                                        borderRadius: 12,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        marginBottom: 12,
                                    }}
                                >
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 0.2 }}>
                                            ABASTECIMIENTO AUTOMÁTICO - STOCK
                                        </div>
                                        <div style={{ fontSize: 12, opacity: 0.85 }}>
                                            Generado: {fechaGeneracion || 'Cargando...'}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 14, fontWeight: 800 }}>
                                        Total: {rowsParaImagen.length}
                                    </div>
                                </div>

                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1200 }}>
                                        <thead>
                                            <tr style={{ background: '#001f3d', color: 'white' }}>
                                                <th style={{ textAlign: 'left', padding: 10, border: '1px solid #0b2b52' }}>Código</th>
                                                <th style={{ textAlign: 'left', padding: 10, border: '1px solid #0b2b52' }}>Producto</th>
                                                <th style={{ textAlign: 'center', padding: 10, border: '1px solid #0b2b52' }}>Cant.</th>
                                                <th style={{ textAlign: 'center', padding: 10, border: '1px solid #0b2b52' }}>U. Medida</th>
                                                {TIENDAS.map(t => (
                                                    <th key={`prev-${t}`} style={{ textAlign: 'center', padding: 10, border: '1px solid #0b2b52' }}>
                                                        {t.replace('TIENDA ', '')}
                                                    </th>
                                                ))}
                                                <th style={{ textAlign: 'center', padding: 10, border: '1px solid #0b2b52' }}>Abastecer Cajas</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rowsParaImagen.map((r, idx) => (
                                                <tr key={`prev-row-${r.productoId}-${idx}`} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                                    <td style={{ padding: 10, border: '1px solid #e5e7eb', fontWeight: 800, color: '#002D5A' }}>{r.codigo}</td>
                                                    <td style={{ padding: 10, border: '1px solid #e5e7eb', fontWeight: 700 }}>{r.nombre}</td>
                                                    <td style={{ padding: 10, border: '1px solid #e5e7eb', textAlign: 'center', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
                                                        {r.cantidad}
                                                    </td>
                                                    <td style={{ padding: 10, border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 800, color: '#1d4ed8' }}>
                                                        {r.unidadMedida}
                                                    </td>
                                                    {TIENDAS.map(t => {
                                                        const val = r.tiendas[t];
                                                        const color =
                                                            val === 0 ? '#94a3b8' : val < 0 ? '#dc2626' : '#059669';
                                                        const text = val > 0 ? `+${val}` : `${val}`;
                                                        return (
                                                            <td
                                                                key={`prev-cell-${r.productoId}-${t}`}
                                                                style={{
                                                                    padding: 10,
                                                                    border: '1px solid #e5e7eb',
                                                                    textAlign: 'center',
                                                                    fontWeight: 800,
                                                                    color,
                                                                }}
                                                            >
                                                                {text}
                                                            </td>
                                                        );
                                                    })}
                                                    <td style={{ padding: 10, border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 900, fontSize: 14, color: '#059669' }}>
                                                        {r.abastecerCajas}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button onClick={() => setModalImagenOpen(false)} className="btn btn-secondary">
                                Cancelar
                            </button>
                            <button 
                                onClick={handleDescargarImagen} 
                                disabled={generandoImagen}
                                className="btn btn-success"
                            >
                                <Download className="w-4 h-4" />
                                {generandoImagen ? 'Generando...' : 'Descargar Imagen'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
