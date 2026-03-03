'use client';

import React, { useState, useMemo } from 'react';
import { useMalvinas } from '../../context/MalvinasContext';
import { Search } from 'lucide-react';

export default function CambiosSalidaPage() {
    const { state } = useMalvinas();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const PER_PAGE = 20;

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return state.cambiosSalida.filter(
            c => c.producto.toLowerCase().includes(q) || c.operacion.toLowerCase().includes(q)
        );
    }, [state.cambiosSalida, search]);

    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    return (
        <div>
            <div className="mb-5">
                <h1 style={{ fontSize: 20, fontWeight: 700, color: '#002D5A', margin: 0 }}>Cambios de Salida</h1>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Historial de todos los registros de salidas que fueron modificados</p>
            </div>

            <div className="card">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#002D5A' }}>Cambios registrados: {total}</div>
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
                </div>

                <div className="table-container" style={{ borderRadius: 0, border: 'none' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Fecha Original</th>
                                <th>Producto</th>
                                <th>Operación</th>
                                <th>Comprobante</th>
                                <th>Asesor</th>
                                <th style={{ textAlign: 'center' }}>Cantidad</th>
                                <th>Unidad Medida</th>
                                <th>Almacén</th>
                                <th>Entregado Por</th>
                                <th>Registrado Por</th>
                                <th>Observaciones</th>
                                <th>Motivo</th>
                                <th>Fecha Cambio</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginated.map((c, i) => (
                                <tr key={`${c.id}-${i}`}>
                                    <td style={{ fontSize: 11 }}>{c.fecha}</td>
                                    <td>{c.producto}</td>
                                    <td><span className="badge badge-salida" style={{ fontSize: 10 }}>{c.operacion}</span></td>
                                    <td style={{ fontSize: 11 }}>{c.comprobante || '-'}</td>
                                    <td>{c.asesor || '-'}</td>
                                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{c.cantidad}</td>
                                    <td><span className="badge badge-salida" style={{ fontSize: 10 }}>{c.unidadMedida}</span></td>
                                    <td style={{ fontSize: 11 }}>{c.almacen}</td>
                                    <td>{c.entregado || '-'}</td>
                                    <td>{c.registradoPor}</td>
                                    <td style={{ fontSize: 11, color: '#6b7280' }}>{c.observaciones || '-'}</td>
                                    <td style={{ fontSize: 11, color: '#92400e', fontStyle: 'italic' }}>{c.motivoCambio}</td>
                                    <td style={{ fontSize: 10, color: '#9ca3af' }}>{c.updatedAt}</td>
                                </tr>
                            ))}
                            {paginated.length === 0 && (
                                <tr>
                                    <td colSpan={13} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>
                                        No hay cambios registrados aún.
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
