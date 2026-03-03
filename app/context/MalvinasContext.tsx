'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
export type UnidadMedida = 'DOCENAS' | 'DECENAS' | 'UNIDADES' | 'CAJITAS' | 'BOLSITAS';
export type Tienda = 'TIENDA 3006' | 'TIENDA 3131' | 'TIENDA 412-A' | 'TIENDA 3133';
export type AlmacenCompleto = 'ALMACEN CALLAO' | Tienda;

export const TIENDAS: Tienda[] = ['TIENDA 3006', 'TIENDA 3131', 'TIENDA 412-A', 'TIENDA 3133'];
export const OPERADORES = ['Manuel', 'Victor', 'Jose', 'Jhonsom'];
export const REGISTRADORES = ['Manuel', 'Jose', 'Kimberly', 'Hervin', 'Victor', 'Alvaro'];
export const UNIDADES: UnidadMedida[] = ['DOCENAS', 'DECENAS', 'UNIDADES', 'CAJITAS', 'BOLSITAS'];
export const ALMACENES_COMPLETO: AlmacenCompleto[] = ['ALMACEN CALLAO', 'TIENDA 3006', 'TIENDA 3131', 'TIENDA 412-A', 'TIENDA 3133'];

export const OPS_ENTRADA = ['TRASLADO', 'DEVOLUCION', 'CAMBIO', 'MERMA', 'REPOSICION'] as const;
export const OPS_SALIDA = ['VENTA', 'TRASLADO', 'DEVOLUCION', 'CAMBIO', 'REPOSICION', 'MERMA'] as const;

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
  // Stock mínimo por tienda
  stockMinimo: Record<Tienda, number>;
  // Existencia actual por tienda
  existencia: Record<Tienda, number>;
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

interface MalvinasState {
  productos: Producto[];
  entradas: RegistroEntrada[];
  salidas: RegistroSalida[];
  cambiosEntrada: CambioEntrada[];
  cambiosSalida: CambioSalida[];
  historialAbastecimiento: HistorialAbastecimiento[];
  toasts: ToastItem[];
  notifications: NotificationItem[];
}

interface MalvinasContextType {
  state: MalvinasState;
  // Productos
  addProducto: (p: Omit<Producto, 'id'>) => void;
  updateExistencia: (productoId: string, tienda: Tienda, delta: number) => void;
  // Entradas
  addEntrada: (e: Omit<RegistroEntrada, 'id' | 'fecha'>) => void;
  updateEntrada: (id: string, data: Partial<RegistroEntrada>, motivo: string) => void;
  // Salidas
  addSalida: (s: Omit<RegistroSalida, 'id' | 'fecha'>) => void;
  updateSalida: (id: string, data: Partial<RegistroSalida>, motivo: string) => void;
  // Abastecimiento
  guardarAbastecimiento: (nombre: string, registradoPor: string, items: AbastecimientoRow[]) => void;
  // Toast
  showToast: (type: ToastItem['type'], message: string) => void;
  removeToast: (id: string) => void;
  // Notifications
  addNotification: (type: NotificationItem['type'], title: string, message: string) => void;
  markNotificationsAsRead: () => void;
}

const MalvinasContext = createContext<MalvinasContextType | null>(null);

// ─── Sample data ─────────────────────────────────────────────────────────────
const sampleProductos: Producto[] = [
  {
    id: 'p001', codigo: 'ZS-001', nombre: 'GUANTES NITRILO ROJO T/M',
    cantidadEnCaja: 12, unidadMedida: 'DOCENAS', cantidadUnidadesCaja: 144,
    cantidadRegCalculo: 12, unidadMedidaRegCalculo: 'DOCENAS',
    stockMinimo: { 'TIENDA 3006': 150, 'TIENDA 3131': 0, 'TIENDA 412-A': 380, 'TIENDA 3133': 0 },
    existencia: { 'TIENDA 3006': 112, 'TIENDA 3131': 0, 'TIENDA 412-A': 370, 'TIENDA 3133': 0 },
  },
  {
    id: 'p002', codigo: 'ZS-002', nombre: 'GUANTES NITRILO AZUL T/L',
    cantidadEnCaja: 12, unidadMedida: 'DOCENAS', cantidadUnidadesCaja: 144,
    cantidadRegCalculo: 12, unidadMedidaRegCalculo: 'DOCENAS',
    stockMinimo: { 'TIENDA 3006': 200, 'TIENDA 3131': 100, 'TIENDA 412-A': 300, 'TIENDA 3133': 50 },
    existencia: { 'TIENDA 3006': 180, 'TIENDA 3131': 95, 'TIENDA 412-A': 310, 'TIENDA 3133': 45 },
  },
  {
    id: 'p003', codigo: 'ZS-003', nombre: 'CASCO SEGURIDAD BLANCO',
    cantidadEnCaja: 10, unidadMedida: 'UNIDADES', cantidadUnidadesCaja: 10,
    cantidadRegCalculo: 10, unidadMedidaRegCalculo: 'UNIDADES',
    stockMinimo: { 'TIENDA 3006': 50, 'TIENDA 3131': 30, 'TIENDA 412-A': 80, 'TIENDA 3133': 20 },
    existencia: { 'TIENDA 3006': 45, 'TIENDA 3131': 32, 'TIENDA 412-A': 75, 'TIENDA 3133': 18 },
  },
  {
    id: 'p004', codigo: 'ZS-004', nombre: 'LENTES POLICARBONATO CLARO',
    cantidadEnCaja: 10, unidadMedida: 'DECENAS', cantidadUnidadesCaja: 100,
    cantidadRegCalculo: 10, unidadMedidaRegCalculo: 'DECENAS',
    stockMinimo: { 'TIENDA 3006': 100, 'TIENDA 3131': 0, 'TIENDA 412-A': 150, 'TIENDA 3133': 0 },
    existencia: { 'TIENDA 3006': 90, 'TIENDA 3131': 0, 'TIENDA 412-A': 145, 'TIENDA 3133': 0 },
  },
  {
    id: 'p005', codigo: 'ZS-005', nombre: 'BOTAS PVC AMARILLA T/42',
    cantidadEnCaja: 6, unidadMedida: 'UNIDADES', cantidadUnidadesCaja: 6,
    cantidadRegCalculo: 6, unidadMedidaRegCalculo: 'UNIDADES',
    stockMinimo: { 'TIENDA 3006': 30, 'TIENDA 3131': 20, 'TIENDA 412-A': 60, 'TIENDA 3133': 10 },
    existencia: { 'TIENDA 3006': 24, 'TIENDA 3131': 22, 'TIENDA 412-A': 58, 'TIENDA 3133': 8 },
  },
  {
    id: 'p006', codigo: 'ZS-006', nombre: 'TAPONES AUDITIVOS CAJA',
    cantidadEnCaja: 100, unidadMedida: 'CAJITAS', cantidadUnidadesCaja: 100,
    cantidadRegCalculo: 100, unidadMedidaRegCalculo: 'CAJITAS',
    stockMinimo: { 'TIENDA 3006': 500, 'TIENDA 3131': 300, 'TIENDA 412-A': 800, 'TIENDA 3133': 100 },
    existencia: { 'TIENDA 3006': 480, 'TIENDA 3131': 310, 'TIENDA 412-A': 790, 'TIENDA 3133': 95 },
  },
  {
    id: 'p007', codigo: 'ZS-007', nombre: 'MASCARILLA KN95',
    cantidadEnCaja: 50, unidadMedida: 'BOLSITAS', cantidadUnidadesCaja: 50,
    cantidadRegCalculo: 50, unidadMedidaRegCalculo: 'BOLSITAS',
    stockMinimo: { 'TIENDA 3006': 200, 'TIENDA 3131': 150, 'TIENDA 412-A': 400, 'TIENDA 3133': 50 },
    existencia: { 'TIENDA 3006': 185, 'TIENDA 3131': 160, 'TIENDA 412-A': 395, 'TIENDA 3133': 45 },
  },
  {
    id: 'p008', codigo: 'ZS-008', nombre: 'CHALECO REFLECTIVO NARANJA',
    cantidadEnCaja: 10, unidadMedida: 'UNIDADES', cantidadUnidadesCaja: 10,
    cantidadRegCalculo: 10, unidadMedidaRegCalculo: 'UNIDADES',
    stockMinimo: { 'TIENDA 3006': 40, 'TIENDA 3131': 25, 'TIENDA 412-A': 70, 'TIENDA 3133': 15 },
    existencia: { 'TIENDA 3006': 35, 'TIENDA 3131': 28, 'TIENDA 412-A': 65, 'TIENDA 3133': 12 },
  },
];

function genId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

export function MalvinasProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MalvinasState>({
    productos: sampleProductos,
    entradas: [],
    salidas: [],
    cambiosEntrada: [],
    cambiosSalida: [],
    historialAbastecimiento: [],
    toasts: [],
    notifications: [],
  });

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

  const addProducto = useCallback((p: Omit<Producto, 'id'>) => {
    const newP = { ...p, id: genId() };
    setState(s => ({ ...s, productos: [...s.productos, newP] }));
    addNotification('producto', 'Nuevo Producto', `Se registró el producto: ${p.nombre}`);
  }, [addNotification]);

  const addEntrada = useCallback((e: Omit<RegistroEntrada, 'id' | 'fecha'>) => {
    const newE: RegistroEntrada = { ...e, id: genId(), fecha: fmtDate(new Date()) };
    setState(s => ({ ...s, entradas: [newE, ...s.entradas] }));
    // Afectar existencia
    updateExistencia(e.productoId, e.almacenIngreso, +e.cantidad);
    addNotification('entrada', 'Nueva Entrada', `Ingreso de ${e.cantidad} ${e.unidadMedida} de ${e.producto} a ${e.almacenIngreso}`);
  }, [updateExistencia, addNotification]);

  const updateEntrada = useCallback((id: string, data: Partial<RegistroEntrada>, motivo: string) => {
    setState(s => {
      const old = s.entradas.find(e => e.id === id);
      if (!old) return s;
      // Revertir existencia anterior
      const updatedProductos = s.productos.map(p => {
        if (p.id === old.productoId) {
          const reverted = { ...p.existencia, [old.almacenIngreso]: Math.max(0, (p.existencia[old.almacenIngreso] || 0) - old.cantidad) };
          const newTienda = (data.almacenIngreso || old.almacenIngreso) as Tienda;
          const newCant = data.cantidad !== undefined ? data.cantidad : old.cantidad;
          reverted[newTienda] = Math.max(0, (reverted[newTienda] || 0) + newCant);
          return { ...p, existencia: reverted };
        }
        return p;
      });
      const updated: RegistroEntrada = { ...old, ...data, updatedAt: fmtDate(new Date()), motivoCambio: motivo };
      const cambio: CambioEntrada = { ...updated, motivoCambio: motivo };
      return {
        ...s,
        productos: updatedProductos,
        entradas: s.entradas.map(e => e.id === id ? updated : e),
        cambiosEntrada: [cambio, ...s.cambiosEntrada],
      };
    });
    addNotification('cambio', 'Entrada Actualizada', `Se modificó un registro de entrada. Motivo: ${motivo}`);
  }, [addNotification]);

  const addSalida = useCallback((e: Omit<RegistroSalida, 'id' | 'fecha'>) => {
    const newS: RegistroSalida = { ...e, id: genId(), fecha: fmtDate(new Date()) };
    setState(s => ({ ...s, salidas: [newS, ...s.salidas] }));
    updateExistencia(e.productoId, e.almacen, -e.cantidad);
    addNotification('salida', 'Nueva Salida', `Salida de ${e.cantidad} ${e.unidadMedida} de ${e.producto} desde ${e.almacen}`);
  }, [updateExistencia, addNotification]);

  const updateSalida = useCallback((id: string, data: Partial<RegistroSalida>, motivo: string) => {
    setState(s => {
      const old = s.salidas.find(sl => sl.id === id);
      if (!old) return s;
      const updatedProductos = s.productos.map(p => {
        if (p.id === old.productoId) {
          const reverted = { ...p.existencia, [old.almacen]: (p.existencia[old.almacen] || 0) + old.cantidad };
          const newTienda = (data.almacen || old.almacen) as Tienda;
          const newCant = data.cantidad !== undefined ? data.cantidad : old.cantidad;
          reverted[newTienda] = Math.max(0, (reverted[newTienda] || 0) - newCant);
          return { ...p, existencia: reverted };
        }
        return p;
      });
      const updated: RegistroSalida = { ...old, ...data, updatedAt: fmtDate(new Date()), motivoCambio: motivo };
      const cambio: CambioSalida = { ...updated, motivoCambio: motivo };
      return {
        ...s,
        productos: updatedProductos,
        salidas: s.salidas.map(sl => sl.id === id ? updated : sl),
        cambiosSalida: [cambio, ...s.cambiosSalida],
      };
    });
    addNotification('cambio', 'Salida Actualizada', `Se modificó un registro de salida. Motivo: ${motivo}`);
  }, [addNotification]);

  const guardarAbastecimiento = useCallback((nombre: string, registradoPor: string, items: AbastecimientoRow[]) => {
    const h: HistorialAbastecimiento = {
      id: genId(),
      nombre,
      fecha: fmtDate(new Date()),
      registradoPor,
      items,
    };
    setState(s => ({ ...s, historialAbastecimiento: [h, ...s.historialAbastecimiento] }));
    addNotification('abastecimiento', 'Carga de Stock', `Se guardó el abastecimiento: ${nombre}`);
  }, [addNotification]);

  return (
    <MalvinasContext.Provider value={{
      state,
      addProducto,
      updateExistencia,
      addEntrada,
      updateEntrada,
      addSalida,
      updateSalida,
      guardarAbastecimiento,
      showToast,
      removeToast,
      addNotification,
      markNotificationsAsRead,
    }}>
      {children}
    </MalvinasContext.Provider>
  );
}

export function useMalvinas() {
  const ctx = useContext(MalvinasContext);
  if (!ctx) throw new Error('useMalvinas must be used within MalvinasProvider');
  return ctx;
}
