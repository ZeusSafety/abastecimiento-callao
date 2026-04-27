/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { FileImage, Eye, ChevronDown, ChevronRight, X, Calendar, Clock3 } from 'lucide-react';
import * as api from '../../services/api';

import { PackageMinus, FileDown } from 'lucide-react';

import type { SalidaCascadaDB, ActaMovimientoDB, SalidaDetalleCascadaDB } from '../../services/api';
import { getOperacionColor } from '../../context/CallaoContext';

// ─── Función para formatear fecha y hora ─────────────────────────────────────
function formatFechaDosLineas(fechaStr: string): { fecha: string; hora: string } {
  if (!fechaStr) return { fecha: '-', hora: '' };

  try {
    let fecha: Date;
    if (fechaStr.includes('/')) {
      const parts = fechaStr.split(' ');
      const fechaPart = parts[0];
      const horaPart = parts.slice(1).join(' ');
      const [dia, mes, anio] = fechaPart.split('/');
      fecha = new Date(`${anio}-${mes}-${dia} ${horaPart}`);
    } else {
      fecha = new Date(fechaStr);
    }

    if (isNaN(fecha.getTime())) {
      return { fecha: fechaStr, hora: '' };
    }

    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const anio = fecha.getFullYear();
    const fechaFormateada = `${dia}/${mes}/${anio}`;

    let horas = fecha.getHours();
    const minutos = fecha.getMinutes().toString().padStart(2, '0');
    const periodo = horas >= 12 ? 'p. m.' : 'a. m.';
    horas = horas % 12 || 12;
    const horaFormateada = `${horas}:${minutos} ${periodo}`;

    return { fecha: fechaFormateada, hora: horaFormateada };
  } catch {
    return { fecha: fechaStr, hora: '' };
  }
}

function ModalObservaciones({
  isOpen,
  onClose,
  observaciones,
}: {
  isOpen: boolean;
  onClose: () => void;
  observaciones: string;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col z-[10000]">
        <div className="bg-gradient-to-r from-[#002D5A] to-[#003d7a] px-6 py-4 flex items-center justify-between">
          <h2 className="text-white font-black text-lg uppercase tracking-wider">Observaciones</h2>
          <button onClick={onClose} className="text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <div className="text-gray-700 text-sm whitespace-pre-wrap" style={{ fontFamily: 'var(--font-poppins)' }}>
            {observaciones || 'Sin observaciones'}
          </div>
        </div>
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-[#002D5A] text-white rounded-lg font-semibold hover:bg-[#003d7a] transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function formatActaFecha(acta: ActaMovimientoDB): string {
  if (!acta.fecha_subida) return '-';
  try {
    return new Date(acta.fecha_subida).toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

export default function CascadaMovimientosSalidas({
  search,
  page,
  setPage,
  PER_PAGE = 15,
  refreshKey = 0,
}: {
  search: string;
  page: number;
  setPage: (n: number | ((p: number) => number)) => void;
  PER_PAGE?: number;
  refreshKey?: number;
}) {
  const [cargas, setCargas] = useState<SalidaCascadaDB[]>([]);
  const [loadingCargas, setLoadingCargas] = useState(true);
  const [expandedCodigos, setExpandedCodigos] = useState<Set<string>>(new Set());

  // ─── Actas view ──────────────────────────────────────────────────────────
  const [modalVerActasOpen, setModalVerActasOpen] = useState(false);
  const [actasSeleccionadas, setActasSeleccionadas] = useState<ActaMovimientoDB[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // ─── Observaciones view ─────────────────────────────────────────────────
  const [modalObsOpen, setModalObsOpen] = useState(false);
  const [observacionesSeleccionadas, setObservacionesSeleccionadas] = useState<string>('');

  const refreshCargas = async () => {
    setLoadingCargas(true);
    try {
      const data = await api.getSalidasCascada();
      setCargas(data);
    } catch (error: any) {
      console.error('Error cargando salidas en cascada:', error);
      setCargas([]);
    } finally {
      setLoadingCargas(false);
    }
  };

  useEffect(() => {
    refreshCargas();
  }, [refreshKey]);

  const filteredCargas = useMemo(() => {
    const q = search.toLowerCase();
    if (!q.trim()) return cargas;

    return cargas.filter(c => {
      const baseMatch =
        (c.codigo_carga || '').toLowerCase().includes(q) ||
        (c.asesor || '').toLowerCase().includes(q) ||
        (c.fecha_primera || '').toLowerCase().includes(q);

      const detailMatch = c.detalles.some(d => {
        return (
          (d.producto_nombre || '').toLowerCase().includes(q) ||
          (d.operacion || '').toLowerCase().includes(q) ||
          (d.tienda_codigo || '').toLowerCase().includes(q) ||
          (d.asesor || '').toLowerCase().includes(q) ||
          (d.nro_comprobante || '').toLowerCase().includes(q)
        );
      });

      return baseMatch || detailMatch;
    });
  }, [cargas, search]);

  const totalCargas = filteredCargas.length;
  const pagesCargas = Math.max(1, Math.ceil(totalCargas / PER_PAGE));
  const paginatedCargas = filteredCargas.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  useEffect(() => {
    const keys = paginatedCargas.map((carga, idx) => `${carga.codigo_carga || 'sin-codigo'}-${idx}`);
    setExpandedCodigos(prev => {
      if (prev.size === keys.length && keys.every(k => prev.has(k))) return prev;
      return new Set(keys);
    });
  }, [paginatedCargas]);

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xl">
        <div className="divide-y divide-gray-100">
          {loadingCargas ? (
            <div className="p-10 text-center text-gray-500">Cargando datos en cascada...</div>
          ) : totalCargas === 0 ? (
            <div className="p-10 text-center text-gray-500">
              {search ? 'No se encontraron cargas con ese criterio' : 'No hay movimientos en cascada aún.'}
            </div>
          ) : (
            paginatedCargas.map((carga, idx) => {
              const detalleRep: SalidaDetalleCascadaDB | undefined = carga.detalles[0];
              const cargaKey = `${carga.codigo_carga || 'sin-codigo'}-${idx}`;
              const isOpen = expandedCodigos.has(cargaKey);
              const { fecha, hora } = formatFechaDosLineas(carga.fecha_primera);
              // Contador de "productos agregados" = cantidad de renglones en el detalle.
              const itemsTotales = carga.detalles.length;

              const operacion = detalleRep?.operacion || '';
              const registrador = detalleRep?.registrado_por || '-';
              const operador = detalleRep?.asesor || carga.asesor || '-';

              return (
                <div key={cargaKey} className="px-4">
                  <div
                    className="py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() =>
                      setExpandedCodigos(prev => {
                        const next = new Set(prev);
                        if (next.has(cargaKey)) next.delete(cargaKey);
                        else next.add(cargaKey);
                        return next;
                      })
                    }
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-[#002D5A] flex items-center justify-center text-white">
                        {isOpen ? <ChevronDown className="w-4 h-4 text-white" /> : <ChevronRight className="w-4 h-4 text-white" />}
                      </div>

                      <div className="flex items-center gap-3 flex-wrap text-[11px] font-semibold text-gray-900">
                        <span className="inline-flex items-center gap-2 whitespace-nowrap">
                          <Calendar className="w-3.5 h-3.5 text-[#002D5A]" />
                          <span className="text-[10px] text-gray-500 uppercase tracking-widest">Fecha</span>
                          <span>{fecha}</span>
                        </span>
                        <span className="hidden sm:block w-px h-4 bg-gray-300" />
                        <span className="inline-flex items-center gap-2 whitespace-nowrap">
                          <Clock3 className="w-3.5 h-3.5 text-[#002D5A]" />
                          <span className="text-[10px] text-gray-500 uppercase tracking-widest">Hora</span>
                          <span>{hora || '-'}</span>
                        </span>

                        {/* Operación ya se muestra en la tabla interna */}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-[10px] text-gray-600 whitespace-nowrap flex-shrink-0">
                      <span className="inline-flex items-center gap-2">
                        <PackageMinus className="w-4 h-4 text-[#002D5A]" />
                        <span>
                          <span className="font-bold text-gray-900">{itemsTotales}</span> productos
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <FileImage className="w-4 h-4 text-[#002D5A]" />
                        <span>
                          <span className="font-bold text-gray-900">{carga.actas.length}</span> actas
                        </span>
                      </span>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="pb-5">
                      <div className="bg-white rounded-2xl border border-gray-100 p-4">
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                              <div className="w-full sm:w-[180px]">
                                <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">REGISTRADOR</div>
                                <div className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-[11px] font-bold text-gray-900">
                                  {registrador}
                                </div>
                              </div>
                              <div className="w-full sm:w-[180px]">
                                <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">ASESOR/OPERADOR</div>
                                <div className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-[11px] font-bold text-gray-900">
                                  {operador}
                                </div>
                              </div>
                            </div>

                          <div className="flex items-center gap-4 mt-1">
                            <div className="text-[10px] text-gray-500 whitespace-nowrap">
                              Actas:{' '}
                              <span className="text-gray-900 font-bold">{carga.actas.length}</span>
                            </div>
                            <button
                              onClick={() => {
                                setActasSeleccionadas(carga.actas);
                                setModalVerActasOpen(true);
                              }}
                              disabled={carga.actas.length === 0}
                              className="shrink-0 px-4 py-2 text-[10px] rounded-xl font-bold bg-[#002D5A] hover:bg-[#001f3d] text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <span>Ver Actas</span>
                            </button>
                          </div>
                        </div>

                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-[#002D5A] text-white">
                                <tr className="text-[9px] uppercase">
                                  <th className="px-4 py-3 text-left font-bold">PRODUCTO</th>
                                  <th className="px-4 py-3 text-left font-bold w-[160px]">OPERACIÓN</th>
                                  <th className="px-4 py-3 text-left font-bold w-[90px]">CANT.</th>
                                  <th className="px-4 py-3 text-left font-bold w-[120px]">U. MEDIDA</th>
                                  <th className="px-4 py-3 text-left font-bold w-[120px]">ALMACÉN</th>
                                  <th className="px-4 py-3 text-left font-bold w-[140px]">N° COMPROBANTE</th>
                                  <th className="px-4 py-3 text-left font-bold w-[100px]">OBS.</th>
                                </tr>
                              </thead>
                              <tbody>
                                {carga.detalles.map(d => (
                                  <tr
                                    key={d.id}
                                    className="border-t border-gray-100 text-[11px] hover:bg-blue-50/30 transition-colors"
                                  >
                                    <td className="px-4 py-3 text-gray-800 font-medium">{d.producto_nombre}</td>
                                    <td className="px-4 py-3">
                                      {(() => {
                                        const op = d.operacion || operacion || '-';
                                        const color = getOperacionColor(op);
                                        return (
                                          <span
                                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${color.bg} ${color.text}`}
                                          >
                                            {op}
                                          </span>
                                        );
                                      })()}
                                    </td>
                                    <td className="px-4 py-3 text-gray-700 font-semibold">{d.cantidad}</td>
                                    <td className="px-4 py-3 text-gray-600">{d.unidad_medida}</td>
                                    <td className="px-4 py-3 text-gray-700">{d.tienda_codigo}</td>
                                    <td className="px-4 py-3 text-gray-700">{d.nro_comprobante || '-'}</td>
                                    <td className="px-4 py-3">
                                      {(() => {
                                        const obs = d.observaciones || '';
                                        const tieneObs = obs.trim().length > 0;
                                        return (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setObservacionesSeleccionadas(obs || '-');
                                              setModalObsOpen(true);
                                            }}
                                            className={`inline-flex items-center justify-center w-[46px] h-[28px] rounded-lg transition-colors ${
                                              tieneObs
                                                ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                            }`}
                                            title="Ver observaciones"
                                          >
                                            <Eye className="w-4 h-4" />
                                          </button>
                                        );
                                      })()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pagination cascadas */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 flex items-center justify-between border-t border-gray-100">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              «
            </button>
            <button
              onClick={() => setPage((p: number) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              ‹
            </button>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[11px] text-gray-700 font-bold uppercase tracking-widest">
              Página {page} de {pagesCargas}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p: number) => Math.min(pagesCargas, p + 1))}
              disabled={page === pagesCargas}
              className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              ›
            </button>
            <button
              onClick={() => setPage(pagesCargas)}
              disabled={page === pagesCargas}
              className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              »
            </button>
          </div>
        </div>
      </div>

      {/* Modal Observaciones */}
      <ModalObservaciones
        isOpen={modalObsOpen}
        onClose={() => setModalObsOpen(false)}
        observaciones={observacionesSeleccionadas}
      />

      {/* Modal Ver Actas */}
      {modalVerActasOpen && (
        <div
          className="modal-backdrop animate-in fade-in duration-200"
          style={{ zIndex: 30001 }}
          onClick={e => e.target === e.currentTarget && setModalVerActasOpen(false)}
        >
          <div className="modal-box" style={{ maxWidth: 1100, width: '95vw', maxHeight: '90vh', overflow: 'auto', zIndex: 30002 }}>
            <div className="modal-header">
              <div>
                <h6 style={{ margin: 0, fontWeight: 800, fontSize: 16, color: '#002D5A' }}>Actas de Salida</h6>
                <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>
                  {actasSeleccionadas.length} acta(s) seleccionada(s)
                </p>
              </div>
              <button
                onClick={() => {
                  setModalVerActasOpen(false);
                  setLightboxUrl(null);
                }}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="modal-body">
              {actasSeleccionadas.length === 0 ? (
                <div className="py-12 flex flex-col items-center text-center">
                  <FileImage className="w-12 h-12 text-gray-300 mb-4" />
                  <p className="text-gray-600 font-semibold">No hay actas para esta carga</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {actasSeleccionadas.map(acta => (
                    <div
                      key={acta.id}
                      className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setLightboxUrl(acta.url_imagen)}
                    >
                      <div className="relative aspect-video bg-gray-100">
                        <img
                          src={acta.url_imagen}
                          alt={acta.nombre_imagen}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23e5e7eb" width="400" height="300"/%3E%3Ctext fill="%239ca3af" font-family="sans-serif" font-size="18" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImagen no disponible%3C/text%3E%3C/svg%3E';
                          }}
                        />
                      </div>
                      <div className="p-3">
                        <div className="text-[11px] font-bold text-gray-900 line-clamp-2">{acta.nombre_imagen}</div>
                        <div className="text-[9px] text-gray-500 mt-1">Fecha: {formatActaFecha(acta)}</div>
                        <div className="text-[9px] text-gray-500 mt-1">
                          Registrado por: <span className="font-semibold">{acta.registrado_por || '-'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="modal-backdrop animate-in fade-in duration-300"
          style={{ zIndex: 30003 }}
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-4 right-4 p-2 bg-white/90 hover:bg-white rounded-full transition-colors z-10 shadow"
            >
              <X className="w-6 h-6 text-gray-700" />
            </button>
            <img
              src={lightboxUrl}
              alt="Acta completa"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23e5e7eb" width="400" height="300"/%3E%3Ctext fill="%239ca3af" font-family="sans-serif" font-size="18" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImagen no disponible%3C/text%3E%3C/svg%3E';
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

