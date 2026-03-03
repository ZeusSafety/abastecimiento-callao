'use client';

import React, { useState, useMemo } from 'react';
import { useMalvinas, TIENDAS } from '../../context/MalvinasContext';
import { Search } from 'lucide-react';

export default function HistorialGeneralPage() {
    const { state } = useMalvinas();
    const [search, setSearch] = useState('');
    const [filterName, setFilterName] = useState('');
    const [page, setPage] = useState(1);
    const PER_PAGE = 20;

    // Flatten all items from all historial entries
    const allRows = useMemo(() => {
        return state.historialAbastecimiento.flatMap(h =>
            h.items.map(item => ({
                ...item,
                nombreAbastecimiento: h.nombre,
                fechaHora: h.fecha,
                registradoPor: h.registradoPor,
            }))
        );
    }, [state.historialAbastecimiento]);

    const nombres = useMemo(() => {
        return Array.from(new Set(state.historialAbastecimiento.map(h => h.nombre)));
    }, [state.historialAbastecimiento]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return allRows.filter(r => {
            const matchName = filterName ? r.nombreAbastecimiento === filterName : true;
            const matchSearch = r.nombre.toLowerCase().includes(q) || r.codigo.toLowerCase().includes(q);
            return matchName && matchSearch;
        });
    }, [allRows, search, filterName]);

    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    return (
        <div>
            <div className="mb-5">
                <h1 style={{ fontSize: 20, fontWeight: 700, color: '#002D5A', margin: 0 }}>
                    Historial General de Abastecimiento
                </h1>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    Todos los registros de todos los abastecimientos
                </p>
            </div>

            <div className="card">
                <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-3 border-b border-gray-100">
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#002D5A' }}>
                        Total de registros: {total}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Filtro por nombre de abastecimiento */}
                        <select
                            value={filterName}
                            onChange={e => { setFilterName(e.target.value); setPage(1); }}
                            className="form-input"
                            style={{ width: 200, fontSize: 12, padding: '6px 10px' }}
                        >
                            <option value="">Todos los abastecimientos</option>
                            {nombres.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>

                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar producto..."
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1); }}
                                className="form-input pl-8"
                                style={{ width: 180, padding: '6px 10px 6px 28px', fontSize: 12 }}
                            />
                        </div>
                    </div>
                </div>

                <div className="table-container" style={{ borderRadius: 0, border: 'none' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th style={{ minWidth: 180 }}>Nombre</th>
                                <th style={{ textAlign: 'center' }}>Cantidad</th>
                                <th>U. Medida</th>
                                {TIENDAS.map(t => (
                                    <th key={t} style={{ textAlign: 'center' }}>{t}</th>
                                ))}
                                <th style={{ textAlign: 'center' }}>Abastecer Cajas</th>
                                <th style={{ textAlign: 'center' }}>Enviar</th>
                                <th>Nombre Abastecimiento</th>
                                <th>Fecha y Hora</th>
                                <th>Registrado Por</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginated.map((r, i) => (
                                <tr key={`${r.productoId}-${i}`}>
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
                                    <td style={{ fontSize: 11, fontWeight: 600, color: '#002D5A' }}>
                                        {r.nombreAbastecimiento}
                                    </td>
                                    <td style={{ fontSize: 11 }}>{r.fechaHora}</td>
                                    <td>{r.registradoPor}</td>
                                </tr>
                            ))}
                            {paginated.length === 0 && (
                                <tr>
                                    <td colSpan={14} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>
                                        No hay registros de abastecimiento aún.
                                    </td>
                                </tr>
                            )}
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
        </div>
    );
}
