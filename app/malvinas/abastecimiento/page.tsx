'use client';

import React, { useState, useMemo } from 'react';
import {
    useMalvinas,
    TIENDAS,
    Tienda,
    AbastecimientoRow,
} from '../../context/MalvinasContext';
import { Save, Eraser, X, Search, RefreshCw } from 'lucide-react';

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

    const handleGuardar = () => {
        if (!nombre.trim()) { showToast('error', 'Ingresa un nombre para el abastecimiento'); return; }
        if (!registradoPor.trim()) { showToast('error', 'Ingresa el nombre de quien registra'); return; }
        guardarAbastecimiento(nombre, registradoPor, localRows);
        showToast('success', `Abastecimiento "${nombre}" guardado correctamente`);
        onClose();
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
                                {localRows.map(r => (
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
                                            <span className={`badge ${r.enviar === 'SI' ? 'badge-si' : 'badge-no'}`}>
                                                {r.enviar}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
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
    const { state, showToast } = useMalvinas();
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [page, setPage] = useState(1);
    const PER_PAGE = 20;

    const rows = useMemo<AbastecimientoRow[]>(() => {
        return state.productos.map(p => {
            const tiendas = Object.fromEntries(
                TIENDAS.map(t => [t, p.stockMinimo[t] - p.existencia[t]])
            ) as Record<Tienda, number>;

            const totalAbastecer = TIENDAS.reduce((acc, t) => acc + Math.max(0, tiendas[t]), 0);
            const abastecerCajas = Math.floor(totalAbastecer / p.cantidadRegCalculo);
            const enviar: 'SI' | 'NO' = abastecerCajas > 0 ? 'SI' : 'NO';

            return {
                productoId: p.id,
                codigo: p.codigo,
                nombre: p.nombre,
                cantidad: p.cantidadRegCalculo,
                unidadMedida: p.unidadMedidaRegCalculo,
                tiendas,
                abastecerCajas,
                enviar,
            };
        });
    }, [state.productos]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return rows.filter(r =>
            r.nombre.toLowerCase().includes(q) || r.codigo.toLowerCase().includes(q)
        );
    }, [rows, search]);

    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    const paraSI = rows.filter(r => r.enviar === 'SI').length;

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
                                onClick={() => setModalOpen(true)}
                                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl font-bold transition-all duration-300 shadow-md text-[10px] bg-[#059669] hover:bg-[#047857] text-white hover:shadow-lg hover:-translate-y-0.5 active:scale-95 border-b-2 border-black/20"
                            >
                                <Save className="w-3.5 h-3.5 stroke-[3px]" />
                                <span>GUARDAR REPORTE</span>
                            </button>
                        </div>
                    </header>

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
                                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-[#059669] outline-none transition-all shadow-sm"
                                />
                            </div>
                            <button onClick={() => setSearch('')} className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all shadow-sm active:scale-95">
                                <RefreshCw className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>
                    </div>

                    {/* Table card */}
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xl">

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="text-[10px] uppercase font-bold tracking-wider">
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
                                    {paginated.map(r => (
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
                                                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest ${r.enviar === 'SI' ? 'bg-emerald-100 text-emerald-700 shadow-sm' : 'bg-gray-100 text-gray-400 opacity-50'
                                                    }`}>
                                                    {r.enviar}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 flex items-center justify-between border-t border-gray-200">
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
                                    Página {page} de {pages}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.min(pages, p + 1))}
                                    disabled={page === pages}
                                    className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                    style={{ fontFamily: 'var(--font-poppins)' }}
                                >
                                    ›
                                </button>
                                <button
                                    onClick={() => setPage(pages)}
                                    disabled={page === pages}
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

            <ModalGuardar
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                rows={rows}
            />
        </div>
    );
}
