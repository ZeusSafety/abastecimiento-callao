'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import * as api from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────
export type UnidadMedida = 'DOCENAS' | 'DECENAS' | 'UNIDADES' | 'CAJITAS' | 'BOLSITAS';
/** Códigos en BD:OFICINA, OFICINA-DOCENAS, CALLAO 1-A, CALLAO 1-B, CALLAO 2. (`tiendas_gestion_sea_callao`). */
export type Tienda = 'TIENDA OFICINA' | 'TIENDA OFICINA-DOCENAS' | 'TIENDA CALLAO-1-A' | 'TIENDA CALLAO-1-B' | 'TIENDA CALLAO-2';
/** Incluye `ALMACEN CALLAO` solo por compatibilidad con histórico (API CALLAO). */
export type AlmacenCompleto = 'IMPORTACION' | 'ALMACEN MALVINAS' | Tienda;

export const TIENDAS: Tienda[] = ['TIENDA OFICINA', 'TIENDA OFICINA-DOCENAS', 'TIENDA CALLAO-1-A', 'TIENDA CALLAO-1-B', 'TIENDA CALLAO-2'];

/** Tiendas mostradas en la tabla Abastecimiento Callao (5 columnas: Stock mínimo y Existencia). */
export const TIENDAS_VISTA_INVENTARIO_CALLAO: ReadonlyArray<{ tienda: Tienda; etiqueta: string }> = [
  { tienda: 'TIENDA OFICINA', etiqueta: 'Oficina' },
  { tienda: 'TIENDA OFICINA-DOCENAS', etiqueta: 'Oficina-Docenas' },
  { tienda: 'TIENDA CALLAO-1-A', etiqueta: 'Callao 1-A' },
  { tienda: 'TIENDA CALLAO-1-B', etiqueta: 'Callao 1-B' },
  { tienda: 'TIENDA CALLAO-2', etiqueta: 'Callao 2' },
];

/** Destino (entrada) y almacén (salida) en modales: OFICINA, OFICINA-DOCENAS, CALLAO 1-A, CALLAO 1-B, CALLAO 2. */
export const TIENDAS_ETIQUETA_MOVIMIENTOS_CALLAO: ReadonlyArray<{ tienda: Tienda; label: string }> = [
  { tienda: 'TIENDA OFICINA', label: 'OFICINA' },
  { tienda: 'TIENDA OFICINA-DOCENAS', label: 'OFICINA-DOCENAS' },
  { tienda: 'TIENDA CALLAO-1-A', label: 'CALLAO 1-A' },
  { tienda: 'TIENDA CALLAO-1-B', label: 'CALLAO 1-B' },
  { tienda: 'TIENDA CALLAO-2', label: 'CALLAO 2' },
];

export function etiquetaTiendaMovimientosCallao(t: Tienda): string {
  return TIENDAS_ETIQUETA_MOVIMIENTOS_CALLAO.find(x => x.tienda === t)?.label ?? t;
}

/** Origen en "Registrar entrada": MALVINAS, OFICINA, CALLAO-1, CALLAO-2 (API). */
export const ORIGENES_ALMACEN_SALIDA_ENTRADA_CALLAO: ReadonlyArray<{ value: AlmacenCompleto; label: string }> = [
  { value: 'ALMACEN MALVINAS', label: 'ALMACEN MALVINAS' },
  { value: 'TIENDA OFICINA', label: 'OFICINA' },
  { value: 'TIENDA OFICINA-DOCENAS', label: 'OFICINA-DOCENAS' },
  { value: 'TIENDA CALLAO-1-A', label: 'CALLAO 1-A' },
  { value: 'TIENDA CALLAO-1-B', label: 'CALLAO 1-B' },
  { value: 'TIENDA CALLAO-2', label: 'CALLAO 2' },
];

export function etiquetaOrigenAlmacenSalidaEntrada(a: AlmacenCompleto): string {
  const row = ORIGENES_ALMACEN_SALIDA_ENTRADA_CALLAO.find(o => o.value === a);
  if (row) return row.label;
  if (a === 'IMPORTACION') return 'IMPORTACION';
  return a;
}

export const OPERADORES = ['MANUEL', 'VICTOR', 'JOSE', 'JHONSON', 'LEONEL', 'EDRAS', 'HERVIN', 'ALVARO'];
export const REGISTRADORES = ['MANUEL', 'JOSE', 'LEONEL', 'EDRAS', 'HERVIN', 'VICTOR', 'ALVARO', 'JHONSON'];

/** Valor interno del `<select>` para "otra persona" (texto libre). */
export const COMBO_OTROS_VALUE = '__OTROS__';

export function resolvePersonaCombo(val: string, otro: string): string {
  if (val === COMBO_OTROS_VALUE) return (otro || '').trim();
  return val;
}
export const UNIDADES: UnidadMedida[] = ['DOCENAS', 'DECENAS', 'UNIDADES', 'CAJITAS', 'BOLSITAS'];
export const OPS_ENTRADA = ['ENTRADA', 'OTROS'] as const;
export const OPS_SALIDA = ['SALIDA', 'VENTA', 'OTROS'] as const;
export const OPS_TRASLADOS = ['TRASLADO', 'OTROS'] as const;

// ─── Función para obtener colores de operaciones ──────────────────────────────
export function getOperacionColor(operacion: string): { bg: string; text: string } {
    const op = operacion.toUpperCase();
    switch (op) {
        case 'TRASLADO':
            return { bg: 'bg-blue-50', text: 'text-blue-700' };
        case 'VENTA':
            return { bg: 'bg-red-50', text: 'text-red-700' };
        case 'ENTRADA':
            return { bg: 'bg-green-50', text: 'text-green-700' };
        case 'SALIDA':
            return { bg: 'bg-cyan-50', text: 'text-cyan-700' };
        case 'OTROS':
            return { bg: 'bg-gray-50', text: 'text-gray-700' };
        default:
            return { bg: 'bg-gray-50', text: 'text-gray-700' };
    }
}

// ─── Mapeo de Unidades de Medida ──────────────────────────────────────────────
const UNIDAD_MEDIDA_MAP: Record<number, UnidadMedida> = {
  1: 'DOCENAS',
  2: 'DECENAS',
  3: 'UNIDADES',
  4: 'CAJITAS',
  5: 'BOLSITAS',
};

const UNIDAD_MEDIDA_REVERSE_MAP: Record<UnidadMedida, number> = {
  'DOCENAS': 1,
  'DECENAS': 2,
  'UNIDADES': 3,
  'CAJITAS': 4,
  'BOLSITAS': 5,
};

// ─── Mapeo de Tiendas ────────────────────────────────────────────────────────
function getTiendaFromCodigo(codigo: string): Tienda | null {
  const map: Record<string, Tienda> = {
    'OFICINA': 'TIENDA OFICINA',
    'OFICINA-DOCENAS': 'TIENDA OFICINA-DOCENAS',
    'CALLAO-1-A': 'TIENDA CALLAO-1-A',
    'CALLAO-1-B': 'TIENDA CALLAO-1-B',
    'CALLAO-2': 'TIENDA CALLAO-2',
  };
  return map[codigo] || null;
}

export function getCodigoFromTienda(tienda: Tienda): string {
  const map: Record<Tienda, string> = {
    'TIENDA OFICINA': 'OFICINA',
    'TIENDA OFICINA-DOCENAS': 'OFICINA-DOCENAS',
    'TIENDA CALLAO-1-A': 'CALLAO-1-A',
    'TIENDA CALLAO-1-B': 'CALLAO-1-B',
    'TIENDA CALLAO-2': 'CALLAO-2',
  };
  return map[tienda];
}

export function getCodigoAlmacenSalidaEntrada(a: AlmacenCompleto): string {
  if (a === 'IMPORTACION') return 'IMPORTACION';
  if (a === 'ALMACEN MALVINAS') return 'MALVINAS';
  return getCodigoFromTienda(a as Tienda);
}

export function resolveAlmacenSalidaEntradaDesdeApi(codigo: string, nombre: string | null | undefined): AlmacenCompleto {
  const c = (codigo || '').trim().toUpperCase();
  if (c === 'MALVINAS') return 'ALMACEN MALVINAS';
  if (c === 'IMPORTACION') return 'ALMACEN MALVINAS';
  const t = getTiendaFromCodigo(c);
  if (t) return t;
  const nom = nombre || '';
  if (TIENDAS.includes(nom as Tienda)) return nom as Tienda;
  const nu = nom.toUpperCase();
  if (nu.includes('MALVINAS')) return 'ALMACEN MALVINAS';
  return 'ALMACEN MALVINAS';
}

export interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  // Info
  cantidadEnCaja: number;
  unidadMedida: UnidadMedida;
  cantidadUnidadesCaja: number;
  // Reg Calculo
  cantidadRegCalculo: number;
  unidadMedidaRegCalculo: UnidadMedida;
  /** id `unidades_medida_sea_callao` para UM de reg. cálculo (guardar abastecimiento, etc.). */
  idUnidadMedidaReg?: number;
  // Stock mínimo por tienda
  stockMinimo: Record<Tienda, number>;
  // Existencia actual por tienda
  existencia: Record<Tienda, number>;
}

/** id en `unidades_medida_sea_callao` para la UM de reg. cálculo del producto. */
export function resolveIdUnidadMedidaReg(producto: Producto): number {
  return producto.idUnidadMedidaReg ?? UNIDAD_MEDIDA_REVERSE_MAP[producto.unidadMedidaRegCalculo];
}

export interface RegistroEntrada {
  id: string;
  fecha: string;
  productoId: string;
  producto: string;
  operacion: string;
  almacenSalida: AlmacenCompleto;
  almacenIngreso: Tienda;
  operador: string;
  cantidad: number;
  cantidadAnterior?: number;
  unidadMedida: UnidadMedida;
  entregado: string;
  registradoPor: string;
  observaciones: string;
  updatedAt?: string;
  motivoCambio?: string;
}

export interface RegistroSalida {
  id: string;
  fecha: string;
  productoId: string;
  producto: string;
  operacion: string;
  comprobante: string;
  asesor: string;
  cantidad: number;
  cantidadAnterior?: number;
  unidadMedida: UnidadMedida;
  almacen: Tienda;
  entregado: string;
  registradoPor: string;
  observaciones: string;
  updatedAt?: string;
  motivoCambio?: string;
}

export interface CambioEntrada extends RegistroEntrada {
  motivoCambio: string;
}
export interface CambioSalida extends RegistroSalida {
  motivoCambio: string;
}

export interface HistorialAbastecimiento {
  id: string;
  nombre: string;
  fecha: string;
  registradoPor: string;
  items: AbastecimientoRow[];
}

export interface AbastecimientoRow {
  productoId: string;
  codigo: string;
  nombre: string;
  cantidad: number;
  unidadMedida: UnidadMedida;
  tiendas: Record<Tienda, number>;
  abastecerCajas: number;
  enviar: 'SI' | 'NO';
}

export interface NotificationItem {
  id: string;
  type: 'entrada' | 'salida' | 'cambio' | 'abastecimiento' | 'producto';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

interface CallaoState {
  productos: Producto[];
  entradas: RegistroEntrada[];
  salidas: RegistroSalida[];
  cambiosEntrada: CambioEntrada[];
  cambiosSalida: CambioSalida[];
  historialAbastecimiento: HistorialAbastecimiento[];
  toasts: ToastItem[];
  notifications: NotificationItem[];
  loading: boolean;
  error: string | null;
}

interface CallaoContextType {
  state: CallaoState;
  // Productos
  addProducto: (p: Omit<Producto, 'id'>) => Promise<void>;
  updateExistencia: (productoId: string, tienda: Tienda, delta: number) => void;
  refreshProductos: () => Promise<void>;
  // Entradas
  addEntrada: (e: Omit<RegistroEntrada, 'id' | 'fecha'>) => Promise<void>;
  updateEntrada: (id: string, data: Partial<RegistroEntrada>, motivo: string) => Promise<void>;
  refreshEntradas: () => Promise<void>;
  // Salidas
  addSalida: (s: Omit<RegistroSalida, 'id' | 'fecha'>) => Promise<void>;
  updateSalida: (id: string, data: Partial<RegistroSalida>, motivo: string) => Promise<void>;
  refreshSalidas: () => Promise<void>;
  // Abastecimiento
  guardarAbastecimiento: (nombre: string, registradoPor: string, items: AbastecimientoRow[]) => Promise<void>;
  refreshAbastecimiento: () => Promise<void>;
  cargarDetalleAbastecimiento: (nombre: string) => Promise<void>;
  // Historiales
  refreshHistorialEntradas: () => Promise<void>;
  refreshHistorialSalidas: () => Promise<void>;
  // Toast
  showToast: (type: ToastItem['type'], message: string) => void;
  removeToast: (id: string) => void;
  // Notifications
  addNotification: (type: NotificationItem['type'], title: string, message: string) => void;
  markNotificationsAsRead: () => void;
}

const CallaoContext = createContext<CallaoContextType | null>(null);

function genId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function fmtDate(dateStr: string | Date): string {
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

// ─── Conversores de datos ────────────────────────────────────────────────────
function convertirProductoDB(productoDB: api.ProductoDB, stockTotal?: api.StockTotalDB): Producto {
  const unidadMedidaInfo = UNIDAD_MEDIDA_MAP[productoDB.id_unidad_medida_info] || 'UNIDADES';
  const unidadMedidaReg = UNIDAD_MEDIDA_MAP[productoDB.id_unidad_medida_reg] || 'UNIDADES';

  // Obtener stock mínimo y existencia del stockTotal si está disponible
  let stockMinimo: Record<Tienda, number> = {
    'TIENDA OFICINA': 0,
    'TIENDA OFICINA-DOCENAS': 0,
    'TIENDA CALLAO-1-A': 0,
    'TIENDA CALLAO-1-B': 0,
    'TIENDA CALLAO-2': 0,
  };
  let existencia: Record<Tienda, number> = {
    'TIENDA OFICINA': 0,
    'TIENDA OFICINA-DOCENAS': 0,
    'TIENDA CALLAO-1-A': 0,
    'TIENDA CALLAO-1-B': 0,
    'TIENDA CALLAO-2': 0,
  };

  if (stockTotal) {
    const st = stockTotal;
    stockMinimo = {
      'TIENDA OFICINA': st.sm_oficina ?? 0,
      'TIENDA OFICINA-DOCENAS': st.sm_oficina_docenas ?? 0,
      'TIENDA CALLAO-1-A': st.sm_callao1_a ?? 0,
      'TIENDA CALLAO-1-B': st.sm_callao1_b ?? 0,
      'TIENDA CALLAO-2': st.sm_callao2 ?? 0,
    };
    existencia = {
      'TIENDA OFICINA': st.existencia_oficina ?? 0,
      'TIENDA OFICINA-DOCENAS': st.existencia_oficina_docenas ?? 0,
      'TIENDA CALLAO-1-A': st.existencia_callao1_a ?? 0,
      'TIENDA CALLAO-1-B': st.existencia_callao1_b ?? 0,
      'TIENDA CALLAO-2': st.existencia_callao2 ?? 0,
    };
  }

  return {
    id: productoDB.id.toString(),
    codigo: productoDB.codigo,
    nombre: productoDB.nombre,
    cantidadEnCaja: productoDB.cantidad_en_caja || 0,
    unidadMedida: unidadMedidaInfo as UnidadMedida,
    cantidadUnidadesCaja: productoDB.cantidad_unidades_caja || 0,
    cantidadRegCalculo: productoDB.cantidad_reg_calculo || 1,
    unidadMedidaRegCalculo: unidadMedidaReg as UnidadMedida,
    idUnidadMedidaReg: productoDB.id_unidad_medida_reg,
    stockMinimo,
    existencia,
  };
}

function convertirEntradaDB(entradaDB: api.EntradaDB, productos: Producto[]): RegistroEntrada {
  const almacenSalida = resolveAlmacenSalidaEntradaDesdeApi(
    entradaDB.tienda_salida_codigo || '',
    entradaDB.tienda_salida_nombre
  );
  
  const almacenIngreso: Tienda = (getTiendaFromCodigo(entradaDB.tienda_ingreso_codigo) || 
    (entradaDB.tienda_ingreso_nombre && TIENDAS.includes(entradaDB.tienda_ingreso_nombre as Tienda) 
      ? entradaDB.tienda_ingreso_nombre as Tienda 
      : null) || 
    'TIENDA OFICINA') as Tienda;

  // Buscar producto por código o nombre
  const producto = productos.find(p => 
    p.codigo === entradaDB.producto_codigo || 
    p.nombre === entradaDB.producto_nombre
  );

  // Para historial de cambios, usar fecha_movimiento_orig como fecha original y fecha (fecha_cambio) como updatedAt
  const fechaOriginal = entradaDB.fecha_movimiento_orig || entradaDB.fecha_registro;
  const fechaCambio = entradaDB.fecha || entradaDB.fecha_actualizacion;

  return {
    id: entradaDB.id ? entradaDB.id.toString() : '',
    fecha: fechaOriginal ? fmtDate(fechaOriginal) : '',
    productoId: producto?.id || '',
    producto: entradaDB.producto_nombre || '',
    operacion: entradaDB.operacion || '',
    almacenSalida,
    almacenIngreso,
    operador: entradaDB.operador || '',
    cantidad: entradaDB.cantidad || 0,
    cantidadAnterior: entradaDB.cantidad_anterior ?? undefined,
    unidadMedida: (entradaDB.unidad_medida as UnidadMedida) || 'DOCENAS',
    entregado: entradaDB.entregado_por || '',
    registradoPor: entradaDB.registrado_por || '',
    observaciones: entradaDB.observaciones || '',
    updatedAt: fechaCambio ? fmtDate(fechaCambio) : undefined,
    motivoCambio: entradaDB.motivo_cambio || undefined,
  };
}

function convertirSalidaDB(salidaDB: api.SalidaDB, productos: Producto[]): RegistroSalida {
  // Validar que tienda_nombre existe y es un string
  const almacen: Tienda = (getTiendaFromCodigo(salidaDB.tienda_codigo) || 
    (salidaDB.tienda_nombre && TIENDAS.includes(salidaDB.tienda_nombre as Tienda) 
      ? salidaDB.tienda_nombre as Tienda 
      : null) || 
    'TIENDA OFICINA') as Tienda;

  // Buscar producto por código o nombre
  const producto = productos.find(p => 
    p.codigo === salidaDB.producto_codigo || 
    p.nombre === salidaDB.producto_nombre
  );

  // Para historial de cambios, usar fecha_movimiento_orig como fecha original y fecha (fecha_cambio) como updatedAt
  const fechaOriginal = salidaDB.fecha_movimiento_orig || salidaDB.fecha_registro;
  const fechaCambio = salidaDB.fecha || salidaDB.fecha_actualizacion;

  return {
    id: salidaDB.id ? salidaDB.id.toString() : '',
    fecha: fechaOriginal ? fmtDate(fechaOriginal) : '',
    productoId: producto?.id || '',
    producto: salidaDB.producto_nombre || '',
    operacion: salidaDB.operacion || '',
    comprobante: salidaDB.nro_comprobante || '',
    asesor: salidaDB.asesor || '',
    cantidad: salidaDB.cantidad || 0,
    cantidadAnterior: salidaDB.cantidad_anterior ?? undefined,
    unidadMedida: (salidaDB.unidad_medida as UnidadMedida) || 'DOCENAS',
    almacen,
    entregado: salidaDB.entregado_por || '',
    registradoPor: salidaDB.registrado_por || '',
    observaciones: salidaDB.observaciones || '',
    updatedAt: fechaCambio ? fmtDate(fechaCambio) : undefined,
    motivoCambio: salidaDB.motivo_cambio || undefined,
  };
}

export function CallaoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CallaoState>({
    productos: [],
    entradas: [],
    salidas: [],
    cambiosEntrada: [],
    cambiosSalida: [],
    historialAbastecimiento: [],
    toasts: [],
    notifications: [],
    loading: false,
    error: null,
  });

  // ─── Cargar datos iniciales ────────────────────────────────────────────────
  const addNotification = useCallback((type: NotificationItem['type'], title: string, message: string) => {
    const notify: NotificationItem = {
      id: genId(),
      type,
      title,
      message,
      timestamp: fmtDate(new Date()),
      read: false,
    };
    setState(s => ({ ...s, notifications: [notify, ...s.notifications] }));
  }, []);

  const markNotificationsAsRead = useCallback(() => {
    setState(s => ({
      ...s,
      notifications: s.notifications.map(n => ({ ...n, read: true })),
    }));
  }, []);

  const showToast = useCallback((type: ToastItem['type'], message: string) => {
    const id = genId();
    setState(s => ({ ...s, toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => {
      setState(s => ({ ...s, toasts: s.toasts.filter(t => t.id !== id) }));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setState(s => ({ ...s, toasts: s.toasts.filter(t => t.id !== id) }));
  }, []);

  // Cargar datos iniciales después de que showToast esté definido
  useEffect(() => {
    const cargarDatos = async () => {
      setState(s => ({ ...s, loading: true, error: null }));
      try {
        const [productosDB, stockTotalDB, entradasDB, salidasDB] = await Promise.all([
          api.getProductos(true),
          api.getStockTotal(),
          api.getEntradas(),
          api.getSalidas(),
        ]);

        // Crear mapa de stock total por código
        const stockMap = new Map<string, api.StockTotalDB>();
        stockTotalDB.forEach(st => stockMap.set(st.codigo, st));

        const productos = productosDB.map(p => {
          const stock = stockMap.get(p.codigo);
          return convertirProductoDB(p, stock);
        });

        // Convertir entradas y salidas
        const entradas = entradasDB.map(e => convertirEntradaDB(e, productos));
        const salidas = salidasDB.map(s => convertirSalidaDB(s, productos));

        setState(s => ({ ...s, productos, entradas, salidas, loading: false }));
      } catch (error: any) {
        console.error('Error cargando datos iniciales:', error);
        setState(s => ({ ...s, error: error.message, loading: false }));
        showToast('error', 'Error al cargar datos iniciales');
      }
    };

    cargarDatos();
  }, [showToast]);

  const refreshProductos = useCallback(async () => {
    try {
      const [productosDB, stockTotalDB] = await Promise.all([
        api.getProductos(true),
        api.getStockTotal(),
      ]);

      const stockMap = new Map<string, api.StockTotalDB>();
      stockTotalDB.forEach(st => stockMap.set(st.codigo, st));

      const productos = productosDB.map(p => {
        const stock = stockMap.get(p.codigo);
        return convertirProductoDB(p, stock);
      });

      setState(s => ({ ...s, productos }));
    } catch (error: any) {
      console.error('Error refrescando productos:', error);
      showToast('error', 'Error al cargar productos');
    }
  }, [showToast]);

  const refreshEntradas = useCallback(async () => {
    try {
      const entradasDB = await api.getEntradas();
      setState(s => {
        const entradas = entradasDB.map(e => convertirEntradaDB(e, s.productos));
        return { ...s, entradas };
      });
    } catch (error: any) {
      console.error('Error refrescando entradas:', error);
      showToast('error', 'Error al cargar entradas');
    }
  }, [showToast]);

  const refreshSalidas = useCallback(async () => {
    try {
      const salidasDB = await api.getSalidas();
      setState(s => {
        const salidas = salidasDB.map(sl => convertirSalidaDB(sl, s.productos));
        return { ...s, salidas };
      });
    } catch (error: any) {
      console.error('Error refrescando salidas:', error);
      showToast('error', 'Error al cargar salidas');
    }
  }, [showToast]);

  const refreshHistorialEntradas = useCallback(async () => {
    try {
      const cambiosDB = await api.getHistorialEntradas();
      setState(s => {
        const cambios = cambiosDB.map(e => convertirEntradaDB(e, s.productos)).map(e => ({
          ...e,
          motivoCambio: e.motivoCambio || '',
        })) as CambioEntrada[];
        return { ...s, cambiosEntrada: cambios };
      });
    } catch (error: any) {
      console.error('Error refrescando historial entradas:', error);
      showToast('error', 'Error al cargar historial de entradas');
    }
  }, [showToast]);

  const refreshHistorialSalidas = useCallback(async () => {
    try {
      const cambiosDB = await api.getHistorialSalidas();
      setState(s => {
        const cambios = cambiosDB.map(sl => convertirSalidaDB(sl, s.productos)).map(s => ({
          ...s,
          motivoCambio: s.motivoCambio || '',
        })) as CambioSalida[];
        return { ...s, cambiosSalida: cambios };
      });
    } catch (error: any) {
      console.error('Error refrescando historial salidas:', error);
      showToast('error', 'Error al cargar historial de salidas');
    }
  }, [showToast]);

  const updateExistencia = useCallback((productoId: string, tienda: Tienda, delta: number) => {
    setState(s => ({
      ...s,
      productos: s.productos.map(p =>
        p.id === productoId
          ? { ...p, existencia: { ...p.existencia, [tienda]: Math.max(0, (p.existencia[tienda] || 0) + delta) } }
          : p
      ),
    }));
  }, []);

  const addProducto = useCallback(async (p: Omit<Producto, 'id'>) => {
    try {
      const productoId = UNIDAD_MEDIDA_REVERSE_MAP[p.unidadMedidaRegCalculo];
      const unidadMedidaInfoId = UNIDAD_MEDIDA_REVERSE_MAP[p.unidadMedida];

      await api.createProducto({
        codigo: p.codigo,
        nombre: p.nombre,
        cantidad_en_caja: p.cantidadEnCaja,
        id_unidad_medida_info: unidadMedidaInfoId,
        cantidad_unidades_caja: p.cantidadUnidadesCaja,
        cantidad_reg_calculo: p.cantidadRegCalculo,
        id_unidad_medida_reg: productoId,
      });

      await refreshProductos();
      addNotification('producto', 'Nuevo Producto', `Se registró el producto: ${p.nombre}`);
      showToast('success', 'Producto creado exitosamente');
    } catch (error: any) {
      console.error('Error creando producto:', error);
      showToast('error', error.message || 'Error al crear producto');
      throw error;
    }
  }, [refreshProductos, addNotification, showToast]);

  const addEntrada = useCallback(async (e: Omit<RegistroEntrada, 'id' | 'fecha'>) => {
    try {
      const producto = state.productos.find(p => p.id === e.productoId);
      if (!producto) throw new Error('Producto no encontrado');

      const almacenSalidaStr = getCodigoAlmacenSalidaEntrada(e.almacenSalida);

      await api.createEntrada({
        producto: producto.codigo,
        operacion: e.operacion,
        almacen_salida: almacenSalidaStr,
        almacen_ingreso: getCodigoFromTienda(e.almacenIngreso),
        operador: e.operador,
        cantidad: e.cantidad,
        unidad_medida: e.unidadMedida,
        entregado_por: e.entregado,
        registrado_por: e.registradoPor,
        observaciones: e.observaciones,
      });

      await Promise.all([refreshEntradas(), refreshProductos()]);
      addNotification('entrada', 'Nueva Entrada', `Ingreso de ${e.cantidad} ${e.unidadMedida} de ${e.producto} a ${e.almacenIngreso}`);
      showToast('success', 'Entrada registrada correctamente');
    } catch (error: any) {
      console.error('Error creando entrada:', error);
      showToast('error', error.message || 'Error al registrar entrada');
      throw error;
    }
  }, [state.productos, refreshEntradas, refreshProductos, addNotification, showToast]);

  const updateEntrada = useCallback(async (id: string, data: Partial<RegistroEntrada>, motivo: string) => {
    try {
      const entrada = state.entradas.find(e => e.id === id);
      if (!entrada) throw new Error('Entrada no encontrada');

      const producto = state.productos.find(p => p.codigo === entrada.producto || p.nombre === entrada.producto);
      if (!producto) throw new Error('Producto no encontrado');

      const finalData = { ...entrada, ...data };
      const almacenSalidaStr = getCodigoAlmacenSalidaEntrada(finalData.almacenSalida);

      await api.updateEntrada(parseInt(id), {
        producto: producto.codigo,
        operacion: finalData.operacion,
        almacen_salida: almacenSalidaStr,
        almacen_ingreso: getCodigoFromTienda(finalData.almacenIngreso),
        operador: finalData.operador,
        cantidad: finalData.cantidad,
        unidad_medida: finalData.unidadMedida,
        entregado_por: finalData.entregado,
        registrado_por: finalData.registradoPor,
        observaciones: finalData.observaciones,
        motivo_cambio: motivo,
      });

      await Promise.all([refreshEntradas(), refreshProductos(), refreshHistorialEntradas()]);
      addNotification('cambio', 'Entrada Actualizada', `Se modificó un registro de entrada. Motivo: ${motivo}`);
      showToast('success', 'Entrada actualizada correctamente');
    } catch (error: any) {
      console.error('Error actualizando entrada:', error);
      showToast('error', error.message || 'Error al actualizar entrada');
      throw error;
    }
  }, [state.entradas, state.productos, refreshEntradas, refreshProductos, refreshHistorialEntradas, addNotification, showToast]);

  const addSalida = useCallback(async (e: Omit<RegistroSalida, 'id' | 'fecha'>) => {
    try {
      const producto = state.productos.find(p => p.id === e.productoId);
      if (!producto) throw new Error('Producto no encontrado');

      await api.createSalida({
        producto: producto.codigo,
        operacion: e.operacion,
        nro_comprobante: e.comprobante,
        asesor: e.asesor,
        cantidad: e.cantidad,
        unidad_medida: e.unidadMedida,
        almacen: getCodigoFromTienda(e.almacen),
        entregado_por: e.entregado,
        registrado_por: e.registradoPor,
        observaciones: e.observaciones,
      });

      await Promise.all([refreshSalidas(), refreshProductos()]);
      addNotification('salida', 'Nueva Salida', `Salida de ${e.cantidad} ${e.unidadMedida} de ${e.producto} desde ${e.almacen}`);
      showToast('success', 'Salida registrada correctamente');
    } catch (error: any) {
      console.error('Error creando salida:', error);
      const msg = error?.message || 'Error al registrar salida';
      if (msg.toLowerCase().includes('stock insuficiente')) {
        showToast('warning', msg);
      } else {
        showToast('error', msg);
      }
      throw error;
    }
  }, [state.productos, refreshSalidas, refreshProductos, addNotification, showToast]);

  const updateSalida = useCallback(async (id: string, data: Partial<RegistroSalida>, motivo: string) => {
    try {
      const salida = state.salidas.find(s => s.id === id);
      if (!salida) throw new Error('Salida no encontrada');

      const producto = state.productos.find(p => p.codigo === salida.producto || p.nombre === salida.producto);
      if (!producto) throw new Error('Producto no encontrado');

      const finalData = { ...salida, ...data };

      await api.updateSalida(parseInt(id), {
        producto: producto.codigo,
        operacion: finalData.operacion,
        nro_comprobante: finalData.comprobante,
        asesor: finalData.asesor,
        cantidad: finalData.cantidad,
        unidad_medida: finalData.unidadMedida,
        almacen: getCodigoFromTienda(finalData.almacen),
        entregado_por: finalData.entregado,
        registrado_por: finalData.registradoPor,
        observaciones: finalData.observaciones,
        motivo_cambio: motivo,
      });

      await Promise.all([refreshSalidas(), refreshProductos(), refreshHistorialSalidas()]);
      addNotification('cambio', 'Salida Actualizada', `Se modificó un registro de salida. Motivo: ${motivo}`);
      showToast('success', 'Salida actualizada correctamente');
    } catch (error: any) {
      console.error('Error actualizando salida:', error);
      const msg = error?.message || 'Error al actualizar salida';
      if (msg.toLowerCase().includes('stock insuficiente')) {
        showToast('warning', msg);
      } else {
        showToast('error', msg);
      }
      throw error;
    }
  }, [state.salidas, state.productos, refreshSalidas, refreshProductos, refreshHistorialSalidas, addNotification, showToast]);

  const refreshAbastecimiento = useCallback(async () => {
    try {
      const historialDB = await api.getHistorialAbastecimientos();
      const historial: HistorialAbastecimiento[] = historialDB.map(h => ({
        id: h.id.toString(),
        nombre: h.nombre,
        fecha: fmtDate(h.fecha_registro),
        registradoPor: h.registrado_por,
        items: [], // Se cargarán cuando se necesiten
      }));
      setState(s => ({ ...s, historialAbastecimiento: historial }));
    } catch (error: any) {
      console.error('Error refrescando abastecimiento:', error);
      showToast('error', 'Error al cargar historial de abastecimiento');
    }
  }, [showToast]);

  const cargarDetalleAbastecimiento = useCallback(async (nombre: string) => {
    try {
      const detalle = await api.getDetalleAbastecimiento(nombre);
      const productosMap = new Map(state.productos.map(p => [p.codigo, p]));
      
      const items: AbastecimientoRow[] = detalle.detalles.map(item => {
        const producto = productosMap.get(item.codigo);
        return {
          productoId: producto?.id || '',
          codigo: item.codigo,
          nombre: item.nombre,
          cantidad: item.cantidad,
          unidadMedida: item.unidad_medida as UnidadMedida,
          tiendas: {
            'TIENDA OFICINA': item.cant_almacen_oficina ?? 0,
            'TIENDA OFICINA-DOCENAS': item.cant_almacen_oficina_docenas ?? 0,
            'TIENDA CALLAO-1-A': item.cant_almacen_callao_1_a ?? 0,
            'TIENDA CALLAO-1-B': item.cant_almacen_callao_1_b ?? 0,
            'TIENDA CALLAO-2': item.cant_almacen_callao_2 ?? 0,
          },
          abastecerCajas: item.abastecer_cajas,
          enviar: item.enviar as 'SI' | 'NO',
        };
      });

      setState(s => ({
        ...s,
        historialAbastecimiento: s.historialAbastecimiento.map(h =>
          h.nombre === nombre ? { ...h, items } : h
        ),
      }));
    } catch (error: any) {
      console.error('Error cargando detalle abastecimiento:', error);
      showToast('error', 'Error al cargar detalle del abastecimiento');
    }
  }, [state.productos, showToast]);

  const guardarAbastecimiento = useCallback(async (nombre: string, registradoPor: string, items: AbastecimientoRow[]) => {
    try {
      const detalles = items.map(item => {
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

      await api.guardarAbastecimiento({
        nombre_abastecimiento: nombre,
        registrado_por: registradoPor,
        detalles,
      });

      await refreshAbastecimiento();
      addNotification('abastecimiento', 'Carga de Stock', `Se guardó el abastecimiento: ${nombre}`);
      showToast('success', 'Abastecimiento guardado exitosamente');
    } catch (error: any) {
      console.error('Error guardando abastecimiento:', error);
      showToast('error', error.message || 'Error al guardar abastecimiento');
      throw error;
    }
  }, [state.productos, refreshAbastecimiento, addNotification, showToast]);

  return (
    <CallaoContext.Provider value={{
      state,
      addProducto,
      updateExistencia,
      refreshProductos,
      addEntrada,
      updateEntrada,
      refreshEntradas,
      addSalida,
      updateSalida,
      refreshSalidas,
      guardarAbastecimiento,
      refreshAbastecimiento,
      cargarDetalleAbastecimiento,
      refreshHistorialEntradas,
      refreshHistorialSalidas,
      showToast,
      removeToast,
      addNotification,
      markNotificationsAsRead,
    }}>
      {children}
    </CallaoContext.Provider>
  );
}

export function useCallao() {
  const ctx = useContext(CallaoContext);
  if (!ctx) throw new Error('useCallao must be used within CallaoProvider');
  return ctx;
}
