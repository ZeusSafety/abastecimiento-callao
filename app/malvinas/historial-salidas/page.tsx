'use client';

import React, { useState, useMemo } from 'react';
import { useMalvinas } from '../../context/MalvinasContext';
import { Search } from 'lucide-react';

export default function HistorialSalidasPage() {
    const { state } = useMalvinas();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const PER_PAGE = 20;

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return state.salidas.filter(
            s => s.producto.toLowerCase().includes(q) ||
                s.operacion.toLowerCase().includes(q) ||
                s.almacen.toLowerCase().includes(q)
        );
    }, [state.salidas, search]);

    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    return (
        <div>
            <div className="mb-5">
                <h1 style={{ fontSize: 20, fontWeight: 700, color: '#002D5A', margin: 0 }}>Historial de Salidas</h1>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Registro completo de todas las salidas</p>
            </div>

            <div className="card">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#002D5A' }}>Total: {total} registros</div>
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
                                <th>Fecha</th>
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
                                <th>Actualizado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginated.map(s => (
                                <tr key={s.id}>
                                    <td style={{ fontSize: 11 }}>{s.fecha}</td>
                                    <td>{s.producto}</td>
                                    <td><span className="badge badge-salida" style={{ fontSize: 10 }}>{s.operacion}</span></td>
                                    <td style={{ fontSize: 11 }}>{s.comprobante || '-'}</td>
                                    <td>{s.asesor || '-'}</td>
                                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{s.cantidad}</td>
                                    <td><span className="badge badge-salida" style={{ fontSize: 10 }}>{s.unidadMedida}</span></td>
                                    <td style={{ fontSize: 11 }}>{s.almacen}</td>
                                    <td>{s.entregado || '-'}</td>
                                    <td>{s.registradoPor}</td>
                                    <td style={{ fontSize: 11, color: '#6b7280' }}>{s.observaciones || '-'}</td>
                                    <td style={{ fontSize: 10, color: '#9ca3af' }}>{s.updatedAt || '-'}</td>
                                </tr>
                            ))}
                            {paginated.length === 0 && (
                                <tr>
                                    <td colSpan={12} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>
                                        No hay registros de salidas aún.
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
                            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                                const pg = Math.max(1, Math.min(page - 2, pages - 4)) + i;
                                if (pg > pages) return null;
                                return <button key={pg} className={`page-btn ${pg === page ? 'active' : ''}`} onClick={() => setPage(pg)}>{pg}</button>;
                            })}
                            <button className="page-btn" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}>›</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
