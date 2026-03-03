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
        <div>
            <div className="mb-5 flex items-center justify-between">
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: '#002D5A', margin: 0 }}>Abastecimiento</h1>
                    <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                        Calcula automáticamente qué productos necesitan reposición
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {paraSI > 0 && (
                        <div
                            className="px-3 py-1.5 rounded-full text-xs font-bold"
                            style={{ background: '#fef3c7', color: '#92400e', fontSize: 11 }}
                        >
                            {paraSI} productos para enviar
                        </div>
                    )}
                    <button onClick={() => setModalOpen(true)} className="btn btn-success">
                        <Save className="w-4 h-4" />
                        Guardar Abastecimiento
                    </button>
                </div>
            </div>

            <div className="card">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#002D5A' }}>
                        Listado de Abastecimiento
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar producto..."
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1); }}
                                className="form-input pl-8"
                                style={{ width: 200, padding: '6px 10px 6px 28px', fontSize: 12 }}
                            />
                        </div>
                        <button onClick={() => setSearch('')} className="btn btn-secondary btn-sm">
                            <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                <div className="table-container" style={{ borderRadius: 0, border: 'none' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th rowSpan={2}>Código</th>
                                <th rowSpan={2} style={{ minWidth: 200 }}>Nombre</th>
                                <th rowSpan={2} style={{ textAlign: 'center' }}>Cantidad</th>
                                <th rowSpan={2}>U. Medida</th>
                                <th colSpan={4} className="section-header">Abastecer</th>
                                <th rowSpan={2} style={{ textAlign: 'center' }}>Abastecer Cajas</th>
                                <th rowSpan={2} style={{ textAlign: 'center' }}>Enviar</th>
                            </tr>
                            <tr>
                                {TIENDAS.map(t => (
                                    <th key={t} style={{ background: '#1a4a7a', textAlign: 'center' }}>{t}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {paginated.map(r => (
                                <tr key={r.productoId}>
                                    <td style={{ fontSize: 11, fontWeight: 600, color: '#002D5A' }}>{r.codigo}</td>
                                    <td style={{ fontWeight: 500 }}>{r.nombre}</td>
                                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.cantidad}</td>
                                    <td>
                                        <span className="badge badge-entrada" style={{ fontSize: 10 }}>{r.unidadMedida}</span>
                                    </td>
                                    {TIENDAS.map(t => (
                                        <td key={t} style={{ textAlign: 'center' }}>
                                            {r.tiendas[t] === 0 ? (
                                                <span className="value-zero">0</span>
                                            ) : r.tiendas[t] < 0 ? (
                                                <span className="value-negative">{r.tiendas[t]}</span>
                                            ) : (
                                                <span className="value-positive">{r.tiendas[t]}</span>
                                            )}
                                        </td>
                                    ))}
                                    <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 14 }}>
                                        {r.abastecerCajas > 0 ? (
                                            <span style={{ color: '#059669' }}>{r.abastecerCajas}</span>
                                        ) : (
                                            <span className="value-zero">0</span>
                                        )}
                                    </td>
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

                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                    <span style={{ fontSize: 11, color: '#6b7280' }}>
                        Mostrando {Math.min((page - 1) * PER_PAGE + 1, total)}-{Math.min(page * PER_PAGE, total)} de {total}
                    </span>
                    <div className="flex gap-1">
                        <button className="page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
                        {Array.from({ length: Math.min(5, pages) }, (_, i) => { const pg = Math.max(1, Math.min(page - 2, pages - 4)) + i; if (pg > pages) return null; return <button key={pg} className={`page-btn ${pg === page ? 'active' : ''}`} onClick={() => setPage(pg)}>{pg}</button>; })}
                        <button className="page-btn" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}>›</button>
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
