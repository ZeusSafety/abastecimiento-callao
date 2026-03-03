'use client';

import React, { useMemo, useState } from 'react';
import { useMalvinas, TIENDAS, Tienda } from '../context/MalvinasContext';
import { Search, RefreshCw, TrendingUp, Package, AlertTriangle } from 'lucide-react';

function StockBadge({ value, min }: { value: number; min: number }) {
    if (value === 0) return <span className="value-zero">0</span>;
    if (value < min) return <span className="value-negative">{value}</span>;
    return <span className="value-positive">{value}</span>;
}

export default function StockTotalPage() {
    const { state } = useMalvinas();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const PER_PAGE = 20;

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return state.productos.filter(
            p => p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)
        );
    }, [state.productos, search]);

    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

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

    return (
        <div>
            {/* Page title */}
            <div className="mb-5">
                <h1 style={{ fontSize: 20, fontWeight: 700, color: '#002D5A', margin: 0 }}>Stock Total</h1>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Vista general del inventario por tienda</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                {stats.map(s => {
                    const Icon = s.icon;
                    return (
                        <div key={s.label} className="card p-4 flex items-center gap-3">
                            <div
                                className="flex items-center justify-center rounded-xl"
                                style={{ width: 40, height: 40, background: s.bg }}
                            >
                                <Icon className="w-5 h-5" style={{ color: s.color }} />
                            </div>
                            <div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{s.label}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Table card */}
            <div className="card">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#002D5A' }}>
                        Inventario Detallado
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
                            Limpiar
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="table-container" style={{ borderRadius: 0, border: 'none' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th rowSpan={2} style={{ borderRight: '1px solid rgba(255,255,255,0.2)' }}>Código</th>
                                <th rowSpan={2} style={{ borderRight: '1px solid rgba(255,255,255,0.2)', minWidth: 200 }}>Producto</th>
                                <th rowSpan={2} style={{ borderRight: '1px solid rgba(255,255,255,0.2)', textAlign: 'center' }}>Cantidad</th>
                                <th colSpan={4} className="section-header" style={{ borderRight: '1px solid rgba(255,255,255,0.2)' }}>
                                    Stock Mínimo (Docenas/Unidades/Decenas)
                                </th>
                                <th rowSpan={2} style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Stock Global Mín.</th>
                                <th rowSpan={2} style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.2)' }}>U. Medida</th>
                                <th colSpan={4} className="section-header" style={{ borderRight: '1px solid rgba(255,255,255,0.2)' }}>
                                    Existencia en Almacén
                                </th>
                                <th rowSpan={2} style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Disponibles</th>
                                <th colSpan={3} className="section-header">Stock Detallado</th>
                            </tr>
                            <tr>
                                {TIENDAS.map(t => (
                                    <th key={`min-${t}`} style={{ background: '#1a4a7a', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.15)' }}>
                                        {t}
                                    </th>
                                ))}
                                {TIENDAS.map(t => (
                                    <th key={`ex-${t}`} style={{ background: '#1a4a7a', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.15)' }}>
                                        {t}
                                    </th>
                                ))}
                                <th style={{ background: '#1a4a7a', textAlign: 'center' }}>Cajas</th>
                                <th style={{ background: '#1a4a7a', textAlign: 'center' }}>Medida</th>
                                <th style={{ background: '#1a4a7a', textAlign: 'center' }}>U. Medida</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginated.map(p => {
                                const stockGlobalMin = TIENDAS.reduce((acc, t) => acc + p.stockMinimo[t], 0);
                                const disponibles = TIENDAS.reduce((acc, t) => acc + p.existencia[t], 0);
                                const cajas = Math.floor(disponibles / p.cantidadRegCalculo);
                                const medida = (cajas * p.cantidadRegCalculo) - disponibles;
                                return (
                                    <tr key={p.id}>
                                        <td style={{ fontWeight: 600, color: '#002D5A', fontSize: 11 }}>{p.codigo}</td>
                                        <td style={{ fontWeight: 500 }}>{p.nombre}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{p.cantidadRegCalculo}</td>
                                        {TIENDAS.map(t => (
                                            <td key={`min-${t}`} style={{ textAlign: 'center' }}>
                                                {p.stockMinimo[t] > 0 ? p.stockMinimo[t] : <span className="value-zero">-</span>}
                                            </td>
                                        ))}
                                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{stockGlobalMin}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className="badge badge-entrada">{p.unidadMedidaRegCalculo}</span>
                                        </td>
                                        {TIENDAS.map(t => (
                                            <td key={`ex-${t}`} style={{ textAlign: 'center' }}>
                                                <StockBadge value={p.existencia[t]} min={p.stockMinimo[t]} />
                                            </td>
                                        ))}
                                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{disponibles}</td>
                                        <td style={{ textAlign: 'center' }}>{cajas}</td>
                                        <td style={{ textAlign: 'center', color: medida < 0 ? '#dc2626' : '#374151' }}>{Math.abs(medida)}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span style={{ fontSize: 10, color: '#6b7280' }}>{p.unidadMedidaRegCalculo}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {paginated.length === 0 && (
                                <tr>
                                    <td colSpan={16} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>
                                        No se encontraron productos
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                    <span style={{ fontSize: 11, color: '#6b7280' }}>
                        Mostrando {Math.min((page - 1) * PER_PAGE + 1, total)}-{Math.min(page * PER_PAGE, total)} de {total} productos
                    </span>
                    <div className="flex gap-1">
                        <button className="page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
                        {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                            const pg = Math.max(1, Math.min(page - 2, pages - 4)) + i;
                            if (pg > pages) return null;
                            return (
                                <button key={pg} className={`page-btn ${pg === page ? 'active' : ''}`} onClick={() => setPage(pg)}>
                                    {pg}
                                </button>
                            );
                        })}
                        <button className="page-btn" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}>›</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
