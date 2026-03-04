// Servicio de API para conectar con el backend
const API_BASE_URL = 'https://api-abastecimiento-2946605267.us-central1.run.app';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

export interface UnidadMedidaDB {
  id: number;
  nombre: string;
}

export interface TiendaDB {
  id: number;
  codigo: string;
  nombre: string;
  es_almacen: number;
  activo: number;
}

export interface ProductoDB {
  id: number;
  codigo: string;
  nombre: string;
  cantidad_en_caja: number | null;
  id_unidad_medida_info: number;
  cantidad_unidades_caja: number | null;
  cantidad_reg_calculo: number | null;
  id_unidad_medida_reg: number;
  activo: number;
}

export interface EntradaDB {
  id: number;
  fecha_registro: string;
  producto_codigo: string;
  producto_nombre: string;
  operacion: string;
  tienda_salida_codigo: string;
  tienda_salida_nombre: string | null;
  tienda_ingreso_codigo: string;
  tienda_ingreso_nombre: string | null;
  operador: string | null;
  cantidad: number;
  unidad_medida: string;
  entregado_por: string | null;
  registrado_por: string | null;
  observaciones: string | null;
  fecha_actualizacion: string | null;
  motivo_cambio: string | null;
  fecha_movimiento_orig?: string | null; // Para historial de cambios
  fecha?: string | null; // Para historial de cambios (fecha_cambio)
}

export interface SalidaDB {
  id: number;
  fecha_registro: string;
  producto_codigo: string;
  producto_nombre: string;
  operacion: string;
  nro_comprobante: string | null;
  asesor: string | null;
  cantidad: number;
  unidad_medida: string;
  tienda_codigo: string;
  tienda_nombre: string | null;
  entregado_por: string | null;
  registrado_por: string | null;
  observaciones: string | null;
  fecha_actualizacion: string | null;
  motivo_cambio: string | null;
  fecha_movimiento_orig?: string | null; // Para historial de cambios
  fecha?: string | null; // Para historial de cambios (fecha_cambio)
}

export interface StockTotalDB {
  id: number;
  codigo: string;
  nombre: string;
  cantidad_reg_calculo: number;
  unidad_medida_reg: string;
  sm_3006: number | null;
  sm_3131: number | null;
  sm_412a: number | null;
  sm_3133: number | null;
  existencia_3006: number;
  existencia_3131: number;
  existencia_412a: number;
  existencia_3133: number;
  stock_global_minimo: number;
  disponibles: number;
  stock_detallado_cajas: number;
  stock_detallado_medida: number;
  stock_detallado_unidad_medida: string;
}

export interface AbastecimientoDB {
  codigo: string;
  nombre: string;
  cantidad: number;
  unidad_medida: string;
  abastecer_3006: number;
  abastecer_3131: number;
  abastecer_412a: number;
  abastecer_3133: number;
  abastecer_cajas: number;
  enviar: string;
}

export interface HistorialAbastecimientoDB {
  id: number;
  nombre: string;
  registrado_por: string;
  fecha_registro: string;
}

export interface DetalleAbastecimientoDB {
  codigo: string;
  nombre: string;
  cantidad: number;
  unidad_medida: string;
  cant_tienda_3006: number;
  cant_tienda_3131: number;
  cant_tienda_412a: number;
  cant_tienda_3133: number;
  abastecer_cajas: number;
  enviar: string;
}

// ─── Funciones auxiliares ────────────────────────────────────────────────────
async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
      throw new Error(errorData.error || `Error ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error en ${endpoint}:`, error);
    throw error;
  }
}

// ─── API Calls ────────────────────────────────────────────────────────────────

// Tiendas
export async function getTiendas(): Promise<TiendaDB[]> {
  const response = await fetchAPI<TiendaDB[]>('/api/tiendas');
  return response.data || [];
}

// Unidades de Medida
export async function getUnidadesMedida(): Promise<UnidadMedidaDB[]> {
  const response = await fetchAPI<UnidadMedidaDB[]>('/api/unidades-medida');
  return response.data || [];
}

// Tipos de Operación
export async function getTiposOperacion(tipo: 'ENTRADA' | 'SALIDA'): Promise<{ id: number; nombre: string }[]> {
  const endpoint = tipo === 'ENTRADA' ? '/api/tipos-operacion/entrada' : '/api/tipos-operacion/salida';
  const response = await fetchAPI<{ id: number; nombre: string }[]>(endpoint);
  return response.data || [];
}

// Productos
export async function getProductos(activo: boolean = true): Promise<ProductoDB[]> {
  const endpoint = activo ? '/api/productos?activo=1' : '/api/productos';
  const response = await fetchAPI<ProductoDB[]>(endpoint);
  return response.data || [];
}

export async function createProducto(data: {
  codigo: string;
  nombre: string;
  cantidad_en_caja?: number;
  id_unidad_medida_info: number;
  cantidad_unidades_caja?: number;
  cantidad_reg_calculo?: number;
  id_unidad_medida_reg: number;
}): Promise<{ id: number; codigo: string; nombre: string }> {
  const response = await fetchAPI<{ id: number; codigo: string; nombre: string }>('/api/productos', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!response.data) throw new Error(response.error || 'Error al crear producto');
  return response.data;
}

// Entradas
export async function getEntradas(): Promise<EntradaDB[]> {
  const response = await fetchAPI<EntradaDB[]>('/api/entradas');
  return response.data || [];
}

export async function createEntrada(data: {
  producto: string; // código o nombre
  operacion: string;
  almacen_salida: string; // código o nombre
  almacen_ingreso: string; // código o nombre
  operador?: string;
  cantidad: number;
  unidad_medida: string; // nombre de la unidad
  entregado_por?: string;
  registrado_por?: string;
  observaciones?: string;
}): Promise<{ id: number }> {
  const response = await fetchAPI<{ id: number }>('/api/entradas', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!response.data) throw new Error(response.error || 'Error al crear entrada');
  return response.data;
}

export async function updateEntrada(
  id: number,
  data: {
    producto: string;
    operacion: string;
    almacen_salida: string;
    almacen_ingreso: string;
    operador?: string;
    cantidad: number;
    unidad_medida: string;
    entregado_por?: string;
    registrado_por?: string;
    observaciones?: string;
    motivo_cambio: string;
  }
): Promise<void> {
  const response = await fetchAPI(`/api/entradas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!response.success) throw new Error(response.error || 'Error al actualizar entrada');
}

// Salidas
export async function getSalidas(): Promise<SalidaDB[]> {
  const response = await fetchAPI<SalidaDB[]>('/api/salidas');
  return response.data || [];
}

export async function createSalida(data: {
  producto: string;
  operacion: string;
  nro_comprobante?: string;
  asesor?: string;
  cantidad: number;
  unidad_medida: string;
  almacen: string; // código o nombre
  entregado_por?: string;
  registrado_por?: string;
  observaciones?: string;
}): Promise<{ id: number }> {
  const response = await fetchAPI<{ id: number }>('/api/salidas', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!response.data) throw new Error(response.error || 'Error al crear salida');
  return response.data;
}

export async function updateSalida(
  id: number,
  data: {
    producto: string;
    operacion: string;
    nro_comprobante?: string;
    asesor?: string;
    cantidad: number;
    unidad_medida: string;
    almacen: string;
    entregado_por?: string;
    registrado_por?: string;
    observaciones?: string;
    motivo_cambio: string;
  }
): Promise<void> {
  const response = await fetchAPI(`/api/salidas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!response.success) throw new Error(response.error || 'Error al actualizar salida');
}

// Existencias
export async function getExistencias(): Promise<any[]> {
  const response = await fetchAPI<any[]>('/api/existencias');
  return response.data || [];
}

// Stock Total
export async function getStockTotal(): Promise<StockTotalDB[]> {
  const response = await fetchAPI<StockTotalDB[]>('/api/stock-total');
  return response.data || [];
}

// Historial Entradas
export async function getHistorialEntradas(): Promise<EntradaDB[]> {
  const response = await fetchAPI<EntradaDB[]>('/api/historial/entradas');
  return response.data || [];
}

// Historial Salidas
export async function getHistorialSalidas(): Promise<SalidaDB[]> {
  const response = await fetchAPI<SalidaDB[]>('/api/historial/salidas');
  return response.data || [];
}

// Abastecimiento
export async function calcularAbastecimiento(): Promise<AbastecimientoDB[]> {
  const response = await fetchAPI<AbastecimientoDB[]>('/api/abastecimiento/calcular');
  return response.data || [];
}

export async function guardarAbastecimiento(data: {
  nombre_abastecimiento: string;
  registrado_por: string;
  detalles: Array<{
    codigo: string;
    cant_tienda_3006: number;
    cant_tienda_3131: number;
    cant_tienda_412a: number;
    cant_tienda_3133: number;
    abastecer_cajas: number;
    enviar: 'SI' | 'NO';
  }>;
}): Promise<{ id_abastecimiento: number }> {
  const response = await fetchAPI<{ id_abastecimiento: number }>('/api/abastecimiento/guardar', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!response.data) throw new Error(response.error || 'Error al guardar abastecimiento');
  return response.data;
}

export async function getHistorialAbastecimientos(): Promise<HistorialAbastecimientoDB[]> {
  const response = await fetchAPI<HistorialAbastecimientoDB[]>('/api/abastecimiento/historial');
  return response.data || [];
}

export async function getDetalleAbastecimiento(nombre: string): Promise<{
  cabecera: HistorialAbastecimientoDB;
  detalles: DetalleAbastecimientoDB[];
}> {
  const encodedNombre = encodeURIComponent(nombre);
  const response = await fetchAPI<{
    cabecera: HistorialAbastecimientoDB;
    detalles: DetalleAbastecimientoDB[];
  }>(`/api/abastecimiento/detalle/${encodedNombre}`);
  if (!response.data) throw new Error(response.error || 'Error al obtener detalle');
  return response.data;
}

export async function getHistorialAbastecimientoGeneral(): Promise<any[]> {
  const response = await fetchAPI<any[]>('/api/abastecimiento/historial-general');
  return response.data || [];
}
