'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    useCallao,
    TIENDAS,
    TIENDAS_VISTA_INVENTARIO_CALLAO,
    Tienda, 
    AbastecimientoRow,
    UnidadMedida,
    resolveIdUnidadMedidaReg, 
} from '../../context/CallaoContext';
import * as api from '../../services/api';
import { Save, Eraser, X, Search, RefreshCw, ChevronDown, Image as ImageIcon, Download, Loader2, Upload, Trash2, FileImage, Lock } from 'lucide-react';
import TableSkeleton from '../../components/TableSkeleton';
import { exportToPDF } from '../../utils/export';

// ─── Modal Guardar Abastecimiento ─────────────────────────────────────────────
function ModalGuardar({
    isOpen,
    onClose,
    rows,
    descargarPDFDespues,
    descargarImagenDespues,
    capturaRef,
    onGuardado,
}: {
    isOpen: boolean;
    onClose: () => void;
    rows: AbastecimientoRow[];
    descargarPDFDespues?: boolean;
    descargarImagenDespues?: boolean;
    capturaRef?: React.RefObject<HTMLDivElement | null>;
    onGuardado?: () => void;
}) {
    const { state, showToast, refreshAbastecimiento } = useCallao();
    const [nombre, setNombre] = useState('');
    const [registradoPor, setRegistradoPor] = useState('');
    const [localRows, setLocalRows] = useState<AbastecimientoRow[]>(rows);
    const [guardando, setGuardando] = useState(false);
    const [generandoImagen, setGenerandoImagen] = useState(false);
    const [actas, setActas] = useState<Array<{ file: File; nombre: string; preview: string }>>([]);
    const [modalActasOpen, setModalActasOpen] = useState(false);
    const [modalPasswordOpen, setModalPasswordOpen] = useState(false);
    const [passwordAutorizacion, setPasswordAutorizacion] = useState('');

    // Actualizar localRows cuando rows cambia o cuando se abre el modal
    useEffect(() => {
        if (isOpen) {
            if (rows.length > 0) {
                setLocalRows(rows);
            } else {
                setLocalRows([]);
            }
        } else {
            // Limpiar actas cuando se cierra el modal
            setActas([]);
            setPasswordAutorizacion('');
        }
    }, [isOpen, rows]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const nuevasActas = files.map(file => ({
            file,
            nombre: file.name.replace(/\.[^/.]+$/, ''), // Nombre sin extensión por defecto
            preview: URL.createObjectURL(file)
        }));
        setActas(prev => [...prev, ...nuevasActas]);
        e.target.value = ''; // Reset input
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

    const handleDescargarImagen = async () => {
        if (!capturaRef?.current) {
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
        } catch (e: any) {
            console.error('Error generando imagen stock:', e);
            showToast('error', e?.message || 'Error al generar la imagen');
        } finally {
            setGenerandoImagen(false);
        }
    };

    const handleGuardar = async () => {
        if (!nombre.trim()) { showToast('error', 'Ingresa un nombre para el abastecimiento'); return; }
        if (!registradoPor.trim()) { showToast('error', 'Ingresa el nombre de quien registra'); return; }
        if (localRows.length === 0) { showToast('error', 'No hay productos para guardar'); return; }
        await ejecutarGuardado();
    };

    const ejecutarGuardado = async () => {
        setGuardando(true);
        try {
            const detalles = localRows.map(item => {
                const producto = state.productos.find(p => p.id === item.productoId);
                if (!producto) throw new Error(`Producto ${item.codigo} no encontrado`);

                return {
                    codigo: item.codigo,
                    cantidad_reg_calculo: producto.cantidadRegCalculo,
                    id_unidad_medida: resolveIdUnidadMedidaReg(producto),
                    cant_almacen_oficina: Math.max(0, item.tiendas['TIENDA OFICINA']),
                    cant_almacen_oficina_docenas: Math.max(0, item.tiendas['TIENDA OFICINA-DOCENAS']),
                    cant_almacen_callao_1_a: Math.max(0, item.tiendas['TIENDA CALLAO-1-A']),
                    cant_almacen_callao_1_b: Math.max(0, item.tiendas['TIENDA CALLAO-1-B']),
                    cant_almacen_callao_2: Math.max(0, item.tiendas['TIENDA CALLAO-2']),
                    abastecer_cajas: item.abastecerCajas,
                    enviar: item.enviar,
                };
            });

            await api.guardarAbastecimiento(
                {
                    nombre_abastecimiento: nombre,
                    registrado_por: registradoPor,
                    detalles,
                    password_autorizacion: undefined,
                },
                actas.length > 0 ? actas.map(a => ({ file: a.file, nombre: a.nombre })) : undefined
            );

            showToast('success', `Abastecimiento "${nombre}" guardado correctamente`);
            
            // Refrescar el historial de abastecimientos
            await refreshAbastecimiento();
            
            // Si viene desde "Descargar PDF", descargar el PDF después de guardar
            if (descargarPDFDespues) {
                const productosSI = localRows.filter(r => r.enviar === 'SI');
                if (productosSI.length > 0) {
                    const { exportToPDF } = await import('../../utils/export');
                    const datosPDF = productosSI.map(row => ({
                        codigo: row.codigo,
                        producto: row.nombre,
                        cantidad: row.cantidad,
                        unidadMedida: row.unidadMedida,
                        oficina: row.tiendas['TIENDA OFICINA'],
                        oficinaDocenas: row.tiendas['TIENDA OFICINA-DOCENAS'],
                        callao1a: row.tiendas['TIENDA CALLAO-1-A'],
                        callao1b: row.tiendas['TIENDA CALLAO-1-B'],
                        callao2: row.tiendas['TIENDA CALLAO-2'],
                        abastecerCajas: row.abastecerCajas,
                        enviar: row.enviar,
                    }));
                    const columns = [
                        { header: 'CÓDIGO', dataKey: 'codigo' },
                        { header: 'PRODUCTO', dataKey: 'producto' },
                        { header: 'CANT.', dataKey: 'cantidad' },
                        { header: 'U. MEDIDA', dataKey: 'unidadMedida' },
                        { header: 'OFICINA', dataKey: 'oficina' },
                        { header: 'OFICINA DOC.', dataKey: 'oficinaDocenas' },
                        { header: 'CALLAO 1-A', dataKey: 'callao1a' },
                        { header: 'CALLAO 1-B', dataKey: 'callao1b' },
                        { header: 'CALLAO 2', dataKey: 'callao2' },
                        { header: 'ABASTECER CAJAS', dataKey: 'abastecerCajas' },
                        { header: 'ENVIAR', dataKey: 'enviar' },
                    ];
                    const fecha = new Date().toISOString().split('T')[0];
                    exportToPDF(datosPDF, columns, `Abastecimiento_Stock_SI_${fecha}`, 'ABASTECIMIENTO CALLAO - STOCK (ENVIAR = SI)');
                    showToast('success', `PDF descargado con ${productosSI.length} producto(s)`);
                }
            }

            // Si viene desde "Generar Imagen Stock", descargar la imagen después de guardar
            if (descargarImagenDespues && capturaRef) {
                await handleDescargarImagen();
            }
            
            setNombre('');
            setRegistradoPor('');
            setActas([]);
            setPasswordAutorizacion('');
            setModalPasswordOpen(false);
            onClose();
            if (onGuardado) {
                onGuardado();
            }
        } catch (error: any) {
            console.error('Error guardando abastecimiento:', error);
            showToast('error', error.message || 'Error al guardar abastecimiento');
        } finally {
            setGuardando(false);
        }
    };

    const handleConfirmarPassword = async () => {
        if (!passwordAutorizacion.trim()) {
            showToast('error', 'Ingresa la contraseña de autorización');
            return;
        }
        setModalPasswordOpen(false);
        await ejecutarGuardado();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()} style={{ zIndex: 10001 }}>
            <div className="modal-box" style={{ maxWidth: '90vw', width: 1100, zIndex: 10002 }}>
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
                                onChange={e => setNombre(e.target.value.toUpperCase())}
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
                                onChange={e => setRegistradoPor(e.target.value.toUpperCase())}
                                className="form-input"
                                style={{ fontSize: 12 }}
                                placeholder="Nombre de quien registra"
                            />
                        </div>
                    </div>

                    {/* Botón Subir Actas */}
                    {/*
                      ACTAS opcionales en este flujo.
                      Se eliminó el botón de carga desde "Guardar Abastecimiento" y la validación de contraseña.
                    */}

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
                                    {TIENDAS_VISTA_INVENTARIO_CALLAO.map(({ tienda, etiqueta }) => (
                                        <th key={tienda} style={{ textAlign: 'center' }}>{etiqueta}</th>
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
                                            {TIENDAS_VISTA_INVENTARIO_CALLAO.map(({ tienda: t }) => (
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
                    <button onClick={onClose} className="btn btn-secondary" disabled={guardando}>
                        Cancelar
                    </button>
                    <button onClick={handleGuardar} className="btn btn-success" disabled={guardando || generandoImagen}>
                        {guardando || generandoImagen ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {generandoImagen ? 'Generando imagen...' : 'Guardando...'}
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Guardar Abastecimiento
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Modal Subir Actas */}
            {modalActasOpen && (
                <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setModalActasOpen(false)} style={{ zIndex: 10003 }}>
                    <div className="modal-box" style={{ maxWidth: '90vw', width: 900, maxHeight: '90vh', overflow: 'auto', zIndex: 10004 }}>
                        <div className="modal-header">
                            <div>
                                <h6 style={{ margin: 0, fontWeight: 700, fontSize: 16, color: '#002D5A' }}>
                                    Subir Actas de Abastecimiento
                                </h6>
                                <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>
                                    Selecciona las imágenes de las actas y asigna un nombre a cada una
                                </p>
                            </div>
                            <button onClick={() => setModalActasOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="modal-body">
                            {/* Input de archivos */}
                            <div className="mb-6">
                                <label className="block mb-2 text-sm font-semibold text-gray-700">
                                    Seleccionar Imágenes
                                </label>
                                <div className="border-2 border-dashed border-[#002D5A]/30 rounded-xl p-4 text-center hover:border-[#002D5A]/50 transition-colors bg-[#002D5A]/5">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handleFileSelect}
                                        className="hidden"
                                        id="file-input-actas"
                                    />
                                    <label
                                        htmlFor="file-input-actas"
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

                            {/* Lista de actas seleccionadas */}
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
                                                    {/* Preview de imagen */}
                                                    <div className="flex-shrink-0">
                                                        <img
                                                            src={acta.preview}
                                                            alt={`Preview ${index + 1}`}
                                                            className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                                                        />
                                                    </div>
                                                    {/* Nombre y controles */}
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
                                                                placeholder="Ej: Acta Semana 10"
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
                            <button onClick={() => setModalActasOpen(false)} className="btn btn-secondary">
                                Cancelar
                            </button>
                            <button 
                                onClick={() => setModalActasOpen(false)} 
                                className="btn btn-success"
                            >
                                Aceptar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Confirmación Contraseña */}
            {modalPasswordOpen && (
                <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setModalPasswordOpen(false)} style={{ zIndex: 10005 }}>
                    <div className="modal-box" style={{ maxWidth: '500px', width: '90vw', zIndex: 10006 }}>
                        <div className="modal-header">
                            <div>
                                <h6 style={{ margin: 0, fontWeight: 700, fontSize: 16, color: '#002D5A' }}>
                                    Confirmación Requerida
                                </h6>
                                <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>
                                    No se han adjuntado actas
                                </p>
                            </div>
                            <button onClick={() => setModalPasswordOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                                <div className="flex items-start gap-3">
                                    <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-amber-900 mb-1">
                                            Contraseña de Autorización Requerida
                                        </p>
                                        <p className="text-xs text-amber-700">
                                            Para proceder con el guardado sin actas, ingrese la contraseña de autorización.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="form-label">Contraseña de Autorización *</label>
                                <input
                                    type="password"
                                    value={passwordAutorizacion}
                                    onChange={e => setPasswordAutorizacion(e.target.value)}
                                    className="form-input"
                                    placeholder="Ingrese la contraseña"
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            handleConfirmarPassword();
                                        }
                                    }}
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
                                disabled={guardando}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmarPassword}
                                className="btn btn-success"
                                disabled={guardando || !passwordAutorizacion.trim()}
                            >
                                {guardando ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        Confirmar y Guardar
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AbastecimientoPage() {
    const { state, showToast, refreshProductos } = useCallao();
    const [search, setSearch] = useState('');
    const [filtroEnviar, setFiltroEnviar] = useState<'SI' | 'NO' | 'TODOS'>('SI');
    const [modalOpen, setModalOpen] = useState(false);
    const [rows, setRows] = useState<AbastecimientoRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalImagenOpen, setModalImagenOpen] = useState(false);
    const [generandoImagen, setGenerandoImagen] = useState(false);
    const [fechaGeneracion, setFechaGeneracion] = useState<string>('');
    const [reporteGuardado, setReporteGuardado] = useState(false);
    const [descargarPDFDespues, setDescargarPDFDespues] = useState(false);
    const [vieneDePrevisualizacion, setVieneDePrevisualizacion] = useState(false);
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
                            'TIENDA OFICINA': item.abastecer_oficina,
                            'TIENDA OFICINA-DOCENAS': 0,
                            'TIENDA CALLAO-1-A': item.abastecer_callao1,
                            'TIENDA CALLAO-1-B': 0,
                            'TIENDA CALLAO-2': item.abastecer_callao2,
                        },
                        abastecerCajas: item.abastecer_cajas,
                        enviar: item.enviar as 'SI' | 'NO',
                    };
                });
                
                setRows(rowsCalculados);
                // Resetear estado de reporte guardado cuando se recargan los datos
                setReporteGuardado(false);
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

        // Si ya se guardó el reporte después de generar imagen, solo descargar PDF
        if (reporteGuardado) {
            // Preparar datos para el PDF
            const datosPDF = productosSI.map(row => ({
                codigo: row.codigo,
                producto: row.nombre,
                cantidad: row.cantidad,
                unidadMedida: row.unidadMedida,
                oficina: row.tiendas['TIENDA OFICINA'],
                oficinaDocenas: row.tiendas['TIENDA OFICINA-DOCENAS'],
                callao1a: row.tiendas['TIENDA CALLAO-1-A'],
                callao1b: row.tiendas['TIENDA CALLAO-1-B'],
                callao2: row.tiendas['TIENDA CALLAO-2'],
                abastecerCajas: row.abastecerCajas,
                enviar: row.enviar,
            }));

            // Definir columnas para el PDF
            const columns = [
                { header: 'CÓDIGO', dataKey: 'codigo' },
                { header: 'PRODUCTO', dataKey: 'producto' },
                { header: 'CANT.', dataKey: 'cantidad' },
                { header: 'U. MEDIDA', dataKey: 'unidadMedida' },
                { header: 'OFICINA', dataKey: 'oficina' },
                { header: 'OFICINA DOC.', dataKey: 'oficinaDocenas' },
                { header: 'CALLAO 1-A', dataKey: 'callao1a' },
                { header: 'CALLAO 1-B', dataKey: 'callao1b' },
                { header: 'CALLAO 2', dataKey: 'callao2' },
                { header: 'ABASTECER CAJAS', dataKey: 'abastecerCajas' },
                { header: 'ENVIAR', dataKey: 'enviar' },
            ];

            const fecha = new Date().toISOString().split('T')[0];
            exportToPDF(datosPDF, columns, `Abastecimiento_Stock_SI_${fecha}`, 'ABASTECIMIENTO CALLAO - STOCK (ENVIAR = SI)');
            showToast('success', `PDF descargado con ${productosSI.length} producto(s)`);
        } else {
            // Si no se ha guardado, abrir modal de guardar reporte con flag para descargar PDF después
            setDescargarPDFDespues(true);
            setModalOpen(true);
        }
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
                            <div className="w-11 h-11 bg-gradient-to-br from-[#002D5A] to-[#0056b3] rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-900/10 transition-transform hover:scale-110">
                                <RefreshCw className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="font-bold text-gray-900 m-0 tracking-tight" style={{ fontSize: '18px' }}>
                                    Abastecimiento Callao
                                </h1>
                                <p className="text-[11px] text-gray-400 mt-0.5 font-medium italic opacity-80">Cálculo de reposición basado en stock mínimo de Callao</p>
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
                                    ABASTECIMIENTO CALLAO - STOCK
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
                                    {TIENDAS_VISTA_INVENTARIO_CALLAO.map(({ tienda, etiqueta }) => (
                                        <th key={`img-${tienda}`} style={{ textAlign: 'center', padding: 10, border: '1px solid #0b2b52' }}>
                                            {etiqueta}
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
                                        {TIENDAS_VISTA_INVENTARIO_CALLAO.map(({ tienda: t }) => {
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
                            <div className="p-2 bg-blue-100/60 rounded-lg">
                                <Search className="w-4 h-4 text-[#002D5A]" />
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
                            <button onClick={() => { setSearch(''); setFiltroEnviar('SI'); }} className="p-2.5 bg-[#002D5A] border border-[#002D5A] rounded-xl hover:bg-[#001f3d] transition-all shadow-sm active:scale-95">
                                <RefreshCw className="w-4 h-4 text-white" />
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
                                        <th colSpan={3} className="px-4 py-2 text-center border-b border-[#ffffff1a] bg-[#001f3d]">Abastecer por Tienda</th>
                                        <th rowSpan={2} className="px-4 py-4 border-l border-[#ffffff1a] text-center">Abastecer Cajas</th>
                                        <th rowSpan={2} className="px-4 py-4 text-center">Enviar</th>
                                    </tr>
                                    <tr className="bg-[#001f3d] text-white">
                                        {TIENDAS_VISTA_INVENTARIO_CALLAO.map(({ tienda, etiqueta }) => (
                                            <th key={tienda} className="px-2 py-3 text-center border-r border-[#ffffff1a] last:border-r-0">{etiqueta}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 font-poppins">
                                    {loading ? (
                                        <TableSkeleton rows={5} cols={9} />
                                    ) : filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="px-4 py-20 text-center">
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
                                            {TIENDAS_VISTA_INVENTARIO_CALLAO.map(({ tienda: t }) => (
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
                onClose={() => {
                    setModalOpen(false);
                    setDescargarPDFDespues(false);
                    setVieneDePrevisualizacion(false);
                }}
                rows={rows}
                descargarPDFDespues={descargarPDFDespues}
                descargarImagenDespues={vieneDePrevisualizacion}
                capturaRef={capturaRef}
                onGuardado={() => {
                    setReporteGuardado(true);
                    setDescargarPDFDespues(false);
                    setVieneDePrevisualizacion(false);
                    setModalImagenOpen(false);
                }}
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
                                            ABASTECIMIENTO CALLAO - STOCK
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
                                                {TIENDAS_VISTA_INVENTARIO_CALLAO.map(({ tienda, etiqueta }) => (
                                                    <th key={`prev-${tienda}`} style={{ textAlign: 'center', padding: 10, border: '1px solid #0b2b52' }}>
                                                        {etiqueta}
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
                                                    {TIENDAS_VISTA_INVENTARIO_CALLAO.map(({ tienda: t }) => {
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
                                onClick={() => {
                                    setVieneDePrevisualizacion(true);
                                    setModalImagenOpen(false);
                                    setDescargarPDFDespues(false);
                                    setModalOpen(true);
                                }}
                                className="btn btn-success"
                            >
                                <Save className="w-4 h-4" />
                                Guardar Reporte
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
