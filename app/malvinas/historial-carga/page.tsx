'use client';

import React, { useState, useMemo } from 'react';
import { useMalvinas, TIENDAS } from '../../context/MalvinasContext';
import { Search, RefreshCw } from 'lucide-react';

export default function HistorialCargaPage() {
    const { state } = useMalvinas();
    const [selectedId, setSelectedId] = useState<string>('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const PER_PAGE = 20;

    const selectedHistorial = useMemo(
        () => state.historialAbastecimiento.find(h => h.id === selectedId),
        [state.historialAbastecimiento, selectedId]
    );

    const filtered = useMemo(() => {
        if (!selectedHistorial) return [];
        const q = search.toLowerCase();
        return selectedHistorial.items.filter(
            r => r.nombre.toLowerCase().includes(q) || r.codigo.toLowerCase().includes(q)
        );
    }, [selectedHistorial, search]);

    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    return (
        <div>
            <div className="mb-5">
                <h1 style={{ fontSize: 20, fontWeight: 700, color: '#002D5A', margin: 0 }}>
                    Historial de Abastecimiento por Carga
                </h1>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    Selecciona un abastecimiento guardado para ver su detalle
                </p>
            </div>

            {/* Selector de carga */}
            <div className="card p-4 mb-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-1">
                        <label className="form-label">Seleccionar Abastecimiento</label>
                        <select
                            value={selectedId}
                            onChange={e => { setSelectedId(e.target.value); setPage(1); setSearch(''); }}
                            className="form-input"
                            style={{ fontSize: 12 }}
                        >
                            <option value="">-- Seleccionar --</option>
                            {state.historialAbastecimiento.map(h => (
                                <option key={h.id} value={h.id}>{h.nombre}</option>
                            ))}
                        </select>
                    </div>

                    {selectedHistorial && (
                        <>
                            <div>
                                <label className="form-label">Fecha y Hora de Guardado</label>
                                <input
                                    type="text"
                                    value={selectedHistorial.fecha}
                                    readOnly
                                    className="form-input"
                                    style={{ background: '#f8fafc', color: '#374151', fontSize: 12 }}
                                />
                            </div>
                            <div>
                                <label className="form-label">Registrado Por</label>
                                <input
                                    type="text"
                                    value={selectedHistorial.registradoPor}
                                    readOnly
                                    className="form-input"
                                    style={{ background: '#f8fafc', color: '#374151', fontSize: 12 }}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>

            {selectedHistorial ? (
                <div className="card">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#002D5A' }}>
                            {selectedHistorial.nombre} — {total} productos
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar..."
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
                                {paginated.map(r => (
                                    <tr key={r.productoId}>
                                        <td style={{ fontSize: 11, fontWeight: 600, color: '#002D5A' }}>{r.codigo}</td>
                                        <td>{r.nombre}</td>
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
                                            <span className={`badge ${r.enviar === 'SI' ? 'badge-si' : 'badge-no'}`}>{r.enviar}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {total > 0 && (
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
                    )}
                </div>
            ) : (
                <div className="card p-12 text-center">
                    <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 4 }}>
                        Selecciona un abastecimiento del combo box para ver su detalle
                    </div>
                    {state.historialAbastecimiento.length === 0 && (
                        <div style={{ fontSize: 12, color: '#d1d5db', marginTop: 8 }}>
                            Aún no hay abastecimientos guardados. Ve a la sección &quot;Abastecer&quot; para crear uno.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
