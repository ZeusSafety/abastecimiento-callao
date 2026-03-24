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
  cantidad_anterior?: number | null;
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
  cantidad_anterior?: number | null;
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

export interface ActaAbastecimientoDB {
  id: number;
  id_abastecimiento: number;
  nombre_imagen: string;
  url_imagen: string;
  fecha_subida: string;
}

// ─── Cascada Movimientos / Actas ─────────────────────────────────────────────
export interface ActaMovimientoDB {
  id: number;
  id_movimiento_entrada: number | null;
  id_movimiento_salida: number | null;
  nombre_imagen: string;
  url_imagen: string;
  codigo_carga: string | null;
  fecha_subida: string;
  registrado_por: string | null;
}

export interface EntradaDetalleCascadaDB {
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
}

export interface SalidaDetalleCascadaDB {
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
}

export interface EntradaCascadaDB {
  codigo_carga: string | null;
  fecha_primera: string;
  cantidad_items: number;
  operador: string | null;
  detalles: EntradaDetalleCascadaDB[];
  actas: ActaMovimientoDB[];
}

export interface SalidaCascadaDB {
  codigo_carga: string | null;
  fecha_primera: string;
  cantidad_items: number;
  asesor: string | null;
  detalles: SalidaDetalleCascadaDB[];
  actas: ActaMovimientoDB[];
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
      const backendMessage =
        (typeof errorData?.error === 'string' && errorData.error) ||
        (typeof errorData?.message === 'string' && errorData.message) ||
        `Error ${response.status}`;
      throw new Error(backendMessage);
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

export async function updateProducto(
  id: number,
  data: {
    cantidad_reg_calculo?: number;
    stock_minimo?: Record<string, number>;
    existencia?: Record<string, number>;
  }
): Promise<void> {
  const response = await fetchAPI(`/api/productos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!response.success) throw new Error(response.error || 'Error al actualizar producto');
}

export async function updateProductosMasivo(
  productos: Array<{
    id: number;
    cantidad_reg_calculo?: number;
    stock_minimo?: Record<string, number>;
  }>
): Promise<{ total: number; ids: number[] }> {
  const response = await fetchAPI<{ total: number; ids: number[] }>('/api/productos/masivo', {
    method: 'PUT',
    body: JSON.stringify({ productos }),
  });
  if (!response.data) throw new Error(response.error || 'Error al actualizar productos');
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

export async function createEntradasMasivo(entradas: Array<{
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
}>,
options?: {
  actas?: Array<{ file: File; nombre: string }>;
  passwordAutorizacion?: string;
}): Promise<{ ids: number[]; total: number; codigo_carga: string }> {
  const formData = new FormData();
  formData.append(
    'data',
    JSON.stringify({
      entradas,
      password_autorizacion: options?.passwordAutorizacion,
    }),
  );

  if (options?.actas && options.actas.length > 0) {
    options.actas.forEach(({ file, nombre }) => {
      // Backend usa file.filename como nombre_imagen, así que renombramos.
      const blob = file.slice(0, file.size, file.type);
      const renamedFile = new File([blob], nombre || file.name, { type: file.type });
      formData.append('actas', renamedFile);
    });
  }

  const response = await fetch(`${API_BASE_URL}/api/entradas/masivo`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
    throw new Error(errorData.error || errorData.message || `Error ${response.status}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || result.message || 'Error al crear entradas');
  }

  return result.data as { ids: number[]; total: number; codigo_carga: string };
}

export async function createSalidasMasivo(salidas: Array<{
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
}>,
options?: {
  actas?: Array<{ file: File; nombre: string }>;
  passwordAutorizacion?: string;
}): Promise<{ ids: number[]; total: number; codigo_carga: string }> {
  const formData = new FormData();
  formData.append(
    'data',
    JSON.stringify({
      salidas,
      password_autorizacion: options?.passwordAutorizacion,
    }),
  );

  if (options?.actas && options.actas.length > 0) {
    options.actas.forEach(({ file, nombre }) => {
      const blob = file.slice(0, file.size, file.type);
      const renamedFile = new File([blob], nombre || file.name, { type: file.type });
      formData.append('actas', renamedFile);
    });
  }

  const response = await fetch(`${API_BASE_URL}/api/salidas/masivo`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
    throw new Error(errorData.error || errorData.message || `Error ${response.status}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || result.message || 'Error al crear salidas');
  }

  return result.data as { ids: number[]; total: number; codigo_carga: string };
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

// Cascada (agrupación por codigo_carga)
export async function getEntradasCascada(): Promise<EntradaCascadaDB[]> {
  const response = await fetchAPI<EntradaCascadaDB[]>('/api/entradas/cascada');
  return response.data || [];
}

export async function getSalidasCascada(): Promise<SalidaCascadaDB[]> {
  const response = await fetchAPI<SalidaCascadaDB[]>('/api/salidas/cascada');
  return response.data || [];
}

// Gestión de actas en movimientos existentes
export async function agregarActaEntrada(
  idEntrada: number,
  actas: Array<{ file: File; nombre: string }>
): Promise<void> {
  const formData = new FormData();
  formData.append('data', JSON.stringify({ id_entrada: idEntrada, nombre_acta: '' }));

  actas.forEach(({ file, nombre }) => {
    const blob = file.slice(0, file.size, file.type);
    const renamedFile = new File([blob], nombre || file.name, { type: file.type });
    formData.append('archivo', renamedFile);
  });

  const response = await fetch(`${API_BASE_URL}/api/actas/entrada`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
    throw new Error(errorData.error || errorData.message || `Error ${response.status}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || result.message || 'Error al agregar acta');
  }
}

export async function agregarActaSalida(
  idSalida: number,
  actas: Array<{ file: File; nombre: string }>
): Promise<void> {
  const formData = new FormData();
  formData.append('data', JSON.stringify({ id_salida: idSalida, nombre_acta: '' }));

  actas.forEach(({ file, nombre }) => {
    const blob = file.slice(0, file.size, file.type);
    const renamedFile = new File([blob], nombre || file.name, { type: file.type });
    formData.append('archivo', renamedFile);
  });

  const response = await fetch(`${API_BASE_URL}/api/actas/salida`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
    throw new Error(errorData.error || errorData.message || `Error ${response.status}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || result.message || 'Error al agregar acta');
  }
}

export async function eliminarActa(idActa: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/actas/${idActa}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(`Error eliminando acta (${response.status})`);
  const result = await response.json().catch(() => null);
  if (result && result.success === false) throw new Error(result.error || result.message || 'Error eliminando acta');
}

export async function actualizarActaNombre(idActa: number, nombreImagen: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/actas/${idActa}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre_imagen: nombreImagen }),
  });
  if (!response.ok) throw new Error(`Error actualizando acta (${response.status})`);
  const result = await response.json().catch(() => null);
  if (result && result.success === false) throw new Error(result.error || result.message || 'Error actualizando acta');
}

// ─── Contraseña dinámica (movimientos) ──────────────────────────────────────
export async function obtenerPasswordMovimientos(): Promise<{ password: string }> {
  const response = await fetchAPI<{ password: string }>('/api/config/password', {
    method: 'GET',
  });
  return response.data || { password: '' };
}

export async function cambiarPasswordMovimientos(
  nuevaContrasena: string,
  actualizadoPor: string
): Promise<void> {
  const response = await fetchAPI('/api/config/password', {
    method: 'PUT',
    body: JSON.stringify({
      nueva_contrasena: nuevaContrasena,
      actualizado_por: actualizadoPor,
    }),
  });
  if (!response.success) {
    throw new Error(response.error || response.message || 'Error al cambiar la contraseña');
  }
}

// Abastecimiento
export async function calcularAbastecimiento(): Promise<AbastecimientoDB[]> {
  const response = await fetchAPI<AbastecimientoDB[]>('/api/abastecimiento/calcular');
  return response.data || [];
}

export async function guardarAbastecimiento(
  data: {
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
    password_autorizacion?: string;
  },
  archivos?: Array<{ file: File; nombre: string }>
): Promise<{ id_abastecimiento: number }> {
  const formData = new FormData();
  
  // Agregar datos JSON como string
  formData.append('data', JSON.stringify(data));
  
  // Agregar archivos si existen
  if (archivos && archivos.length > 0) {
    archivos.forEach(({ file, nombre }) => {
      // Renombrar el archivo antes de agregarlo
      const blob = file.slice(0, file.size, file.type);
      const renamedFile = new File([blob], nombre || file.name, { type: file.type });
      formData.append('actas', renamedFile);
    });
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/abastecimiento/guardar`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
      throw new Error(errorData.error || errorData.message || `Error ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || result.message || 'Error al guardar abastecimiento');
    }
    return result.data || { id_abastecimiento: 0 };
  } catch (error) {
    console.error('Error en guardarAbastecimiento:', error);
    throw error;
  }
}

export async function getActasAbastecimiento(idAbastecimiento: number): Promise<ActaAbastecimientoDB[]> {
  const response = await fetchAPI<ActaAbastecimientoDB[]>(`/api/abastecimiento/actas/${idAbastecimiento}`);
  return response.data || [];
}

export async function subirActasAbastecimiento(
  idAbastecimiento: number,
  archivos: Array<{ file: File; nombre: string }>,
  passwordAutorizacion: string
): Promise<{ id_abastecimiento: number; actas_subidas: Array<{ nombre_imagen: string; url_imagen: string }> }> {
  const formData = new FormData();
  
  // Agregar datos JSON como string
  formData.append('data', JSON.stringify({ password_autorizacion: passwordAutorizacion }));
  
  // Agregar archivos
  if (archivos && archivos.length > 0) {
    archivos.forEach(({ file, nombre }) => {
      const blob = file.slice(0, file.size, file.type);
      const renamedFile = new File([blob], nombre || file.name, { type: file.type });
      formData.append('actas', renamedFile);
    });
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/abastecimiento/actas/${idAbastecimiento}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
      throw new Error(errorData.error || errorData.message || `Error ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || result.message || 'Error al subir actas');
    }
    return result.data || { id_abastecimiento: idAbastecimiento, actas_subidas: [] };
  } catch (error) {
    console.error('Error en subirActasAbastecimiento:', error);
    throw error;
  }
}

export async function cambiarPasswordAbastecimiento(
  passwordAnterior: string,
  passwordNueva: string
): Promise<void> {
  const response = await fetchAPI('/api/configuracion/cambiar-password-abastecimiento', {
    method: 'POST',
    body: JSON.stringify({
      password_anterior: passwordAnterior,
      password_nueva: passwordNueva,
    }),
  });
  if (!response.success) throw new Error(response.error || 'Error al cambiar la contraseña');
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
