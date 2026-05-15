import functions_framework
import pymysql
import json
import requests
import logging
import traceback
import io
from openpyxl import load_workbook
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from google.cloud import storage
from datetime import datetime
import uuid
import hashlib

# 🔧 Conexión a MySQL
def get_connection():
    conn = pymysql.connect(
        user="zeussafety-2024",
        password="ZeusSafety2025",
        db="Zeus_Safety_Data_Integration",
        unix_socket="/cloudsql/stable-smithy-435414-m6:us-central1:zeussafety-2024",
        cursorclass=pymysql.cursors.DictCursor
    )
    # Configurar timezone a Perú (America/Lima)
    cursor = conn.cursor()
    cursor.execute("SET time_zone = '-05:00'")  # UTC-5 para Perú
    cursor.close()
    return conn

## Función de Subida a Cloud Storage
# Variables globales para el cliente y el bucket de GCS
storage_client = storage.Client()
BUCKET_NAME = "archivos_sistema"
GCS_FOLDER = "incidencias_areas_zeus"

def upload_to_gcs(file):
    """
    Sube un archivo a Google Cloud Storage y devuelve la URL pública.
    Args: file: El objeto de archivo multipart/form-data.
    Returns: La URL del archivo subido o None si hay un error.
    """
    try:
        bucket = storage_client.bucket(BUCKET_NAME)
        # La ruta del archivo en el bucket
        object_name = f"{GCS_FOLDER}/{file.filename}"
        blob = bucket.blob(object_name)

        # Sube el archivo directamente
        blob.upload_from_file(file, content_type=file.content_type)
        
        # Genera la URL pública
        gcs_url = f"https://storage.googleapis.com/{BUCKET_NAME}/{object_name}"
        return gcs_url
    except Exception as e:
        print(f"Error al subir a Cloud Storage: {e}")
        return None

# ============================================================
# FUNCIONES DE RESPUESTA ESTÁNDAR (Helpers)
# ============================================================
def success_response(data=None, message="Operación exitosa", headers=None):
    """Respuesta 200 OK exitosa."""
    response = {'success': True, 'message': message}
    if data is not None:
        response['data'] = data
    return (json.dumps(response, default=str, ensure_ascii=False), 200, headers)

def created_response(data=None, message="Recurso creado exitosamente", headers=None):
    """Respuesta 201 Created."""
    response = {'success': True, 'message': message}
    if data is not None:
        response['data'] = data
    return (json.dumps(response, default=str, ensure_ascii=False), 201, headers)

def not_found_error(message="Recurso no encontrado", headers=None):
    """Respuesta 404 Not Found."""
    return (json.dumps({'success': False, 'error': message}), 404, headers)

def server_error(message="Error interno del servidor", headers=None):
    """Respuesta 500 Internal Server Error."""
    return (json.dumps({'success': False, 'error': message}), 500, headers)

def bad_request_error(message="Solicitud incorrecta", headers=None):
    """Respuesta 400 Bad Request."""
    return (json.dumps({'success': False, 'error': message}), 400, headers)

# ============================================================
# HELPERS DE ACTAS
# ============================================================
def _obtener_actas_por_movimiento(cursor, *, id_entrada=None, id_salida=None, id_traslado=None):
    """
    Devuelve listado de actas para un movimiento específico (entrada/salida/traslado).
    Formato: [{id, nombre_imagen, url_imagen, codigo_carga}, ...]
    """
    filtros = []
    params = []
    if id_entrada is not None:
        filtros.append("id_movimiento_entrada = %s")
        params.append(id_entrada)
    if id_salida is not None:
        filtros.append("id_movimiento_salida = %s")
        params.append(id_salida)
    if id_traslado is not None:
        filtros.append("id_movimiento_traslado = %s")
        params.append(id_traslado)

    if len(filtros) != 1:
        raise ValueError("Debe indicarse exactamente un tipo de movimiento (entrada/salida/traslado)")

    sql = f"""
        SELECT id, nombre_imagen, url_imagen, codigo_carga
        FROM movimientos_actas_callao
        WHERE {filtros[0]}
        ORDER BY id ASC
    """
    cursor.execute(sql, tuple(params))
    return cursor.fetchall()

def _actas_payload(cursor, *, id_entrada=None, id_salida=None, id_traslado=None):
    """Arma payload consistente para frontend: actas[], total_actas, actas_urls (string CSV)."""
    actas = _obtener_actas_por_movimiento(
        cursor,
        id_entrada=id_entrada,
        id_salida=id_salida,
        id_traslado=id_traslado,
    )
    urls = [a.get('url_imagen') for a in actas if a.get('url_imagen')]
    return {
        'actas': actas,
        'total_actas': len(actas),
        'actas_urls': ",".join(urls)
    }

# ============================================================
# FUNCIONES AUXILIARES
# ============================================================
def _get_id_tienda_por_nombre_o_codigo(nombre_o_codigo, conn):
    """
    Resuelve id_tienda por código o nombre (insensible a mayúsculas).
    Alias MALVINAS / ALMACEN MALVINAS y CALLAO / ALMACEN CALLAO por catálogos o datos históricos.
    """
    if nombre_o_codigo is None:
        return None
    raw = str(nombre_o_codigo).strip()
    if not raw:
        return None

    u = raw.upper()
    variants = []
    seen = set()

    def add(v):
        if not v:
            return
        s = str(v).strip()
        if not s:
            return
        key = s.upper()
        if key not in seen:
            seen.add(key)
            variants.append(s)

    add(raw)
    if u in ('CALLAO', 'ALMACEN CALLAO'):
        for x in ('MALVINAS', 'CALLAO', 'ALMACEN MALVINAS', 'ALMACEN CALLAO'):
            add(x)
    elif u == 'MALVINAS':
        for x in ('MALVINAS', 'ALMACEN MALVINAS', 'CALLAO', 'ALMACEN CALLAO'):
            add(x)
    elif u == 'ALMACEN MALVINAS':
        for x in ('ALMACEN MALVINAS', 'MALVINAS', 'CALLAO'):
            add(x)
    elif u == '3006':
        add('OFICINA')
    elif u == '3131':
        add('CALLAO-1')
    elif u == '412-A':
        add('CALLAO-2')

    cursor = conn.cursor()
    try:
        sql_ci = (
            "SELECT id FROM tiendas_gestion_sea_callao "
            "WHERE UPPER(TRIM(COALESCE(codigo,''))) = UPPER(TRIM(%s)) "
            "   OR UPPER(TRIM(COALESCE(nombre,''))) = UPPER(TRIM(%s)) "
            "LIMIT 1"
        )
        for v in variants:
            cursor.execute(sql_ci, (v, v))
            row = cursor.fetchone()
            if row:
                return row['id']
        return None
    finally:
        cursor.close()

def _get_id_unidad_medida_por_nombre(nombre_um, conn):
    """Obtiene el ID de una unidad de medida por su nombre (insensible a mayúsculas)."""
    if not nombre_um:
        return None
    nm = str(nombre_um).strip()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT id FROM unidades_medida_sea_callao WHERE UPPER(TRIM(nombre)) = UPPER(TRIM(%s)) LIMIT 1",
            (nm,),
        )
        row = cursor.fetchone()
        return row['id'] if row else None
    finally:
        cursor.close()

def _get_id_tipo_operacion_por_nombre_y_tipo(nombre_operacion, tipo, conn):
    """Obtiene el ID de un tipo de operación por su nombre y tipo (ENTRADA/SALIDA)."""
    cursor = conn.cursor()
    sql = "SELECT id FROM tipos_operacion_sea_callao WHERE nombre = %s AND tipo = %s"
    cursor.execute(sql, (nombre_operacion.upper(), tipo))
    result = cursor.fetchone()
    cursor.close()
    return result['id'] if result else None


def _drenar_resultados_callproc(cursor):
    """
    Tras cursor.callproc(), PyMySQL puede dejar result sets sin leer.
    Si no se consumen, el siguiente execute en el mismo cursor falla (p. ej. en lotes masivos).
    """
    try:
        while cursor.nextset():
            pass
    except Exception:
        pass


def _extraer_id_movimiento_generado(result_set):
    """Obtiene el id devuelto por sp_registrar_entrada_callao / sp_registrar_salida_callao (DictCursor)."""
    if not result_set:
        return None
    row = result_set[0]
    if not isinstance(row, dict):
        return None
    for key in ("id_movimiento_generado", "ID_MOVIMIENTO_GENERADO"):
        if key in row and row[key] is not None:
            return row[key]
    if len(row) == 1:
        v = next(iter(row.values()))
        return v if v is not None else None
    return None


def _resolver_id_movimiento_despues_sp(cursor, result_set):
    """
    Si el SP no hace SELECT final con id_movimiento_generado (muy habitual), fetchall() viene vacío.
    Tras drenar resultados del callproc, LAST_INSERT_ID() devuelve el AUTO_INCREMENT del INSERT del SP en esta conexión.
    Llamar solo después de fetchall() + _drenar_resultados_callproc(cursor).
    """
    nid = _extraer_id_movimiento_generado(result_set)
    if nid is not None:
        try:
            i = int(nid)
            if i > 0:
                return i
        except (TypeError, ValueError):
            pass
    try:
        cursor.execute("SELECT LAST_INSERT_ID() AS lid")
        row = cursor.fetchone()
        if row:
            for v in row.values():
                if v is not None:
                    try:
                        i = int(v)
                        if i > 0:
                            return i
                    except (TypeError, ValueError):
                        pass
    except Exception as e:
        logging.warning("LAST_INSERT_ID tras SP: %s", e)
    return None


def _generar_codigo_carga():
    """Genera un código único para agrupar cargas masivas."""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    random_suffix = str(uuid.uuid4())[:8].upper()
    return f"CG{timestamp}{random_suffix}"


def _tabla_tiene_columna(cursor, nombre_tabla, nombre_columna):
    """Valida si una tabla posee una columna (compatibilidad con despliegues antiguos)."""
    cursor.execute(
        """
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = %s
          AND COLUMN_NAME = %s
        LIMIT 1
        """,
        (nombre_tabla, nombre_columna),
    )
    return cursor.fetchone() is not None


def _asignar_codigo_carga_entrada_si_existe_columna(cursor, id_movimiento, codigo_carga):
    """Persiste codigo_carga en movimientos_entrada_callao cuando la columna existe."""
    if not codigo_carga or not id_movimiento:
        return
    if not _tabla_tiene_columna(cursor, 'movimientos_entrada_callao', 'codigo_carga'):
        return
    cursor.execute(
        "UPDATE movimientos_entrada_callao SET codigo_carga = %s WHERE id = %s",
        (codigo_carga, id_movimiento),
    )


def _asignar_codigo_carga_salida_si_existe_columna(cursor, id_movimiento, codigo_carga):
    """Persiste codigo_carga en movimientos_salida_callao cuando la columna existe."""
    if not codigo_carga or not id_movimiento:
        return
    if not _tabla_tiene_columna(cursor, 'movimientos_salida_callao', 'codigo_carga'):
        return
    cursor.execute(
        "UPDATE movimientos_salida_callao SET codigo_carga = %s WHERE id = %s",
        (codigo_carga, id_movimiento),
    )


def _asignar_codigo_carga_traslado_si_existe_columna(cursor, id_movimiento, codigo_carga):
    """Persiste codigo_carga en movimientos_traslado_callao cuando la columna existe."""
    if not codigo_carga or not id_movimiento:
        return
    if not _tabla_tiene_columna(cursor, 'movimientos_traslado_callao', 'codigo_carga'):
        return
    cursor.execute(
        "UPDATE movimientos_traslado_callao SET codigo_carga = %s WHERE id = %s",
        (codigo_carga, id_movimiento),
    )


def _asegurar_columna_codigo_carga(cursor, nombre_tabla, nombre_indice):
    """Asegura columna codigo_carga para agrupar operaciones masivas en cascada."""
    if _tabla_tiene_columna(cursor, nombre_tabla, 'codigo_carga'):
        return
    cursor.execute(
        f"ALTER TABLE {nombre_tabla} ADD COLUMN codigo_carga VARCHAR(50) NULL"
    )
    cursor.execute(
        f"CREATE INDEX {nombre_indice} ON {nombre_tabla} (codigo_carga)"
    )


def _password_efectiva_actas_abastecimiento(cursor):
    """
    Contraseña válida para subir actas vinculadas a un abastecimiento guardado.
    Prioridad: pass_abastecimiento_sin_acta (si existe y no está vacía);
    si no, pass_movimiento_sin_acta (la misma que entradas/salidas y gestión credencial).
    """
    cursor.execute(
        "SELECT valor FROM configuracion_sistema_callao WHERE clave = 'pass_abastecimiento_sin_acta'"
    )
    row = cursor.fetchone()
    v = (row.get('valor') or "").strip() if row else ""
    if v:
        return v
    cursor.execute(
        "SELECT valor FROM configuracion_sistema_callao WHERE clave = 'pass_movimiento_sin_acta'"
    )
    row2 = cursor.fetchone()
    return (row2.get("valor") or "").strip() if row2 else ""


def _codigo_carga_desde_actas_entrada(cursor, id_entrada):
    """Último codigo_carga en actas de la entrada; si no hay, genera uno nuevo."""
    cursor.execute(
        """SELECT codigo_carga FROM movimientos_actas_callao
           WHERE id_movimiento_entrada = %s AND codigo_carga IS NOT NULL
             AND CHAR_LENGTH(TRIM(codigo_carga)) > 0
           ORDER BY fecha_subida DESC LIMIT 1""",
        (id_entrada,),
    )
    row = cursor.fetchone()
    if row and row.get('codigo_carga'):
        return row['codigo_carga']
    return _generar_codigo_carga()

def _codigo_carga_desde_actas_salida(cursor, id_salida):
    """Último codigo_carga en actas de la salida; si no hay, genera uno nuevo."""
    cursor.execute(
        """SELECT codigo_carga FROM movimientos_actas_callao
           WHERE id_movimiento_salida = %s AND codigo_carga IS NOT NULL
             AND CHAR_LENGTH(TRIM(codigo_carga)) > 0
           ORDER BY fecha_subida DESC LIMIT 1""",
        (id_salida,),
    )
    row = cursor.fetchone()
    if row and row.get('codigo_carga'):
        return row['codigo_carga']
    return _generar_codigo_carga()

def _codigo_carga_desde_actas_traslado(cursor, id_traslado):
    """Último codigo_carga en actas del traslado; si no hay, genera uno nuevo."""
    cursor.execute(
        """SELECT codigo_carga FROM movimientos_actas_callao
           WHERE id_movimiento_traslado = %s AND codigo_carga IS NOT NULL
             AND CHAR_LENGTH(TRIM(codigo_carga)) > 0
           ORDER BY fecha_subida DESC LIMIT 1""",
        (id_traslado,),
    )
    row = cursor.fetchone()
    if row and row.get('codigo_carga'):
        return row['codigo_carga']
    return _generar_codigo_carga()

def _obtener_contrasena_sistema(conn):
    """Obtiene la contraseña actual del sistema de configuración."""
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT valor FROM configuracion_sistema_callao WHERE clave = 'pass_movimiento_sin_acta'")
        result = cursor.fetchone()
        return result['valor'] if result else None
    finally:
        cursor.close()

def _actualizar_contrasena_sistema(conn, nueva_contrasena, actualizado_por):
    """Actualiza la contraseña del sistema."""
    cursor = conn.cursor()
    try:
        sql = "UPDATE configuracion_sistema_callao SET valor = %s, actualizado_por = %s WHERE clave = 'pass_movimiento_sin_acta'"
        cursor.execute(sql, (nueva_contrasena, actualizado_por))
        conn.commit()
        return True
    except Exception as e:
        logging.error(f"Error actualizando contraseña: {str(e)}")
        return False
    finally:
        cursor.close()

def _get_id_producto_por_codigo_o_nombre(codigo_o_nombre, conn):
    """Obtiene el ID de un producto por su código o nombre exacto."""
    cursor = conn.cursor()
    sql = "SELECT id FROM productos_abastecimiento_callao WHERE codigo = %s OR nombre = %s"
    cursor.execute(sql, (codigo_o_nombre, codigo_o_nombre))
    result = cursor.fetchone()
    cursor.close()
    return result['id'] if result else None

def _get_existencia_producto_tienda(id_producto: int, id_tienda: int, conn) -> int:
    """Obtiene la existencia actual de un producto en una tienda. Si no hay registro, retorna 0."""
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT cantidad FROM existencias_almacen_callao WHERE id_producto = %s AND id_tienda = %s",
            (id_producto, id_tienda)
        )
        row = cursor.fetchone()
        return row['cantidad'] if row and row['cantidad'] is not None else 0
    finally:
        cursor.close()


def _asegurar_fila_existencia(cursor, id_producto, id_tienda):
    """
    Crea (id_producto, id_tienda) en existencias con cantidad 0 si no existe.

    sp_registrar_entrada_callao / sp_registrar_salida_callao hacen:
        SELECT IFNULL(cantidad, 0) INTO v_cant_anterior FROM existencias_almacen_callao WHERE ...
    En MySQL, si **no hay fila**, SELECT...INTO **no asigna** y v_cant_anterior queda NULL →
    INSERT movimientos_* falla con: Column 'cantidad_anterior' cannot be null (1048).
    """
    cursor.execute(
        """INSERT INTO existencias_almacen_callao (id_producto, id_tienda, cantidad)
           VALUES (%s, %s, 0)
           ON DUPLICATE KEY UPDATE cantidad = cantidad""",
        (id_producto, id_tienda),
    )


_CODIGO_TIENDA_OFICINA_DOCENAS = 'OFICINA-DOCENAS'


def _get_codigo_tienda_por_id(cursor, id_tienda):
    """Código de tienda/almacén (ej. OFICINA, OFICINA-DOCENAS) a partir de su id."""
    if not id_tienda:
        return None
    cursor.execute(
        "SELECT UPPER(TRIM(codigo)) AS codigo FROM tiendas_gestion_sea_callao WHERE id = %s LIMIT 1",
        (id_tienda,),
    )
    row = cursor.fetchone()
    return row['codigo'] if row and row.get('codigo') else None


def _aplicar_conversion_traslado_oficina_docenas(
    cursor, producto_id, cantidad, um_id, tienda_salida_id, tienda_ingreso_id
):
    """
    Traslados hacia OFICINA-DOCENAS desde almacenes que operan en CAJAS:
    convierte cantidad (cajas) × cantidad_reg_calculo y usa id_unidad_medida_info.

    Retorna (cantidad_destino, id_unidad_medida_destino, cantidad_cajas_origen).
    cantidad_cajas_origen se usa para descontar stock en la tienda de salida (sigue en cajas).
    """
    try:
        cantidad_in = int(cantidad or 0)
    except (TypeError, ValueError):
        cantidad_in = 0

    cantidad_cajas_origen = cantidad_in
    cantidad_out = cantidad_in
    um_out = um_id

    if _get_codigo_tienda_por_id(cursor, tienda_ingreso_id) != _CODIGO_TIENDA_OFICINA_DOCENAS:
        return cantidad_out, um_out, cantidad_cajas_origen

    if _get_codigo_tienda_por_id(cursor, tienda_salida_id) == _CODIGO_TIENDA_OFICINA_DOCENAS:
        return cantidad_out, um_out, cantidad_cajas_origen

    cursor.execute(
        """
        SELECT cantidad_reg_calculo, id_unidad_medida_info, id_unidad_medida_reg
        FROM productos_abastecimiento_callao
        WHERE id = %s
        """,
        (producto_id,),
    )
    prod = cursor.fetchone()
    if not prod:
        return cantidad_out, um_out, cantidad_cajas_origen

    um_info_id = prod.get('id_unidad_medida_info')
    um_reg_id = prod.get('id_unidad_medida_reg')

    # Ya registrado en la UM nativa del almacén OFICINA-DOCENAS (info del producto).
    if um_id is not None and um_info_id is not None and int(um_id) == int(um_info_id):
        return cantidad_out, um_out, cantidad_cajas_origen

    factor = int(prod.get('cantidad_reg_calculo') or 0)
    if factor <= 0:
        factor = 1

    # Origen en cajas (UM registro / CAJAS) → unidades del producto en OFICINA-DOCENAS.
    cantidad_out = cantidad_in * factor
    um_out = um_info_id if um_info_id is not None else um_id

    logging.info(
        "Traslado a OFICINA-DOCENAS: producto=%s, %s caja(s) × %s → %s (um_id %s → %s)",
        producto_id, cantidad_in, factor, cantidad_out, um_id, um_out,
    )
    return cantidad_out, um_out, cantidad_cajas_origen


def _ejecutar_sp_con_transaccion(conn, sp_call, params):
    """Ejecuta un Stored Procedure y maneja commit/rollback."""
    cursor = conn.cursor()
    try:
        logging.info(f"Ejecutando SP: {sp_call} con parámetros: {params}")
        cursor.callproc(sp_call, params)
        conn.commit()

        # Obtener resultados si es un SELECT o un OUT parameter
        result_set = cursor.fetchall()
        # Para SPs con OUT params, necesitas otro approach.
        # Por simplicidad, si el SP hace un SELECT, lo retornamos.
        # También se puede modificar el SP para que siempre tenga un SELECT final.
        return True, "Operación exitosa", result_set
    except Exception as e:
        conn.rollback()
        logging.error(f"Error ejecutando SP {sp_call}: {traceback.format_exc()}")
        return False, str(e), None
    finally:
        cursor.close()

# ============================================================
# IMPLEMENTACIÓN DE LOS ENDPOINTS (LÓGICA DE NEGOCIO)
# ============================================================

# --- MÓDULO TIENDAS ---
def get_tiendas(request, headers):
    """Obtiene la lista de tiendas/almacenes."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, codigo, nombre, es_almacen FROM tiendas_gestion_sea_callao WHERE activo = 1")
        tiendas = cursor.fetchall()
        return success_response(data=tiendas, message="Tiendas obtenidas correctamente", headers=headers)
    finally:
        cursor.close()
        conn.close()

# --- MÓDULO UNIDADES DE MEDIDA ---
def get_unidades_medida(request, headers):
    """Obtiene la lista de unidades de medida."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, nombre FROM unidades_medida_sea_callao")
        unidades = cursor.fetchall()
        return success_response(data=unidades, message="Unidades obtenidas correctamente", headers=headers)
    finally:
        cursor.close()
        conn.close()

# --- MÓDULO TIPOS DE OPERACIÓN ---
def get_tipos_operacion(tipo_operacion, headers):
    """Obtiene los tipos de operación filtrados por tipo (ENTRADA/SALIDA/TRASLADO)."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        sql = "SELECT id, nombre FROM tipos_operacion_sea_callao WHERE tipo = %s"
        cursor.execute(sql, (tipo_operacion,))
        tipos = cursor.fetchall()
        return success_response(data=tipos, message="Tipos de operación obtenidos correctamente", headers=headers)
    finally:
        cursor.close()
        conn.close()

# --- MÓDULO PRODUCTOS ---
def get_productos(request, headers):
    """Obtiene el listado de productos. Puede tener filtro por ?activo=1 o todos."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        activo = request.args.get('activo', '1')
        if activo == '1':
            cursor.execute("SELECT * FROM productos_abastecimiento_callao WHERE activo = 1")
        else:
            cursor.execute("SELECT * FROM productos_abastecimiento_callao")
        productos = cursor.fetchall()
        return success_response(data=productos, message="Productos obtenidos correctamente", headers=headers)
    finally:
        cursor.close()
        conn.close()

def create_producto(request, headers):
    """Crea un nuevo producto en el catálogo."""
    data = request.get_json()
    if not data:
        return bad_request_error("Datos JSON inválidos", headers)

    # Extraer datos
    codigo = data.get('codigo')
    nombre = data.get('nombre')
    cantidad_en_caja = data.get('cantidad_en_caja')
    id_unidad_medida_info = data.get('id_unidad_medida_info')
    cantidad_unidades_caja = data.get('cantidad_unidades_caja')
    cantidad_reg_calculo = data.get('cantidad_reg_calculo')
    id_unidad_medida_reg = data.get('id_unidad_medida_reg')

    if not all([codigo, nombre, id_unidad_medida_info, id_unidad_medida_reg]):
        return bad_request_error("Faltan campos requeridos (codigo, nombre, id_unidad_medida_info, id_unidad_medida_reg)", headers)

    conn = get_connection()
    cursor = conn.cursor()
    try:
        sql = """INSERT INTO productos_abastecimiento_callao 
                 (codigo, nombre, cantidad_en_caja, id_unidad_medida_info, cantidad_unidades_caja, cantidad_reg_calculo, id_unidad_medida_reg)
                 VALUES (%s, %s, %s, %s, %s, %s, %s)"""
        cursor.execute(sql, (codigo, nombre, cantidad_en_caja, id_unidad_medida_info, cantidad_unidades_caja, cantidad_reg_calculo, id_unidad_medida_reg))
        conn.commit()
        nuevo_id = cursor.lastrowid
        return created_response(data={'id': nuevo_id, 'codigo': codigo, 'nombre': nombre}, message="Producto creado exitosamente", headers=headers)
    except pymysql.IntegrityError as e:
        conn.rollback()
        if "Duplicate entry" in str(e):
            return bad_request_error(f"El código '{codigo}' ya existe.", headers)
        else:
            raise e
    finally:
        cursor.close()
        conn.close()

def update_producto(request, headers, producto_id):
    """Actualiza un producto: cantidad_reg_calculo, stock_minimo y existencia por tienda - almacen."""
    data = request.get_json()
    if not data:
        return bad_request_error("Datos JSON inválidos", headers)

    conn = get_connection()
    cursor = conn.cursor()
    try:
        _codigos_tienda_stock = frozenset({'OFICINA', 'OFICINA-DOCENAS', 'CALLAO-1-A', 'CALLAO-1-B', 'CALLAO-2'})

        # Verificar que el producto existe
        cursor.execute("SELECT id FROM productos_abastecimiento_callao WHERE id = %s", (producto_id,))
        if not cursor.fetchone():
            return not_found_error(f"Producto con ID {producto_id} no encontrado", headers)

        # Actualizar cantidad_reg_calculo si viene en los datos
        if 'cantidad_reg_calculo' in data:
            cursor.execute(
                "UPDATE productos_abastecimiento_callao SET cantidad_reg_calculo = %s WHERE id = %s",
                (data['cantidad_reg_calculo'], producto_id)
            )

        # Actualizar stock_minimo por tienda
        if 'stock_minimo' in data:
            stock_minimo = data['stock_minimo']
            
            for codigo_tienda, valor in stock_minimo.items():
                if codigo_tienda in _codigos_tienda_stock:
                    # Obtener ID de tienda
                    cursor.execute("SELECT id FROM tiendas_gestion_sea_callao WHERE codigo = %s", (codigo_tienda,))
                    tienda_row = cursor.fetchone()
                    if tienda_row:
                        id_tienda = tienda_row['id']
                        # Verificar si existe registro
                        cursor.execute(
                            "SELECT id FROM stock_minimo_almacen_callao WHERE id_producto = %s AND id_tienda = %s",
                            (producto_id, id_tienda)
                        )
                        existe = cursor.fetchone()
                        if existe:
                            # Actualizar
                            cursor.execute(
                                "UPDATE stock_minimo_almacen_callao SET stock_minimo = %s WHERE id_producto = %s AND id_tienda = %s",
                                (valor or 0, producto_id, id_tienda)
                            )
                        else:
                            # Insertar
                            cursor.execute(
                                "INSERT INTO stock_minimo_almacen_callao (id_producto, id_tienda, stock_minimo) VALUES (%s, %s, %s)",
                                (producto_id, id_tienda, valor or 0)
                            )

        # Actualizar existencia por tienda
        if 'existencia' in data:
            existencia = data['existencia']
            for codigo_tienda, valor in existencia.items():
                if codigo_tienda in _codigos_tienda_stock:
                    # Obtener ID de tienda
                    cursor.execute("SELECT id FROM tiendas_gestion_sea_callao WHERE codigo = %s", (codigo_tienda,))
                    tienda_row = cursor.fetchone()
                    if tienda_row:
                        id_tienda = tienda_row['id']
                        # Verificar si existe registro
                        cursor.execute(
                            "SELECT id FROM existencias_almacen_callao WHERE id_producto = %s AND id_tienda = %s",
                            (producto_id, id_tienda)
                        )
                        existe = cursor.fetchone()
                        if existe:
                            # Actualizar
                            cursor.execute(
                                "UPDATE existencias_almacen_callao SET cantidad = %s WHERE id_producto = %s AND id_tienda = %s",
                                (valor or 0, producto_id, id_tienda)
                            )
                        else:
                            # Insertar
                            cursor.execute(
                                "INSERT INTO existencias_almacen_callao (id_producto, id_tienda, cantidad) VALUES (%s, %s, %s)",
                                (producto_id, id_tienda, valor or 0)
                            )

        conn.commit()
        return success_response(message="Producto actualizado exitosamente", headers=headers)
    except Exception as e:
        conn.rollback()
        logging.error(f"Error actualizando producto: {traceback.format_exc()}")
        return server_error(f"Error actualizando producto: {str(e)}", headers)
    finally:
        cursor.close()
        conn.close()


def update_productos_masivo(request, headers):
    """
    Actualiza productos en lote (1 request / 1 transacción).
    Solo permite actualizar: cantidad_reg_calculo y stock_minimo por tienda.
    NOTA: existencia se actualiza únicamente con entradas/salidas.
    """
    data = request.get_json()
    if not data or 'productos' not in data or not isinstance(data['productos'], list):
        return bad_request_error("Se requiere JSON con { productos: [...] }", headers)

    productos = data['productos']
    if len(productos) == 0:
        return bad_request_error("La lista 'productos' está vacía", headers)

    _codigos_tienda_stock = frozenset({'OFICINA', 'OFICINA-DOCENAS', 'CALLAO-1-A', 'CALLAO-1-B', 'CALLAO-2'})

    conn = get_connection()
    cursor = conn.cursor()
    try:
        errores = []
        ids_actualizados = []

        for idx, item in enumerate(productos):
            if not isinstance(item, dict):
                errores.append(f"Item #{idx + 1}: formato inválido (se esperaba objeto)")
                continue

            producto_id = item.get('id')
            if producto_id is None or not str(producto_id).isdigit():
                errores.append(f"Item #{idx + 1}: 'id' inválido")
                continue

            producto_id = int(producto_id)

            # Verificar que el producto existe
            cursor.execute("SELECT id FROM productos_abastecimiento_callao WHERE id = %s", (producto_id,))
            if not cursor.fetchone():
                errores.append(f"Item #{idx + 1}: producto con ID {producto_id} no encontrado")
                continue

            # cantidad_reg_calculo
            if 'cantidad_reg_calculo' in item:
                cursor.execute(
                    "UPDATE productos_abastecimiento_callao SET cantidad_reg_calculo = %s WHERE id = %s",
                    (item.get('cantidad_reg_calculo'), producto_id)
                )

            # stock_minimo
            if 'stock_minimo' in item and isinstance(item.get('stock_minimo'), dict):
                for codigo_tienda, valor in item['stock_minimo'].items():
                    if codigo_tienda in _codigos_tienda_stock:
                        cursor.execute("SELECT id FROM tiendas_gestion_sea_callao WHERE codigo = %s", (codigo_tienda,))
                        tienda_row = cursor.fetchone()
                        if not tienda_row:
                            continue
                        id_tienda = tienda_row['id']

                        cursor.execute(
                            "SELECT id FROM stock_minimo_almacen_callao WHERE id_producto = %s AND id_tienda = %s",
                            (producto_id, id_tienda)
                        )
                        existe = cursor.fetchone()
                        if existe:
                            cursor.execute(
                                "UPDATE stock_minimo_almacen_callao SET stock_minimo = %s WHERE id_producto = %s AND id_tienda = %s",
                                (valor or 0, producto_id, id_tienda)
                            )
                        else:
                            cursor.execute(
                                "INSERT INTO stock_minimo_almacen_callao (id_producto, id_tienda, stock_minimo) VALUES (%s, %s, %s)",
                                (producto_id, id_tienda, valor or 0)
                            )

            # existencia: ignorada a propósito
            ids_actualizados.append(producto_id)

        if errores:
            conn.rollback()
            return bad_request_error(f"Errores al actualizar productos: {'; '.join(errores)}", headers)

        conn.commit()
        return success_response(
            data={'total': len(ids_actualizados), 'ids': ids_actualizados},
            message="Productos actualizados exitosamente",
            headers=headers
        )
    except Exception as e:
        conn.rollback()
        logging.error(f"Error en update_productos_masivo: {traceback.format_exc()}")
        return server_error(f"Error actualizando productos: {str(e)}", headers)
    finally:
        cursor.close()
        conn.close()

# --- MÓDULO ENTRADAS ---
def get_entradas(request, headers):
    """Obtiene el listado de movimientos de entrada."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Una consulta más amigable que muestre nombres en lugar de IDs
        sql = """
            SELECT 
                me.id, me.fecha_registro, 
                p.codigo as producto_codigo, p.nombre as producto_nombre,
                tos.nombre as operacion,
                ts.codigo as tienda_salida_codigo, ts.nombre as tienda_salida_nombre,
                ti.codigo as tienda_ingreso_codigo, ti.nombre as tienda_ingreso_nombre,
                me.operador, me.cantidad, um.nombre as unidad_medida,
                me.entregado_por, me.registrado_por, me.observaciones,
                me.fecha_actualizacion, me.motivo_cambio,
                COUNT(mea.id) as total_actas,
                GROUP_CONCAT(mea.url_imagen SEPARATOR ',') as actas_urls
            FROM movimientos_entrada_callao me
            LEFT JOIN movimientos_actas_callao mea ON me.id = mea.id_movimiento_entrada
            JOIN productos_abastecimiento_callao p ON me.id_producto = p.id
            JOIN tipos_operacion_sea_callao tos ON me.id_tipo_operacion = tos.id
            JOIN tiendas_gestion_sea_callao ts ON me.id_tienda_salida = ts.id
            JOIN tiendas_gestion_sea_callao ti ON me.id_tienda_ingreso = ti.id
            JOIN unidades_medida_sea_callao um ON me.id_unidad_medida = um.id
            GROUP BY me.id
            ORDER BY me.fecha_registro DESC
        """
        cursor.execute(sql)
        entradas = cursor.fetchall()
        return success_response(data=entradas, message="Entradas obtenidas correctamente", headers=headers)
    finally:
        cursor.close()
        conn.close()

def create_entrada(request, headers):
    """Registra entrada con soporte de actas e imágenes."""
    # 1. Obtener datos del FormData
    form_data = request.form.get('data')
    if not form_data:
        return bad_request_error("Faltan datos en la petición", headers)
    
    data = json.loads(form_data)
    files = request.files.getlist('actas')
    password_cliente = data.get('password_autorizacion')

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # --- VALIDACIÓN DE CONTRASEÑA DINÁMICA ---
        if not files or len(files) == 0:
            # Para movimientos (entradas/salidas) usamos la clave dinámica del sistema.
            pass_sistema = _obtener_contrasena_sistema(conn)
            if not password_cliente or password_cliente != pass_sistema:
                return (json.dumps({"message": "Se requiere una contraseña válida para guardar sin actas"}), 403, headers)


        # Convertir nombres/códigos a IDs
        producto_id = _get_id_producto_por_codigo_o_nombre(data.get('producto'), conn)
        if not producto_id:
            return bad_request_error("Producto no encontrado", headers)

        tipo_op_id = _get_id_tipo_operacion_por_nombre_y_tipo(data.get('operacion'), 'ENTRADA', conn)
        if not tipo_op_id:
            return bad_request_error(f"Tipo de operación '{data.get('operacion')}' para ENTRADA no válido", headers)

        tienda_salida_id = _get_id_tienda_por_nombre_o_codigo(data.get('almacen_salida'), conn)
        if not tienda_salida_id:
            return bad_request_error(f"Almacén/Tienda de salida '{data.get('almacen_salida')}' no encontrado", headers)

        tienda_ingreso_id = _get_id_tienda_por_nombre_o_codigo(data.get('almacen_ingreso'), conn)
        if not tienda_ingreso_id:
            return bad_request_error(f"Tienda de ingreso '{data.get('almacen_ingreso')}' no encontrada", headers)

        um_id = _get_id_unidad_medida_por_nombre(data.get('unidad_medida'), conn)
        if not um_id:
            return bad_request_error(f"Unidad de medida '{data.get('unidad_medida')}' no válida", headers)

        if not all([producto_id, tipo_op_id, tienda_salida_id, tienda_ingreso_id, um_id]):
            return bad_request_error("Uno o más parámetros (producto, tienda, etc.) son inválidos", headers)

        # Verificar si la tienda de salida es un almacén o una tienda (reutilizar el mismo cursor)
        cursor.execute("SELECT es_almacen FROM tiendas_gestion_sea_callao WHERE id = %s", (tienda_salida_id,))
        tienda_salida_info = cursor.fetchone()
        es_almacen_salida = tienda_salida_info['es_almacen'] if tienda_salida_info else 1

        # Fila en existencias para tienda de INGRESO: sin ella el SP deja v_cant_anterior NULL (MySQL INTO sin filas).
        _asegurar_fila_existencia(cursor, producto_id, tienda_ingreso_id)

        # Llamar al SP manualmente para mantener control de la transacción
        params = [
            producto_id, tipo_op_id, tienda_salida_id, tienda_ingreso_id,
            data.get('operador'), data.get('cantidad'), um_id,
            data.get('entregado_por'), data.get('registrado_por'), data.get('observaciones')
        ]
        try:
            logging.info(f"Ejecutando SP: sp_registrar_entrada_callao con parámetros: {params}")
            cursor.callproc('sp_registrar_entrada_callao', params)
            result_set = cursor.fetchall()
            _drenar_resultados_callproc(cursor)
            nuevo_id = _resolver_id_movimiento_despues_sp(cursor, result_set)

            if not nuevo_id:
                raise Exception("No se pudo obtener id del movimiento (ni resultado del SP ni LAST_INSERT_ID)")

            # cantidad_anterior la calcula el SP (stock en tienda ingreso antes del movimiento); no sobrescribir.

            # Si la tienda de salida NO es un almacén (es una tienda), restar del stock
            if not es_almacen_salida:
                cantidad = data.get('cantidad', 0)
                _asegurar_fila_existencia(cursor, producto_id, tienda_salida_id)
                cursor.execute(
                    "SELECT id, cantidad FROM existencias_almacen_callao WHERE id_producto = %s AND id_tienda = %s",
                    (producto_id, tienda_salida_id)
                )
                existencia_row = cursor.fetchone()

                if existencia_row:
                    nueva_cantidad = max(0, (existencia_row['cantidad'] or 0) - cantidad)
                    cursor.execute(
                        "UPDATE existencias_almacen_callao SET cantidad = %s WHERE id_producto = %s AND id_tienda = %s",
                        (nueva_cantidad, producto_id, tienda_salida_id)
                    )
                else:
                    cursor.execute(
                        "INSERT INTO existencias_almacen_callao (id_producto, id_tienda, cantidad) VALUES (%s, %s, %s)",
                        (producto_id, tienda_salida_id, 0)
                    )

            # --- GUARDAR ACTAS EN GCS Y BD ---
            if files:
                for file in files:
                    url_publica = upload_to_gcs(file)
                    cursor.execute("""
                        INSERT INTO movimientos_actas_callao (id_movimiento_entrada, nombre_imagen, url_imagen) 
                        VALUES (%s, %s, %s)
                    """, (nuevo_id, file.filename, url_publica))

            conn.commit()
            return created_response(data={'id': nuevo_id}, message="Entrada registrada con actas", headers=headers)

        except Exception as e:
            conn.rollback()
            logging.error(f"Error ejecutando entrada: {traceback.format_exc()}")
            return server_error(f"Error al registrar entrada: {str(e)}", headers)
    finally:
        cursor.close()
        conn.close()

def create_entradas_masivo(request, headers):
    """
    Registra múltiples entradas en una sola transacción.
    Ahora soporta actas globales por carga (todo un conjunto de actas para todos los ítems).
    Estructura esperada:
    {
        "entradas": [...],
        "actas": [{"nombre": "acta1.pdf", "archivo": file}],
        "password_autorizacion": "xxxx" (opcional, solo si no hay actas)
    }
    """
    # 1. Obtener datos JSON
    form_data = request.form.get('data') if request.form.get('data') else None
    if form_data:
        data = json.loads(form_data)
        entradas = data.get('entradas', [])
        password_cliente = data.get('password_autorizacion')
    else:
        # Si viene por JSON puro (sin multipart)
        data = request.get_json()
        entradas = data.get('entradas', [])
        password_cliente = data.get('password_autorizacion')

    if not isinstance(entradas, list) or len(entradas) == 0:
        return bad_request_error("El array 'entradas' es requerido y no puede estar vacío", headers)

    # 2. Obtener archivos (actas globales)
    files = request.files.getlist('actas') if request.files else []

    # 3. Validar contraseña si no hay actas
    conn = get_connection()
    cursor = conn.cursor()
    
    if not files or len(files) == 0:
        pass_sistema = _obtener_contrasena_sistema(conn)
        if not password_cliente or password_cliente != pass_sistema:
            cursor.close()
            conn.close()
            return (json.dumps({"success": False, "message": "Se requiere una contraseña válida para guardar sin actas"}), 403, headers)
    
    ids_generados = []
    errores = []
    codigo_carga = _generar_codigo_carga()

    try:
        _asegurar_columna_codigo_carga(cursor, 'movimientos_entrada_callao', 'idx_me_codigo_carga_callao')
        for idx, entrada_data in enumerate(entradas):
            try:
                # Convertir nombres/códigos a IDs
                producto_id = _get_id_producto_por_codigo_o_nombre(entrada_data.get('producto'), conn)
                if not producto_id:
                    errores.append(f"Entrada {idx + 1}: Producto no encontrado")
                    continue

                tipo_op_id = _get_id_tipo_operacion_por_nombre_y_tipo(entrada_data.get('operacion'), 'ENTRADA', conn)
                if not tipo_op_id:
                    errores.append(f"Entrada {idx + 1}: Tipo de operación inválido")
                    continue

                tienda_salida_id = _get_id_tienda_por_nombre_o_codigo(entrada_data.get('almacen_salida'), conn)
                if not tienda_salida_id:
                    errores.append(f"Entrada {idx + 1}: Almacén de salida no encontrado")
                    continue

                um_id = _get_id_unidad_medida_por_nombre(entrada_data.get('unidad_medida'), conn)
                if not um_id:
                    errores.append(f"Entrada {idx + 1}: Unidad de medida no válida")
                    continue

                # Verificar si la tienda de salida es un almacén
                cursor.execute("SELECT es_almacen FROM tiendas_gestion_sea_callao WHERE id = %s", (tienda_salida_id,))
                tienda_salida_info = cursor.fetchone()
                es_almacen_salida = tienda_salida_info['es_almacen'] if tienda_salida_info else 1

                try:
                    cantidad_val = int(entrada_data.get('cantidad') or 0)
                except (TypeError, ValueError):
                    cantidad_val = 0

                # Soporta entrada_data.almacen_ingreso (string) o entrada_data.almacenes_ingreso (array).
                destinos_raw = entrada_data.get('almacenes_ingreso')
                if destinos_raw is None:
                    destinos_raw = [entrada_data.get('almacen_ingreso')]
                elif not isinstance(destinos_raw, list):
                    destinos_raw = [destinos_raw]

                destinos = [d for d in destinos_raw if d and str(d).strip()]
                if not destinos:
                    errores.append(f"Entrada {idx + 1}: Tienda(s) de ingreso no informada(s)")
                    continue

                for destino in destinos:
                    tienda_ingreso_id = _get_id_tienda_por_nombre_o_codigo(destino, conn)
                    if not tienda_ingreso_id:
                        errores.append(f"Entrada {idx + 1}: Tienda de ingreso '{destino}' no encontrada")
                        continue

                    _asegurar_fila_existencia(cursor, producto_id, tienda_ingreso_id)

                    # Llamar al SP por cada destino (upsert stock por sede)
                    params = [
                        producto_id, tipo_op_id, tienda_salida_id, tienda_ingreso_id,
                        entrada_data.get('operador'), cantidad_val, um_id,
                        entrada_data.get('entregado_por'), entrada_data.get('registrado_por'),
                        entrada_data.get('observaciones'),
                    ]
                    cursor.callproc('sp_registrar_entrada_callao', params)
                    result_set = cursor.fetchall()
                    _drenar_resultados_callproc(cursor)
                    nuevo_id = _resolver_id_movimiento_despues_sp(cursor, result_set)

                    if not nuevo_id:
                        errores.append(
                            f"Entrada {idx + 1}: No se obtuvo id del movimiento (revise sp_registrar_entrada_callao o LAST_INSERT_ID)"
                        )
                        continue

                    _asignar_codigo_carga_entrada_si_existe_columna(cursor, nuevo_id, codigo_carga)

                    # Restar stock si la tienda de salida no es almacén (el SP ya actualizó ingreso)
                    if not es_almacen_salida:
                        cantidad = cantidad_val
                        _asegurar_fila_existencia(cursor, producto_id, tienda_salida_id)
                        cursor.execute(
                            "SELECT id, cantidad FROM existencias_almacen_callao WHERE id_producto = %s AND id_tienda = %s",
                            (producto_id, tienda_salida_id)
                        )
                        existencia_row = cursor.fetchone()
                        if existencia_row:
                            nueva_cantidad = max(0, (existencia_row['cantidad'] or 0) - cantidad)
                            cursor.execute(
                                "UPDATE existencias_almacen_callao SET cantidad = %s WHERE id_producto = %s AND id_tienda = %s",
                                (nueva_cantidad, producto_id, tienda_salida_id)
                            )
                        else:
                            cursor.execute(
                                "INSERT INTO existencias_almacen_callao (id_producto, id_tienda, cantidad) VALUES (%s, %s, %s)",
                                (producto_id, tienda_salida_id, 0)
                            )

                    ids_generados.append(nuevo_id)

            except Exception as e:
                errores.append(f"Entrada {idx + 1}: {str(e)}")
                logging.error(f"Error en entrada {idx + 1}: {traceback.format_exc()}")

        # 4. Actas globales: codigo_carga solo en movimientos_actas_callao (no en me).
        # Subimos cada archivo una vez; el primer movimiento recibe el INSERT real;
        # el mismo url/nombre se replica en el resto de filas del lote para que la cascada agrupe por codigo_carga.
        actas_subidas = []
        id_representativo = next((i for i in ids_generados if i), None)
        if files and codigo_carga and id_representativo:
            for file in files:
                if file.filename != '':
                    url_publica = upload_to_gcs(file)
                    if url_publica:
                        actas_subidas.append((url_publica, file.filename))
                        cursor.execute(
                            """INSERT INTO movimientos_actas_callao 
                               (id_movimiento_entrada, nombre_imagen, url_imagen, codigo_carga) 
                               VALUES (%s, %s, %s, %s)""",
                            (id_representativo, file.filename, url_publica, codigo_carga),
                        )
            for nid in ids_generados:
                if not nid or nid == id_representativo:
                    continue
                for url_publica, fname in actas_subidas:
                    cursor.execute(
                        """INSERT INTO movimientos_actas_callao 
                           (id_movimiento_entrada, nombre_imagen, url_imagen, codigo_carga) 
                           VALUES (%s, %s, %s, %s)""",
                        (nid, fname, url_publica, codigo_carga),
                    )

        if errores:
            conn.rollback()
            return bad_request_error(f"Errores: {'; '.join(errores)}", headers)
        
        conn.commit()
        return created_response(
            data={'ids': ids_generados, 'total': len(ids_generados), 'codigo_carga': codigo_carga},
            message=f"{len(ids_generados)} entrada(s) registrada(s) exitosamente",
            headers=headers
        )
    except Exception as e:
        conn.rollback()
        logging.error(f"Error en create_entradas_masivo: {traceback.format_exc()}")
        return server_error(f"Error: {str(e)}", headers)
    finally:
        cursor.close()
        conn.close()



def update_entrada(request, headers, id_entrada):
    """Edita una entrada existente usando el SP sp_editar_entrada_callao."""
    data = request.get_json()
    if not data:
        return bad_request_error("Datos JSON inválidos", headers)

    motivo_cambio = data.get('motivo_cambio')
    if not motivo_cambio:
        return bad_request_error("El campo 'motivo_cambio' es obligatorio para editar", headers)

    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Obtener estado anterior del movimiento para recalcular impacto en stock.
        cursor.execute(
            """
            SELECT id, id_producto, id_tienda_salida, id_tienda_ingreso, cantidad
            FROM movimientos_entrada_callao
            WHERE id = %s
            """,
            (id_entrada,)
        )
        mov_anterior = cursor.fetchone()
        if not mov_anterior:
            return not_found_error(f"Entrada con ID {id_entrada} no encontrada", headers)

        # Convertir nombres/códigos a IDs (similar a create_entrada)
        producto_id = _get_id_producto_por_codigo_o_nombre(data.get('producto'), conn)
        if not producto_id:
            return bad_request_error("Producto no encontrado", headers)

        tipo_op_id = _get_id_tipo_operacion_por_nombre_y_tipo(data.get('operacion'), 'ENTRADA', conn)
        if not tipo_op_id:
            return bad_request_error(f"Tipo de operación '{data.get('operacion')}' para ENTRADA no válido", headers)

        tienda_salida_id = _get_id_tienda_por_nombre_o_codigo(data.get('almacen_salida'), conn)
        if not tienda_salida_id:
            return bad_request_error(f"Almacén/Tienda de salida '{data.get('almacen_salida')}' no encontrado", headers)

        tienda_ingreso_id = _get_id_tienda_por_nombre_o_codigo(data.get('almacen_ingreso'), conn)
        if not tienda_ingreso_id:
            return bad_request_error(f"Tienda de ingreso '{data.get('almacen_ingreso')}' no encontrada", headers)

        um_id = _get_id_unidad_medida_por_nombre(data.get('unidad_medida'), conn)
        if not um_id:
            return bad_request_error(f"Unidad de medida '{data.get('unidad_medida')}' no válida", headers)

        # Filas en existencias antes del SP: evita NULL en cantidad_anterior (MySQL SELECT INTO sin fila).
        _asegurar_fila_existencia(cursor, producto_id, tienda_ingreso_id)
        _asegurar_fila_existencia(cursor, producto_id, tienda_salida_id)

        params = [
            id_entrada, producto_id, tipo_op_id, tienda_salida_id, tienda_ingreso_id,
            data.get('operador'), data.get('cantidad'), um_id,
            data.get('entregado_por'), data.get('registrado_por'), data.get('observaciones'),
            motivo_cambio
        ]
        cursor.callproc('sp_editar_entrada_callao', params)
        while cursor.nextset():
            pass

        conn.commit()
        return success_response(message="Entrada actualizada exitosamente", headers=headers)
    except Exception as e:
        conn.rollback()
        logging.error(f"Error al actualizar entrada: {traceback.format_exc()}")
        return server_error(f"Error al actualizar entrada: {str(e)}", headers)
    finally:
        cursor.close()
        conn.close()

# --- MÓDULO SALIDAS ---
def get_salidas(request, headers):
    """Obtiene el listado de movimientos de salida."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        sql = """
            SELECT 
                ms.id, ms.fecha_registro, 
                p.codigo as producto_codigo, p.nombre as producto_nombre,
                tos.nombre as operacion, ms.nro_comprobante, ms.asesor,
                ms.cantidad, um.nombre as unidad_medida,
                t.codigo as tienda_codigo, t.nombre as tienda_nombre,
                ms.entregado_por, ms.registrado_por, ms.observaciones,
                ms.fecha_actualizacion, ms.motivo_cambio,
                COUNT(msa.id) as total_actas,
                GROUP_CONCAT(msa.url_imagen SEPARATOR ',') as actas_urls
            FROM movimientos_salida_callao ms
            LEFT JOIN movimientos_actas_callao msa ON ms.id = msa.id_movimiento_salida
            JOIN productos_abastecimiento_callao p ON ms.id_producto = p.id
            JOIN tipos_operacion_sea_callao tos ON ms.id_tipo_operacion = tos.id
            JOIN tiendas_gestion_sea_callao t ON ms.id_tienda = t.id
            JOIN unidades_medida_sea_callao um ON ms.id_unidad_medida = um.id
            GROUP BY ms.id
            ORDER BY ms.fecha_registro DESC
        """
        cursor.execute(sql)
        salidas = cursor.fetchall()
        return success_response(data=salidas, message="Salidas obtenidas correctamente", headers=headers)
    finally:
        cursor.close()
        conn.close()

def create_salida(request, headers):
    """Registra salida con soporte de actas e imágenes."""
    form_data = request.form.get('data')
    data = json.loads(form_data)
    files = request.files.getlist('actas')
    password_cliente = data.get('password_autorizacion')

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # --- VALIDACIÓN DE CONTRASEÑA DINÁMICA ---
        if not files or len(files) == 0:
            # Para movimientos (entradas/salidas) usamos la clave dinámica del sistema.
            pass_sistema = _obtener_contrasena_sistema(conn)
            if not password_cliente or password_cliente != pass_sistema:
                return (json.dumps({"message": "Se requiere una contraseña válida para guardar sin actas"}), 403, headers)

        producto_id = _get_id_producto_por_codigo_o_nombre(data.get('producto'), conn)
        if not producto_id:
            return bad_request_error("Producto no encontrado", headers)

        tipo_op_id = _get_id_tipo_operacion_por_nombre_y_tipo(data.get('operacion'), 'SALIDA', conn)
        if not tipo_op_id:
            return bad_request_error(f"Tipo de operación '{data.get('operacion')}' para SALIDA no válido", headers)

        tienda_id = _get_id_tienda_por_nombre_o_codigo(data.get('almacen'), conn)
        if not tienda_id:
            return bad_request_error(f"Almacén/Tienda '{data.get('almacen')}' no encontrado", headers)

        um_id = _get_id_unidad_medida_por_nombre(data.get('unidad_medida'), conn)
        if not um_id:
            return bad_request_error(f"Unidad de medida '{data.get('unidad_medida')}' no válida", headers)

        # Validación de stock: no permitir que la salida deje stock negativo.
        try:
            existencia_actual = _get_existencia_producto_tienda(producto_id, tienda_id, conn)
        except Exception:
            existencia_actual = 0
        cantidad_salida = int(data.get('cantidad') or 0)
        if cantidad_salida > existencia_actual:
            return bad_request_error(f"Stock insuficiente en la tienda. Existencia actual: {existencia_actual}, salida pedida: {cantidad_salida}", headers)

        _asegurar_fila_existencia(cursor, producto_id, tienda_id)

        # Llamar al SP
        params = [
            producto_id, tipo_op_id, data.get('nro_comprobante'), data.get('asesor'),
            data.get('cantidad'), um_id, tienda_id,
            data.get('entregado_por'), data.get('registrado_por'), data.get('observaciones')
        ]
        cursor.callproc('sp_registrar_salida_callao', params)
        result_set = cursor.fetchall()
        _drenar_resultados_callproc(cursor)
        nuevo_id = _resolver_id_movimiento_despues_sp(cursor, result_set)

        if not nuevo_id:
            raise Exception("No se pudo obtener id del movimiento (ni resultado del SP ni LAST_INSERT_ID)")

        # cantidad_anterior la fija el SP; no sobrescribir.

        # Guardar actas vinculadas a SALIDA
        if files and nuevo_id:
            for file in files:
                url_publica = upload_to_gcs(file)
                cursor.execute("""
                    INSERT INTO movimientos_actas_callao (id_movimiento_salida, nombre_imagen, url_imagen) 
                    VALUES (%s, %s, %s)
                """, (nuevo_id, file.filename, url_publica))

        conn.commit()
        return created_response(data={'id': nuevo_id}, message="Salida registrada con éxito", headers=headers)

    except Exception as e:
        conn.rollback()
        return server_error(str(e), headers)
    finally:
        cursor.close()
        conn.close()

def create_salidas_masivo(request, headers):
    """
    Registra múltiples salidas en una sola transacción.
    Ahora soporta actas globales por carga similares a entradas.
    """
    # 1. Obtener datos JSON
    form_data = request.form.get('data') if request.form.get('data') else None
    if form_data:
        data = json.loads(form_data)
        salidas = data.get('salidas', [])
        password_cliente = data.get('password_autorizacion')
    else:
        data = request.get_json()
        salidas = data.get('salidas', [])
        password_cliente = data.get('password_autorizacion')

    if not isinstance(salidas, list) or len(salidas) == 0:
        return bad_request_error("El array 'salidas' es requerido y no puede estar vacío", headers)

    # 2. Obtener archivos (actas globales)
    files = request.files.getlist('actas') if request.files else []

    # 3. Validar contraseña si no hay actas
    conn = get_connection()
    cursor = conn.cursor()
    
    if not files or len(files) == 0:
        pass_sistema = _obtener_contrasena_sistema(conn)
        if not password_cliente or password_cliente != pass_sistema:
            cursor.close()
            conn.close()
            return (json.dumps({"success": False, "message": "Se requiere una contraseña válida para guardar sin actas"}), 403, headers)

    ids_generados = []
    errores = []
    codigo_carga = _generar_codigo_carga()

    try:
        _asegurar_columna_codigo_carga(cursor, 'movimientos_salida_callao', 'idx_ms_codigo_carga_callao')
        for idx, salida_data in enumerate(salidas):
            try:
                producto_id = _get_id_producto_por_codigo_o_nombre(salida_data.get('producto'), conn)
                if not producto_id:
                    errores.append(f"Salida {idx + 1}: Producto no encontrado")
                    continue

                tipo_op_id = _get_id_tipo_operacion_por_nombre_y_tipo(salida_data.get('operacion'), 'SALIDA', conn)
                if not tipo_op_id:
                    errores.append(f"Salida {idx + 1}: Tipo de operación no válido")
                    continue

                tienda_id = _get_id_tienda_por_nombre_o_codigo(salida_data.get('almacen'), conn)
                if not tienda_id:
                    errores.append(f"Salida {idx + 1}: Almacén/Tienda no encontrado")
                    continue

                um_id = _get_id_unidad_medida_por_nombre(salida_data.get('unidad_medida'), conn)
                if not um_id:
                    errores.append(f"Salida {idx + 1}: Unidad de medida no válida")
                    continue

                # Validación de stock: no permitir que la salida deje stock negativo.
                try:
                    existencia_actual = _get_existencia_producto_tienda(producto_id, tienda_id, conn)
                except Exception:
                    existencia_actual = 0
                try:
                    cantidad_val = int(salida_data.get('cantidad') or 0)
                except (TypeError, ValueError):
                    cantidad_val = 0
                if cantidad_val > existencia_actual:
                    errores.append(
                        f"Salida {idx + 1}: Stock insuficiente en la tienda (existencia {existencia_actual}, salida {cantidad_val})"
                    )
                    continue

                _asegurar_fila_existencia(cursor, producto_id, tienda_id)

                # Llamar al SP
                params = [
                    producto_id, tipo_op_id, salida_data.get('nro_comprobante'), salida_data.get('asesor'),
                    cantidad_val, um_id, tienda_id,
                    salida_data.get('entregado_por'), salida_data.get('registrado_por'),
                    salida_data.get('observaciones'),
                ]
                cursor.callproc('sp_registrar_salida_callao', params)
                result_set = cursor.fetchall()
                _drenar_resultados_callproc(cursor)
                nuevo_id = _resolver_id_movimiento_despues_sp(cursor, result_set)

                if not nuevo_id:
                    errores.append(
                        f"Salida {idx + 1}: No se obtuvo id del movimiento (revise sp_registrar_salida_callao o LAST_INSERT_ID)"
                    )
                    continue

                _asignar_codigo_carga_salida_si_existe_columna(cursor, nuevo_id, codigo_carga)
                ids_generados.append(nuevo_id)

            except Exception as e:
                errores.append(f"Salida {idx + 1}: {str(e)}")
                logging.error(f"Error en salida {idx + 1}: {traceback.format_exc()}")

        actas_subidas = []
        id_representativo = next((i for i in ids_generados if i), None)
        if files and codigo_carga and id_representativo:
            for file in files:
                if file.filename != '':
                    url_publica = upload_to_gcs(file)
                    if url_publica:
                        actas_subidas.append((url_publica, file.filename))
                        cursor.execute(
                            """INSERT INTO movimientos_actas_callao 
                               (id_movimiento_salida, nombre_imagen, url_imagen, codigo_carga) 
                               VALUES (%s, %s, %s, %s)""",
                            (id_representativo, file.filename, url_publica, codigo_carga),
                        )
            for nid in ids_generados:
                if not nid or nid == id_representativo:
                    continue
                for url_publica, fname in actas_subidas:
                    cursor.execute(
                        """INSERT INTO movimientos_actas_callao 
                           (id_movimiento_salida, nombre_imagen, url_imagen, codigo_carga) 
                           VALUES (%s, %s, %s, %s)""",
                        (nid, fname, url_publica, codigo_carga),
                    )

        if errores:
            conn.rollback()
            return bad_request_error(f"Errores: {'; '.join(errores)}", headers)
        
        conn.commit()
        return created_response(
            data={'ids': ids_generados, 'total': len(ids_generados), 'codigo_carga': codigo_carga},
            message=f"{len(ids_generados)} salida(s) registrada(s) exitosamente",
            headers=headers
        )
    except Exception as e:
        conn.rollback()
        logging.error(f"Error en create_salidas_masivo: {traceback.format_exc()}")
        return server_error(f"Error: {str(e)}", headers)
    finally:
        cursor.close()
        conn.close()

def update_salida(request, headers, id_salida):
    """Edita una salida existente usando el SP sp_editar_salida_callao."""
    data = request.get_json()
    if not data:
        return bad_request_error("Datos JSON inválidos", headers)

    motivo_cambio = data.get('motivo_cambio')
    if not motivo_cambio:
        return bad_request_error("El campo 'motivo_cambio' es obligatorio para editar", headers)

    conn = get_connection()
    cursor = conn.cursor()
    try:
        producto_id = _get_id_producto_por_codigo_o_nombre(data.get('producto'), conn)
        if not producto_id:
            return bad_request_error("Producto no encontrado", headers)

        tipo_op_id = _get_id_tipo_operacion_por_nombre_y_tipo(data.get('operacion'), 'SALIDA', conn)
        if not tipo_op_id:
            return bad_request_error(f"Tipo de operación '{data.get('operacion')}' para SALIDA no válido", headers)

        tienda_id = _get_id_tienda_por_nombre_o_codigo(data.get('almacen'), conn)
        if not tienda_id:
            return bad_request_error(f"Almacén/Tienda '{data.get('almacen')}' no encontrado", headers)

        um_id = _get_id_unidad_medida_por_nombre(data.get('unidad_medida'), conn)
        if not um_id:
            return bad_request_error(f"Unidad de medida '{data.get('unidad_medida')}' no válida", headers)

        # Capturar estado actual antes de editar (para cantidad_anterior y validación de stock).
        cursor.execute(
            "SELECT id_producto, id_tienda, cantidad FROM movimientos_salida_callao WHERE id = %s",
            (id_salida,)
        )
        row_actual = cursor.fetchone()
        if not row_actual:
            return not_found_error(f"Salida con ID {id_salida} no encontrada", headers)
        cantidad_previa = row_actual.get('cantidad', 0)
        producto_previo = row_actual.get('id_producto')
        tienda_previa = row_actual.get('id_tienda')

        # Validación de stock al editar:
        # - Si editas la misma tienda/producto, la salida previa ya descontó stock.
        #   Por eso se "devuelve virtualmente" la cantidad previa para validar el nuevo valor.
        # - Si cambias tienda/producto, se valida contra la existencia actual del nuevo destino.
        existencia_actual_nueva = _get_existencia_producto_tienda(producto_id, tienda_id, conn)
        disponibilidad_virtual = existencia_actual_nueva
        if producto_previo == producto_id and tienda_previa == tienda_id:
            disponibilidad_virtual += int(cantidad_previa or 0)

        cantidad_nueva = int(data.get('cantidad') or 0)
        if cantidad_nueva > disponibilidad_virtual:
            return bad_request_error(
                f"Stock insuficiente para editar salida. Disponible: {disponibilidad_virtual}, solicitado: {cantidad_nueva}",
                headers
            )

        _asegurar_fila_existencia(cursor, producto_id, tienda_id)

        params = [
            id_salida, producto_id, tipo_op_id, data.get('nro_comprobante'),
            data.get('asesor'), data.get('cantidad'), um_id, tienda_id,
            data.get('entregado_por'), data.get('registrado_por'), data.get('observaciones'),
            motivo_cambio
        ]
        cursor.callproc('sp_editar_salida_callao', params)
        while cursor.nextset():
            pass

        conn.commit()
        return success_response(message="Salida actualizada exitosamente", headers=headers)
    except Exception as e:
        conn.rollback()
        logging.error(f"Error al actualizar salida: {traceback.format_exc()}")
        return server_error(f"Error al actualizar salida: {str(e)}", headers)
    finally:
        cursor.close()
        conn.close()


# --- MÓDULO TRASLADOS ---
def get_traslados(request, headers):
    """Obtiene el listado de movimientos de traslado."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Una consulta más amigable que muestre nombres en lugar de IDs
        sql = """
            SELECT 
                mg.id, mg.fecha_registro, 
                p.codigo as producto_codigo, p.nombre as producto_nombre,
                tos.nombre as operacion,
                ts.codigo as tienda_salida_codigo, ts.nombre as tienda_salida_nombre,
                ti.codigo as tienda_ingreso_codigo, ti.nombre as tienda_ingreso_nombre,
                mg.operador, mg.cantidad, um.nombre as unidad_medida,
                mg.entregado_por, mg.registrado_por, mg.observaciones,
                mg.fecha_actualizacion, mg.motivo_cambio,
                COUNT(mea.id) as total_actas, 
                GROUP_CONCAT(mea.url_imagen SEPARATOR ',') as actas_urls
            FROM movimientos_traslado_callao mg
            LEFT JOIN movimientos_actas_callao mea ON mg.id = mea.id_movimiento_traslado
            JOIN productos_abastecimiento_callao p ON mg.id_producto = p.id
            JOIN tipos_operacion_sea_callao tos ON mg.id_tipo_operacion = tos.id
            JOIN tiendas_gestion_sea_callao ts ON mg.id_tienda_salida = ts.id
            JOIN tiendas_gestion_sea_callao ti ON mg.id_tienda_ingreso = ti.id
            JOIN unidades_medida_sea_callao um ON mg.id_unidad_medida = um.id
            GROUP BY mg.id
            ORDER BY mg.fecha_registro DESC
        """
        cursor.execute(sql)
        traslados = cursor.fetchall()
        return success_response(data=traslados, message="Traslados obtenidos correctamente", headers=headers)
    finally:
        cursor.close()
        conn.close()

def create_traslado(request, headers):
    """Registra traslado con soporte de actas e imágenes."""
    # 1. Obtener datos del FormData
    form_data = request.form.get('data')
    if not form_data:
        return bad_request_error("Faltan datos en la petición", headers)
    
    data = json.loads(form_data)
    files = request.files.getlist('actas')
    password_cliente = data.get('password_autorizacion')

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # --- VALIDACIÓN DE CONTRASEÑA DINÁMICA ---
        if not files or len(files) == 0:
            # Para movimientos (entradas/salidas/tralado) usamos la clave dinámica del sistema.
            pass_sistema = _obtener_contrasena_sistema(conn)
            if not password_cliente or password_cliente != pass_sistema:
                return (json.dumps({"message": "Se requiere una contraseña válida para guardar sin actas"}), 403, headers)


        # Convertir nombres/códigos a IDs
        producto_id = _get_id_producto_por_codigo_o_nombre(data.get('producto'), conn)
        if not producto_id:
            return bad_request_error("Producto no encontrado", headers)

        tipo_op_id = _get_id_tipo_operacion_por_nombre_y_tipo(data.get('operacion'), 'TRASLADO', conn)
        if not tipo_op_id:
            return bad_request_error(f"Tipo de operación '{data.get('operacion')}' para TRASLADO no válido", headers)

        tienda_salida_id = _get_id_tienda_por_nombre_o_codigo(data.get('almacen_salida'), conn)
        if not tienda_salida_id:
            return bad_request_error(f"Almacén/Tienda de salida '{data.get('almacen_salida')}' no encontrado", headers)

        tienda_ingreso_id = _get_id_tienda_por_nombre_o_codigo(data.get('almacen_ingreso'), conn)
        if not tienda_ingreso_id:
            return bad_request_error(f"Tienda de ingreso '{data.get('almacen_ingreso')}' no encontrada", headers)

        um_id = _get_id_unidad_medida_por_nombre(data.get('unidad_medida'), conn)
        if not um_id:
            return bad_request_error(f"Unidad de medida '{data.get('unidad_medida')}' no válida", headers)

        if not all([producto_id, tipo_op_id, tienda_salida_id, tienda_ingreso_id, um_id]):
            return bad_request_error("Uno o más parámetros (producto, tienda, etc.) son inválidos", headers)

        # Verificar si la tienda de salida es un almacén o una tienda (reutilizar el mismo cursor)
        cursor.execute("SELECT es_almacen FROM tiendas_gestion_sea_callao WHERE id = %s", (tienda_salida_id,))
        tienda_salida_info = cursor.fetchone()
        es_almacen_salida = tienda_salida_info['es_almacen'] if tienda_salida_info else 1

        # Fila en existencias para tienda de INGRESO: sin ella el SP deja v_cant_anterior NULL (MySQL INTO sin filas).
        _asegurar_fila_existencia(cursor, producto_id, tienda_ingreso_id)

        try:
            cantidad_sp = int(data.get('cantidad') or 0)
        except (TypeError, ValueError):
            cantidad_sp = 0
        cantidad_sp, um_id, cantidad_cajas_origen = _aplicar_conversion_traslado_oficina_docenas(
            cursor, producto_id, cantidad_sp, um_id, tienda_salida_id, tienda_ingreso_id
        )

        # Llamar al SP manualmente para mantener control de la transacción
        params = [
            producto_id, tipo_op_id, tienda_salida_id, tienda_ingreso_id,
            data.get('operador'), cantidad_sp, um_id,
            data.get('entregado_por'), data.get('registrado_por'), data.get('observaciones')
        ]
        try:
            logging.info(f"Ejecutando SP: sp_registrar_traslado_callao con parámetros: {params}")
            cursor.callproc('sp_registrar_traslado_callao', params)
            result_set = cursor.fetchall()
            _drenar_resultados_callproc(cursor)
            nuevo_id = _resolver_id_movimiento_despues_sp(cursor, result_set)

            if not nuevo_id:
                raise Exception("No se pudo obtener id del movimiento (ni resultado del SP ni LAST_INSERT_ID)")

            # cantidad_anterior la calcula el SP (stock en tienda ingreso antes del movimiento); no sobrescribir.

            # Si la tienda de salida NO es un almacén (es una tienda), restar del stock (en cajas)
            if not es_almacen_salida:
                _asegurar_fila_existencia(cursor, producto_id, tienda_salida_id)
                cursor.execute(
                    "SELECT id, cantidad FROM existencias_almacen_callao WHERE id_producto = %s AND id_tienda = %s",
                    (producto_id, tienda_salida_id)
                )
                existencia_row = cursor.fetchone()

                if existencia_row:
                    nueva_cantidad = max(0, (existencia_row['cantidad'] or 0) - cantidad_cajas_origen)
                    cursor.execute(
                        "UPDATE existencias_almacen_callao SET cantidad = %s WHERE id_producto = %s AND id_tienda = %s",
                        (nueva_cantidad, producto_id, tienda_salida_id)
                    )
                else:
                    cursor.execute(
                        "INSERT INTO existencias_almacen_callao (id_producto, id_tienda, cantidad) VALUES (%s, %s, %s)",
                        (producto_id, tienda_salida_id, 0)
                    )

            # --- GUARDAR ACTAS EN GCS Y BD ---
            if files:
                for file in files:
                    url_publica = upload_to_gcs(file)
                    cursor.execute("""
                        INSERT INTO movimientos_actas_callao (id_movimiento_traslado, nombre_imagen, url_imagen) 
                        VALUES (%s, %s, %s)
                    """, (nuevo_id, file.filename, url_publica))

            conn.commit()
            return created_response(data={'id': nuevo_id}, message="Traslado registrado con actas", headers=headers)

        except Exception as e:
            conn.rollback()
            logging.error(f"Error ejecutando traslado: {traceback.format_exc()}")
            return server_error(f"Error al registrar traslado: {str(e)}", headers)
    finally:
        cursor.close()
        conn.close()

def create_traslados_masivo(request, headers):
    """
    Registra múltiples traslados en una sola transacción.
    Ahora soporta actas globales por carga (todo un conjunto de actas para todos los ítems).
    Estructura esperada:
    {
        "traslados": [...],
        "actas": [{"nombre": "acta1.pdf", "archivo": file}],
        "password_autorizacion": "xxxx" (opcional, solo si no hay actas)
    }
    """
    # 1. Obtener datos JSON
    form_data = request.form.get('data') if request.form.get('data') else None
    if form_data:
        data = json.loads(form_data)
        traslados = data.get('traslados', [])
        password_cliente = data.get('password_autorizacion')
    else:
        # Si viene por JSON puro (sin multipart)
        data = request.get_json()
        traslados = data.get('traslados', [])
        password_cliente = data.get('password_autorizacion')

    if not isinstance(traslados, list) or len(traslados) == 0:
        return bad_request_error("El array 'traslados' es requerido y no puede estar vacío", headers)

    # 2. Obtener archivos (actas globales)
    files = request.files.getlist('actas') if request.files else []

    # 3. Validar contraseña si no hay actas
    conn = get_connection()
    cursor = conn.cursor()
    
    if not files or len(files) == 0:
        pass_sistema = _obtener_contrasena_sistema(conn)
        if not password_cliente or password_cliente != pass_sistema:
            cursor.close()
            conn.close()
            return (json.dumps({"success": False, "message": "Se requiere una contraseña válida para guardar sin actas"}), 403, headers)
    
    ids_generados = []
    errores = []
    codigo_carga = _generar_codigo_carga()

    try:
        _asegurar_columna_codigo_carga(cursor, 'movimientos_traslado_callao', 'idx_mt_codigo_carga_callao')
        for idx, traslado_data in enumerate(traslados):
            try:
                # Convertir nombres/códigos a IDs
                producto_id = _get_id_producto_por_codigo_o_nombre(traslado_data.get('producto'), conn)
                if not producto_id:
                    errores.append(f"Traslado {idx + 1}: Producto no encontrado")
                    continue

                tipo_op_id = _get_id_tipo_operacion_por_nombre_y_tipo(traslado_data.get('operacion'), 'TRASLADO', conn)
                if not tipo_op_id:
                    errores.append(f"Traslado {idx + 1}: Tipo de operación inválido")
                    continue

                tienda_salida_id = _get_id_tienda_por_nombre_o_codigo(traslado_data.get('almacen_salida'), conn)
                if not tienda_salida_id:
                    errores.append(f"Traslado {idx + 1}: Almacén de salida no encontrado")
                    continue

                tienda_ingreso_id = _get_id_tienda_por_nombre_o_codigo(traslado_data.get('almacen_ingreso'), conn)
                if not tienda_ingreso_id:
                    errores.append(f"Traslado {idx + 1}: Tienda de ingreso no encontrada")
                    continue

                um_id = _get_id_unidad_medida_por_nombre(traslado_data.get('unidad_medida'), conn)
                if not um_id:
                    errores.append(f"Traslado {idx + 1}: Unidad de medida no válida")
                    continue

                # Verificar si la tienda de salida es un almacén
                cursor.execute("SELECT es_almacen FROM tiendas_gestion_sea_callao WHERE id = %s", (tienda_salida_id,))
                tienda_salida_info = cursor.fetchone()
                es_almacen_salida = tienda_salida_info['es_almacen'] if tienda_salida_info else 1

                try:
                    cantidad_val = int(traslado_data.get('cantidad') or 0)
                except (TypeError, ValueError):
                    cantidad_val = 0

                cantidad_val, um_id, cantidad_cajas_origen = _aplicar_conversion_traslado_oficina_docenas(
                    cursor, producto_id, cantidad_val, um_id, tienda_salida_id, tienda_ingreso_id
                )

                _asegurar_fila_existencia(cursor, producto_id, tienda_ingreso_id)

                # Llamar al SP
                params = [
                    producto_id, tipo_op_id, tienda_salida_id, tienda_ingreso_id,
                    traslado_data.get('operador'), cantidad_val, um_id,
                    traslado_data.get('entregado_por'), traslado_data.get('registrado_por'),
                    traslado_data.get('observaciones'),
                ]
                cursor.callproc('sp_registrar_traslado_callao', params)
                result_set = cursor.fetchall()
                _drenar_resultados_callproc(cursor)
                nuevo_id = _resolver_id_movimiento_despues_sp(cursor, result_set)

                if not nuevo_id:
                    errores.append(
                        f"Traslado {idx + 1}: No se obtuvo id del movimiento (revise sp_registrar_traslado_callao o LAST_INSERT_ID)"
                    )
                    continue

                _asignar_codigo_carga_traslado_si_existe_columna(cursor, nuevo_id, codigo_carga)
                # Restar stock si la tienda de salida no es almacén (el SP ya actualizó ingreso; descuento en cajas)
                if not es_almacen_salida:
                    _asegurar_fila_existencia(cursor, producto_id, tienda_salida_id)
                    cursor.execute(
                        "SELECT id, cantidad FROM existencias_almacen_callao WHERE id_producto = %s AND id_tienda = %s",
                        (producto_id, tienda_salida_id)
                    )
                    existencia_row = cursor.fetchone()
                    if existencia_row:
                        nueva_cantidad = max(0, (existencia_row['cantidad'] or 0) - cantidad_cajas_origen)
                        cursor.execute(
                            "UPDATE existencias_almacen_callao SET cantidad = %s WHERE id_producto = %s AND id_tienda = %s",
                            (nueva_cantidad, producto_id, tienda_salida_id)
                        )
                    else:
                        cursor.execute(
                            "INSERT INTO existencias_almacen_callao (id_producto, id_tienda, cantidad) VALUES (%s, %s, %s)",
                            (producto_id, tienda_salida_id, 0)
                        )

                ids_generados.append(nuevo_id)

            except Exception as e:
                errores.append(f"Traslado {idx + 1}: {str(e)}")
                logging.error(f"Error en traslado {idx + 1}: {traceback.format_exc()}")

        # 4. Actas globales: codigo_carga solo en movimientos_actas_callao (no en me).
        # Subimos cada archivo una vez; el primer movimiento recibe el INSERT real;
        # el mismo url/nombre se replica en el resto de filas del lote para que la cascada agrupe por codigo_carga.
        actas_subidas = []
        id_representativo = next((i for i in ids_generados if i), None)
        if files and codigo_carga and id_representativo:
            for file in files:
                if file.filename != '':
                    url_publica = upload_to_gcs(file)
                    if url_publica:
                        actas_subidas.append((url_publica, file.filename))
                        cursor.execute(
                            """INSERT INTO movimientos_actas_callao 
                               (id_movimiento_traslado, nombre_imagen, url_imagen, codigo_carga) 
                               VALUES (%s, %s, %s, %s)""",
                            (id_representativo, file.filename, url_publica, codigo_carga),
                        )
            for nid in ids_generados:
                if not nid or nid == id_representativo:
                    continue
                for url_publica, fname in actas_subidas:
                    cursor.execute(
                        """INSERT INTO movimientos_actas_callao 
                           (id_movimiento_traslado, nombre_imagen, url_imagen, codigo_carga) 
                           VALUES (%s, %s, %s, %s)""",
                        (nid, fname, url_publica, codigo_carga),
                    )

        if errores:
            conn.rollback()
            return bad_request_error(f"Errores: {'; '.join(errores)}", headers)
        
        conn.commit()
        return created_response(
            data={'ids': ids_generados, 'total': len(ids_generados), 'codigo_carga': codigo_carga},
            message=f"{len(ids_generados)} traslado(s) registrada(s) exitosamente",
            headers=headers
        )
    except Exception as e:
        conn.rollback()
        logging.error(f"Error en create_traslados_masivo: {traceback.format_exc()}")
        return server_error(f"Error: {str(e)}", headers)
    finally:
        cursor.close()
        conn.close()



def update_traslado(request, headers, id_traslado):
    """Edita un traslado existente usando el SP sp_editar_traslado_callao."""
    data = request.get_json()
    if not data:
        return bad_request_error("Datos JSON inválidos", headers)

    motivo_cambio = data.get('motivo_cambio')
    if not motivo_cambio:
        return bad_request_error("El campo 'motivo_cambio' es obligatorio para editar", headers)

    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Obtener estado anterior del movimiento para recalcular impacto en stock.
        cursor.execute(
            """
            SELECT id, id_producto, id_tienda_salida, id_tienda_ingreso, cantidad
            FROM movimientos_traslado_callao
            WHERE id = %s
            """,
            (id_traslado,)
        )
        mov_anterior = cursor.fetchone()
        if not mov_anterior:
            return not_found_error(f"Traslado con ID {id_traslado} no encontrado", headers)

        # Convertir nombres/códigos a IDs (similar a create_traslado)
        producto_id = _get_id_producto_por_codigo_o_nombre(data.get('producto'), conn)
        if not producto_id:
            return bad_request_error("Producto no encontrado", headers)

        tipo_op_id = _get_id_tipo_operacion_por_nombre_y_tipo(data.get('operacion'), 'TRASLADO', conn)
        if not tipo_op_id:
            return bad_request_error(f"Tipo de operación '{data.get('operacion')}' para TRASLADO no válido", headers)

        tienda_salida_id = _get_id_tienda_por_nombre_o_codigo(data.get('almacen_salida'), conn)
        if not tienda_salida_id:
            return bad_request_error(f"Almacén/Tienda de salida '{data.get('almacen_salida')}' no encontrado", headers)

        tienda_ingreso_id = _get_id_tienda_por_nombre_o_codigo(data.get('almacen_ingreso'), conn)
        if not tienda_ingreso_id:
            return bad_request_error(f"Tienda de ingreso '{data.get('almacen_ingreso')}' no encontrada", headers)

        um_id = _get_id_unidad_medida_por_nombre(data.get('unidad_medida'), conn)
        if not um_id:
            return bad_request_error(f"Unidad de medida '{data.get('unidad_medida')}' no válida", headers)

        # Filas en existencias antes del SP: evita NULL en cantidad_anterior (MySQL SELECT INTO sin fila).
        _asegurar_fila_existencia(cursor, producto_id, tienda_ingreso_id)
        _asegurar_fila_existencia(cursor, producto_id, tienda_salida_id)

        try:
            cantidad_sp = int(data.get('cantidad') or 0)
        except (TypeError, ValueError):
            cantidad_sp = 0
        cantidad_sp, um_id, _cantidad_cajas_origen = _aplicar_conversion_traslado_oficina_docenas(
            cursor, producto_id, cantidad_sp, um_id, tienda_salida_id, tienda_ingreso_id
        )

        params = [
            id_traslado, producto_id, tipo_op_id, tienda_salida_id, tienda_ingreso_id,
            data.get('operador'), cantidad_sp, um_id,
            data.get('entregado_por'), data.get('registrado_por'), data.get('observaciones'),
            motivo_cambio
        ]
        cursor.callproc('sp_editar_traslado_callao', params)
        while cursor.nextset():
            pass

        conn.commit()
        return success_response(message="Traslado actualizado exitosamente", headers=headers)
    except Exception as e:
        conn.rollback()
        logging.error(f"Error al actualizar traslado: {traceback.format_exc()}")
        return server_error(f"Error al actualizar traslado: {str(e)}", headers)
    finally:
        cursor.close()
        conn.close()

# --- MÓDULO EXISTENCIAS / STOCK TOTAL ---
def get_existencias(request, headers):
    """Obtiene las existencias actuales por tienda."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        sql = """
            SELECT 
                p.codigo, p.nombre as producto,
                et.id_tienda, t.codigo as tienda_codigo, t.nombre as tienda_nombre,
                et.cantidad
            FROM existencias_almacen_callao et
            JOIN productos_abastecimiento_callao p ON et.id_producto = p.id
            JOIN tiendas_gestion_sea_callao t ON et.id_tienda = t.id
            WHERE et.cantidad != 0
            ORDER BY p.nombre, t.codigo
        """
        cursor.execute(sql)
        existencias = cursor.fetchall()
        return success_response(data=existencias, message="Existencias obtenidas correctamente", headers=headers)
    finally:
        cursor.close()
        conn.close()

def get_stock_total(request, headers):
    """
    Stock total — tiendas `OFICINA`, `OFICINA-DOCENAS`, `CALLAO-1-A`, `CALLAO-1-B`, `CALLAO-2` (tabla tiendas_gestion_sea_callao).
    Contrato JSON alineado con app/services/api.ts (StockTotalDB).
    """
    conn = get_connection()
    cursor = conn.cursor()
    try:
        sql_plano = """
            SELECT 
                p.id,
                p.codigo,
                p.nombre,
                p.cantidad_reg_calculo,
                um_reg.nombre AS unidad_medida_reg,
                -- Existencias por tienda
                COALESCE(ex_oficina.cantidad, 0)  AS existencia_oficina,
                COALESCE(ex_oficina_docenas.cantidad, 0)  AS existencia_oficina_docenas,
                COALESCE(ex_callao1a.cantidad, 0)  AS existencia_callao1_a,
                COALESCE(ex_callao1b.cantidad, 0)  AS existencia_callao1_b,
                COALESCE(ex_callao2.cantidad, 0)  AS existencia_callao2
            FROM productos_abastecimiento_callao p
            JOIN unidades_medida_sea_callao um_reg ON p.id_unidad_medida_reg = um_reg.id
            LEFT JOIN existencias_almacen_callao ex_oficina  ON p.id = ex_oficina.id_producto  AND ex_oficina.id_tienda  = (SELECT id FROM tiendas_gestion_sea_callao WHERE codigo = 'OFICINA')
            LEFT JOIN existencias_almacen_callao ex_oficina_docenas  ON p.id = ex_oficina_docenas.id_producto  AND ex_oficina_docenas.id_tienda  = (SELECT id FROM tiendas_gestion_sea_callao WHERE codigo = 'OFICINA-DOCENAS')
            LEFT JOIN existencias_almacen_callao ex_callao1a  ON p.id = ex_callao1a.id_producto  AND ex_callao1a.id_tienda  = (SELECT id FROM tiendas_gestion_sea_callao WHERE codigo = 'CALLAO-1-A')
            LEFT JOIN existencias_almacen_callao ex_callao1b  ON p.id = ex_callao1b.id_producto  AND ex_callao1b.id_tienda  = (SELECT id FROM tiendas_gestion_sea_callao WHERE codigo = 'CALLAO-1-B')
            LEFT JOIN existencias_almacen_callao ex_callao2  ON p.id = ex_callao2.id_producto  AND ex_callao2.id_tienda  = (SELECT id FROM tiendas_gestion_sea_callao WHERE codigo = 'CALLAO-2');
        """
        cursor.execute(sql_plano)
        resultados = cursor.fetchall()

        def _n(v):
            if v is None:
                return 0
            try:
                return int(v)
            except Exception:
                try:
                    return int(float(v))
                except Exception:
                    return 0

        for row in resultados:
            row['disponibles'] = (
                _n(row.get('existencia_oficina'))
                + _n(row.get('existencia_callao1_a'))
                + _n(row.get('existencia_callao1_b'))
                + _n(row.get('existencia_callao2'))
            )

            # cajas = suma de oficina + callao1a + callao1b + callao2
            row['cajas'] = (
                _n(row.get('existencia_oficina'))
                + _n(row.get('existencia_callao1_a'))
                + _n(row.get('existencia_callao1_b'))
                + _n(row.get('existencia_callao2'))
            )
            # Alias explícito para contrato front (`StockTotalDB`)
            row['stock_detallado_cajas'] = row['cajas']

            # stock_detallado_medida = solo existencia_oficina_docenas
            row['stock_detallado_medida'] = _n(row.get('existencia_oficina_docenas'))

            row['stock_detallado_unidad_medida'] = row.get('unidad_medida_reg') or "UNIDADES"

        return success_response(data=resultados, message="Stock total obtenido correctamente", headers=headers)
    finally:
        cursor.close()
        conn.close()

def importar_stock_total_excel(request, headers):
    """
    Importa un Excel con el mismo formato que el export de "Productos Detallados" (Stock Total Callao).
    Lee la hoja 'Inventario' y:
    - actualiza productos_abastecimiento_callao.cantidad_reg_calculo (columna C: "CANT. EN CAJA")
    - calcula deltas de existencias (columnas E–I: 5 tiendas) y devuelve movimientos sugeridos para registrarlos
      como ENTRADAS en el frontend (con actas / contraseña).

    Formato esperado (2 filas de encabezado, data desde fila 3):
    A: CODIGO
    B: PRODUCTO
    C: CANT. EN CAJA
    D: U. MEDIDA
    E: OFICINA
    F: OFICINA-DOCENAS
    G: CALLAO 1-A
    H: CALLAO 1-B
    I: CALLAO 2
    (J: DISPONIBLES total, K: U.MED, L: DOC,DEC,UNI SUELTAS) -> se ignoran para importar existencias
    """
    if request.method != 'POST':
        return bad_request_error("Método no permitido", headers)

    # Espera multipart/form-data con el archivo Excel
    file = (
        request.files.get('file')
        or request.files.get('archivo')
        or request.files.get('excel')
        or request.files.get('xlsx')
    )
    if not file or not getattr(file, "filename", ""):
        return bad_request_error("Archivo Excel requerido (multipart/form-data: file)", headers)

    filename_lower = (file.filename or "").lower()
    if not (filename_lower.endswith(".xlsx") or filename_lower.endswith(".xlsm") or filename_lower.endswith(".xltx") or filename_lower.endswith(".xltm")):
        return bad_request_error("Formato inválido. Sube un archivo .xlsx", headers)

    try:
        file_bytes = file.read()
        if not file_bytes:
            return bad_request_error("El archivo está vacío", headers)
        wb = load_workbook(filename=io.BytesIO(file_bytes), data_only=True, read_only=True)
    except Exception as e:
        logging.error(f"Error leyendo Excel: {traceback.format_exc()}")
        return bad_request_error(f"No se pudo leer el Excel: {str(e)}", headers)

    if "Inventario" not in wb.sheetnames:
        return bad_request_error("La hoja requerida 'Inventario' no existe en el Excel", headers)

    ws = wb["Inventario"]

    def _norm_cell(v):
        if v is None:
            return ""
        return str(v).strip().upper()

    def _norm_codigo_producto(v):
        """
        Normaliza el código leído desde Excel para evitar pérdidas típicas:
        - Excel puede convertir códigos a numéricos (123, 123.0) -> "123"
        - textos con espacios invisibles -> strip()
        """
        if v is None:
            return ""
        if isinstance(v, bool):
            return ""
        if isinstance(v, int):
            return str(v).strip()
        if isinstance(v, float):
            try:
                if float(v).is_integer():
                    return str(int(v)).strip()
            except Exception:
                pass
            s = str(v).strip()
            if s.endswith(".0"):
                s = s[:-2]
            return s.strip()
        s = str(v).strip()
        # Caso común: "123.0" como texto
        if s.endswith(".0") and s[:-2].isdigit():
            s = s[:-2]
        return s.strip()

    # Validación mínima del formato (encabezados clave).
    # Hay dos layouts válidos (export actual 12 cols vs export anterior con TOTAL duplicado 13 cols):
    #   Nuevo: DISPONIBLES en J1, DOC… en L1 (columnas E–I = solo 5 tiendas).
    #   Legacy: DISPONIBLES en K1, DOC… en M1 (tras columna J = total existencias).
    # Algunos lectores de .xlsx dejan el texto de celdas combinadas en la celda “siguiente”; por eso se aceptan ambos.
    esperado_base = {
        "A1": "CODIGO",
        "B1": "PRODUCTO",
        "C1": "CANT. EN CAJA",
        "D1": "U. MEDIDA",
        "E1": "EXISTENCIA ALMACEN",
    }
    for addr, texto in esperado_base.items():
        if _norm_cell(ws[addr].value) != texto:
            return bad_request_error(
                "El Excel no coincide con el formato exportado de 'Productos Detallados'. "
                "Vuelve a exportar desde el sistema y edita ese mismo archivo.",
                headers,
            )

    # DISPONIBLES / DOC: no forzar J1/L1 fijos — Excel/SheetJS y celdas combinadas pueden dejar el
    # texto en J o K (formato 12 vs 13 columnas). Se buscan en la fila 1 a partir de la columna J (10).
    doc_label = "DOC,DEC,UNI SUELTAS"
    disp_col = None
    limite = max(int(ws.max_column or 0), 15)
    for col in range(10, limite + 1):
        if _norm_cell(ws.cell(row=1, column=col).value) == "DISPONIBLES":
            disp_col = col
            break
    if disp_col is None:
        return bad_request_error(
            "El Excel no coincide con el formato exportado de 'Productos Detallados'. "
            "En la fila 1 debe figurar el encabezado DISPONIBLES (columna J o K según el export). "
            "Vuelve a exportar desde Stock Total o revisa que no falte esa celda.",
            headers,
        )
    doc_col = None
    for col in range(disp_col + 1, limite + 1):
        if _norm_cell(ws.cell(row=1, column=col).value) == doc_label:
            doc_col = col
            break
    if doc_col is None:
        return bad_request_error(
            "El Excel no coincide con el formato exportado de 'Productos Detallados'. "
            "Falta el encabezado DOC,DEC,UNI SUELTAS a la derecha de DISPONIBLES.",
            headers,
        )

    tiendas_col_existencias = {
        "OFICINA": "E",
        "OFICINA-DOCENAS": "F",
        "CALLAO-1-A": "G",
        "CALLAO-1-B": "H",
        "CALLAO-2": "I",
    }

    def _to_int(value):
        if value is None:
            return 0
        if isinstance(value, (int, float)):
            try:
                return int(value)
            except Exception:
                return 0
        s = str(value).strip()
        if s == "":
            return 0
        # Soportar "12.0" o "12,0"
        s = s.replace(",", ".")
        try:
            return int(float(s))
        except Exception:
            return 0

    # Permitir modo "preview" (no escribe en BD) y "aplicar" (actualiza cant_reg + stock mínimo).
    # NOTA: las existencias NO se pisan directamente en "aplicar"; se devuelven como movimientos sugeridos
    # para que el frontend las registre mediante ENTRADAS (con actas/contraseña).
    modo = "aplicar_directo"
    try:
        raw_data = request.form.get("data") if getattr(request, "form", None) else None
        if raw_data:
            payload = json.loads(raw_data)
            modo = (payload.get("modo") or payload.get("mode") or "aplicar_directo").strip().lower()
    except Exception:
        modo = "aplicar_directo"

    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Cachear ids de tienda
        cursor.execute("SELECT id, codigo FROM tiendas_gestion_sea_callao WHERE codigo IN ('OFICINA', 'OFICINA-DOCENAS', 'CALLAO-1-A', 'CALLAO-1-B', 'CALLAO-2')")
        tiendas_rows = cursor.fetchall() or []
        tienda_id_por_codigo = {r["codigo"]: r["id"] for r in tiendas_rows}

        faltantes_tiendas = [c for c in ["OFICINA", "OFICINA-DOCENAS", "CALLAO-1-A", "CALLAO-1-B", "CALLAO-2"] if c not in tienda_id_por_codigo]
        if faltantes_tiendas:
            return server_error(f"No existen tiendas en BD: {', '.join(faltantes_tiendas)}", headers)

        procesadas = 0
        actualizadas_productos = 0
        actualizadas_stock_min = 0
        omitidas_sin_codigo = 0
        omitidas_producto_no_existe = 0
        productos_no_encontrados = []
        movimientos_sugeridos = []
        salidas_sugeridas = []
        ajustes_negativos = []
        filas_con_cambio_cant_reg_o_stock_min = 0
        preview_detalle = []

        # Encabezados ocupan 2 filas, data inicia desde fila 3
        for row_idx in range(3, ws.max_row + 1):
            codigo_raw = ws[f"A{row_idx}"].value
            codigo = _norm_codigo_producto(codigo_raw)
            if not codigo:
                omitidas_sin_codigo += 1
                continue
            cursor.execute(
                """
                SELECT p.id, p.codigo, p.nombre, p.cantidad_reg_calculo, um_reg.nombre AS unidad_medida_reg
                FROM productos_abastecimiento_callao p
                JOIN unidades_medida_sea_callao um_reg ON p.id_unidad_medida_reg = um_reg.id
                WHERE TRIM(p.codigo) = TRIM(%s)
                """,
                (codigo,)
            )
            prod_row = cursor.fetchone()
            if not prod_row:
                omitidas_producto_no_existe += 1
                if len(productos_no_encontrados) < 200:
                    productos_no_encontrados.append(codigo)
                continue

            id_producto = int(prod_row["id"])
            unidad_medida_reg = prod_row.get("unidad_medida_reg") or "UNIDADES"
            nombre_sistema = (prod_row.get("nombre") or "").strip()
            procesadas += 1

            # Comparar CANT. EN CAJA (C) vs BD para permitir importar solo configuración sin deltas de existencia
            c_excel = _to_int(ws[f"C{row_idx}"].value)
            cr_db_val = int(prod_row.get("cantidad_reg_calculo") or 0)
            fila_difiere_config = c_excel != cr_db_val
            if fila_difiere_config:
                filas_con_cambio_cant_reg_o_stock_min += 1

            # CANT. (columna C) -> cantidad_reg_calculo
            cantidad_reg_calculo = c_excel
            if modo in ("aplicar", "aplicar_directo"):
                cursor.execute(
                    "UPDATE productos_abastecimiento_callao SET cantidad_reg_calculo = %s WHERE id = %s",
                    (cantidad_reg_calculo, id_producto)
                )
                actualizadas_productos += cursor.rowcount

            # Previsualización completa (Excel vs sistema) por producto/tienda
            nombre_excel = ws[f"B{row_idx}"].value
            nombre_excel = str(nombre_excel).strip() if nombre_excel is not None else ""
            unidad_excel = ws[f"D{row_idx}"].value
            unidad_excel = str(unidad_excel).strip().upper() if unidad_excel is not None else ""

            detalle_exist = {}

            # Existencias por tienda (E–I): calcular deltas para movimientos sugeridos
            for codigo_tienda, col in tiendas_col_existencias.items():
                nuevo_val = _to_int(ws[f"{col}{row_idx}"].value)
                id_tienda = tienda_id_por_codigo[codigo_tienda]
                cursor.execute(
                    "SELECT cantidad FROM existencias_almacen_callao WHERE id_producto = %s AND id_tienda = %s",
                    (id_producto, id_tienda)
                )
                ex_row = cursor.fetchone()
                actual_val = int(ex_row["cantidad"]) if ex_row and ex_row.get("cantidad") is not None else 0
                delta = int(nuevo_val) - int(actual_val)

                detalle_exist[codigo_tienda] = {
                    "excel": int(nuevo_val),
                    "sistema": int(actual_val),
                    "delta": int(delta),
                }

                if delta > 0:
                    movimientos_sugeridos.append({
                        "producto": codigo,
                        "nombre": nombre_excel or nombre_sistema,
                        "operacion": "OTROS",
                        "almacen_salida": "CALLAO",
                        "almacen_ingreso": codigo_tienda,
                        "cantidad": delta,
                        "unidad_medida": unidad_medida_reg,
                        "cantidad_anterior": actual_val,
                        "cantidad_objetivo_excel": nuevo_val,
                    })
                elif delta < 0:
                    # Por requerimiento, no generamos salidas automáticamente; reportamos para revisión.
                    ajustes_negativos.append({
                        "producto": codigo,
                        "tienda": codigo_tienda,
                        "cantidad_actual": actual_val,
                        "cantidad_excel": nuevo_val,
                        "delta": delta,
                    })
                    # También devolvemos salidas sugeridas para sincronizar con el Excel (si el front decide aplicarlas).
                    # SALIDA descuenta desde la tienda indicada.
                    salidas_sugeridas.append({
                        "producto": codigo,
                        "nombre": nombre_excel or nombre_sistema,
                        "operacion": "OTROS",
                        "almacen": codigo_tienda,
                        "cantidad": abs(delta),
                        "unidad_medida": unidad_medida_reg,
                        "cantidad_anterior": actual_val,
                        "cantidad_objetivo_excel": nuevo_val,
                    })

            preview_detalle.append({
                "producto": codigo,
                "nombre_excel": nombre_excel,
                "cant_caja_excel": int(c_excel),
                "cant_caja_sistema": int(cr_db_val),
                "unidad_medida_excel": unidad_excel,
                "unidad_medida_sistema": unidad_medida_reg,
                "existencias": detalle_exist,
            })

        if modo == "preview":
            conn.rollback()
        else:
            conn.commit()

        return success_response(
            data={
                "modo": modo,
                "hoja": "Inventario",
                "filas_procesadas": procesadas,
                "productos_actualizados_cant_reg": actualizadas_productos,
                "registros_stock_minimo_upsert": actualizadas_stock_min,
                "filas_omitidas_sin_codigo": omitidas_sin_codigo,
                "filas_omitidas_producto_no_existe": omitidas_producto_no_existe,
                "productos_no_encontrados_muestra": productos_no_encontrados,
                "movimientos_entrada_sugeridos": movimientos_sugeridos,
                "movimientos_salida_sugeridos": salidas_sugeridas,
                "ajustes_negativos": ajustes_negativos,
                "filas_con_cambio_cant_reg_o_stock_min": filas_con_cambio_cant_reg_o_stock_min,
                "preview_detalle": preview_detalle,
            },
            message="Excel procesado correctamente",
            headers=headers
        )
    except Exception as e:
        conn.rollback()
        logging.error(f"Error importando Excel: {traceback.format_exc()}")
        return server_error(f"Error importando Excel: {str(e)}", headers)
    finally:
        cursor.close()
        conn.close()

# --- MÓDULO HISTORIAL DE CAMBIOS ENTRADAS/SALIDAS/TRASLADOS ---
def get_historial_entradas(request, headers):
    """Obtiene el historial de cambios de entradas (tabla cambios_entrada_callao)."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        sql = """
            SELECT 
                ce.id_movimiento_entrada as id_entrada,
                ce.fecha_cambio as fecha,
                p.codigo as producto_codigo, p.nombre as producto_nombre,
                tos.nombre as operacion,
                ts.codigo as tienda_salida_codigo,
                ti.codigo as tienda_ingreso_codigo,
                ce.operador,
                me.cantidad as cantidad,
                ce.cantidad as cantidad_anterior,
                um.nombre as unidad_medida,
                ce.entregado_por, ce.registrado_por, ce.observaciones,
                ce.motivo_cambio,
                ce.fecha_movimiento_orig,
                (
                    SELECT COUNT(*)
                    FROM movimientos_actas_callao ma
                    WHERE ma.id_movimiento_entrada = me.id
                ) as total_actas,
                (
                    SELECT GROUP_CONCAT(ma.url_imagen SEPARATOR ',')
                    FROM movimientos_actas_callao ma
                    WHERE ma.id_movimiento_entrada = me.id
                ) as actas_urls
            FROM cambios_entrada_callao ce
            JOIN movimientos_entrada_callao me ON ce.id_movimiento_entrada = me.id
            JOIN productos_abastecimiento_callao p ON ce.id_producto = p.id
            JOIN tipos_operacion_sea_callao tos ON ce.id_tipo_operacion = tos.id
            JOIN tiendas_gestion_sea_callao ts ON ce.id_tienda_salida = ts.id
            JOIN tiendas_gestion_sea_callao ti ON ce.id_tienda_ingreso = ti.id
            JOIN unidades_medida_sea_callao um ON ce.id_unidad_medida = um.id
            ORDER BY ce.fecha_cambio DESC
        """
        cursor.execute(sql)
        historial = cursor.fetchall()
        return success_response(data=historial, message="Historial de entradas obtenido correctamente", headers=headers)
    finally:
        cursor.close()
        conn.close()

def get_historial_salidas(request, headers):
    """Obtiene el historial de cambios de salidas (tabla cambios_salida_callao)."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        sql = """
            SELECT 
                cs.id_movimiento_salida as id_salida,
                cs.fecha_cambio as fecha,
                p.codigo as producto_codigo, p.nombre as producto_nombre,
                tos.nombre as operacion, cs.nro_comprobante, cs.asesor,
                ms.cantidad as cantidad,
                cs.cantidad as cantidad_anterior,
                um.nombre as unidad_medida,
                t.codigo as tienda_codigo,
                cs.entregado_por, cs.registrado_por, cs.observaciones,
                cs.motivo_cambio,
                cs.fecha_movimiento_orig,
                (
                    SELECT COUNT(*)
                    FROM movimientos_actas_callao ma
                    WHERE ma.id_movimiento_salida = ms.id
                ) as total_actas,
                (
                    SELECT GROUP_CONCAT(ma.url_imagen SEPARATOR ',')
                    FROM movimientos_actas_callao ma
                    WHERE ma.id_movimiento_salida = ms.id
                ) as actas_urls
            FROM cambios_salida_callao cs
            JOIN movimientos_salida_callao ms ON cs.id_movimiento_salida = ms.id
            JOIN productos_abastecimiento_callao p ON cs.id_producto = p.id
            JOIN tipos_operacion_sea_callao tos ON cs.id_tipo_operacion = tos.id
            JOIN tiendas_gestion_sea_callao t ON cs.id_tienda = t.id
            JOIN unidades_medida_sea_callao um ON cs.id_unidad_medida = um.id
            ORDER BY cs.fecha_cambio DESC
        """
        cursor.execute(sql)
        historial = cursor.fetchall()
        return success_response(data=historial, message="Historial de salidas obtenido correctamente", headers=headers)
    finally:
        cursor.close()
        conn.close()

def get_historial_traslados(request, headers):
    """Obtiene el historial de cambios de traslados (tabla cambios_traslado_callao)."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        sql = """
            SELECT 
                ct.id_movimiento_traslado as id_traslado,
                ct.fecha_cambio as fecha,
                p.codigo as producto_codigo, p.nombre as producto_nombre,
                tos.nombre as operacion,
                ts.codigo as tienda_salida_codigo,
                ti.codigo as tienda_ingreso_codigo,
                ct.operador,
                mt.cantidad as cantidad,
                ct.cantidad as cantidad_anterior,
                um.nombre as unidad_medida,
                ct.entregado_por, ct.registrado_por, ct.observaciones,
                ct.motivo_cambio,
                ct.fecha_movimiento_orig,
                (
                    SELECT COUNT(*)
                    FROM movimientos_actas_callao ma
                    WHERE ma.id_movimiento_traslado = mt.id
                ) as total_actas,
                (
                    SELECT GROUP_CONCAT(ma.url_imagen SEPARATOR ',')
                    FROM movimientos_actas_callao ma
                    WHERE ma.id_movimiento_traslado = mt.id
                ) as actas_urls
            FROM cambios_traslado_callao ct
            JOIN movimientos_traslado_callao mt ON ct.id_movimiento_traslado = mt.id
            JOIN productos_abastecimiento_callao p ON ct.id_producto = p.id
            JOIN tipos_operacion_sea_callao tos ON ct.id_tipo_operacion = tos.id
            JOIN tiendas_gestion_sea_callao ts ON ct.id_tienda_salida = ts.id
            JOIN tiendas_gestion_sea_callao ti ON ct.id_tienda_ingreso = ti.id
            JOIN unidades_medida_sea_callao um ON ct.id_unidad_medida = um.id
            ORDER BY ct.fecha_cambio DESC
        """
        cursor.execute(sql)
        historial = cursor.fetchall()
        return success_response(data=historial, message="Historial de traslados obtenido correctamente", headers=headers)
    finally:
        cursor.close()
        conn.close()


# --- MÓDULO ABASTECIMIENTO ---
def calcular_abastecimiento(request, headers):
    """
    Calcula la vista previa del abastecimiento.
    Similar a la lógica de la hoja 'Abastecimiento'.
    """
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Consulta base para obtener stock mínimo y existencias por tienda
        sql = """
            SELECT 
                p.id,
                p.codigo,
                p.nombre,
                p.cantidad_reg_calculo,
                um_reg.nombre AS unidad_medida_reg,
                -- Stock mínimo por tienda
                sm_oficina.stock_minimo  AS sm_oficina,
                sm_oficina_docenas.stock_minimo  AS sm_oficina_docenas,
                sm_callao1a.stock_minimo  AS sm_callao1_a,
                sm_callao1b.stock_minimo  AS sm_callao1_b,
                sm_callao2.stock_minimo  AS sm_callao2,
                -- Existencias por tienda
                COALESCE(ex_oficina.cantidad, 0)  AS existencia_oficina,
                COALESCE(ex_oficina_docenas.cantidad, 0)  AS existencia_oficina_docenas,
                COALESCE(ex_callao1a.cantidad, 0)  AS existencia_callao1a,
                COALESCE(ex_callao1b.cantidad, 0)  AS existencia_callao1b,
                COALESCE(ex_callao2.cantidad, 0)  AS existencia_callao2
            FROM productos_abastecimiento_callao p
            JOIN unidades_medida_sea_callao um_reg ON p.id_unidad_medida_reg = um_reg.id
            LEFT JOIN stock_minimo_almacen_callao sm_oficina  ON p.id = sm_oficina.id_producto  AND sm_oficina.id_tienda  = (SELECT id FROM tiendas_gestion_sea_callao WHERE codigo = 'OFICINA')
            LEFT JOIN stock_minimo_almacen_callao sm_oficina_docenas  ON p.id = sm_oficina_docenas.id_producto  AND sm_oficina_docenas.id_tienda  = (SELECT id FROM tiendas_gestion_sea_callao WHERE codigo = 'OFICINA-DOCENAS')
            LEFT JOIN stock_minimo_almacen_callao sm_callao1a  ON p.id = sm_callao1a.id_producto  AND sm_callao1a.id_tienda  = (SELECT id FROM tiendas_gestion_sea_callao WHERE codigo = 'CALLAO-1-A')
            LEFT JOIN stock_minimo_almacen_callao sm_callao1b  ON p.id = sm_callao1b.id_producto  AND sm_callao1b.id_tienda  = (SELECT id FROM tiendas_gestion_sea_callao WHERE codigo = 'CALLAO-1-B')
            LEFT JOIN stock_minimo_almacen_callao sm_callao2  ON p.id = sm_callao2.id_producto  AND sm_callao2.id_tienda  = (SELECT id FROM tiendas_gestion_sea_callao WHERE codigo = 'CALLAO-2')
            LEFT JOIN existencias_almacen_callao ex_oficina  ON p.id = ex_oficina.id_producto  AND ex_oficina.id_tienda  = (SELECT id FROM tiendas_gestion_sea_callao WHERE codigo = 'OFICINA')
            LEFT JOIN existencias_almacen_callao ex_oficina_docenas  ON p.id = ex_oficina_docenas.id_producto  AND ex_oficina_docenas.id_tienda  = (SELECT id FROM tiendas_gestion_sea_callao WHERE codigo = 'OFICINA-DOCENAS')
            LEFT JOIN existencias_almacen_callao ex_callao1a  ON p.id = ex_callao1a.id_producto  AND ex_callao1a.id_tienda  = (SELECT id FROM tiendas_gestion_sea_callao WHERE codigo = 'CALLAO-1-A')
            LEFT JOIN existencias_almacen_callao ex_callao1b  ON p.id = ex_callao1b.id_producto  AND ex_callao1b.id_tienda  = (SELECT id FROM tiendas_gestion_sea_callao WHERE codigo = 'CALLAO-1-B')
            LEFT JOIN existencias_almacen_callao ex_callao2  ON p.id = ex_callao2.id_producto  AND ex_callao2.id_tienda  = (SELECT id FROM tiendas_gestion_sea_callao WHERE codigo = 'CALLAO-2');
        """
        cursor.execute(sql)
        productos_base = cursor.fetchall()

        resultados = []
        import math
        for row in productos_base:
            sm_o = row.get('sm_oficina') or 0
            sm_od = row.get('sm_oficina_docenas') or 0
            sm_c1a = row.get('sm_callao1_a') or 0
            sm_c1b = row.get('sm_callao1_b') or 0
            sm_c2 = row.get('sm_callao2') or 0
            ex_o = row.get('existencia_oficina') or 0
            ex_od = row.get('existencia_oficina_docenas') or 0
            ex_c1a = row.get('existencia_callao1_a') or 0
            ex_c1b = row.get('existencia_callao1_b') or 0
            ex_c2 = row.get('existencia_callao2') or 0

            abast_oficina = max(0, int(sm_o) - int(ex_o))
            abast_oficina_docenas = max(0, int(sm_od) - int(ex_od))
            abast_callao1a = max(0, int(sm_c1a) - int(ex_c1a))
            abast_callao1b = max(0, int(sm_c1b) - int(ex_c1b))
            abast_callao2 = max(0, int(sm_c2) - int(ex_c2))

            total_abastecer_unidades = abast_oficina + abast_oficina_docenas + abast_callao1a + abast_callao1b + abast_callao2
            cantidad_reg = row['cantidad_reg_calculo'] if row.get('cantidad_reg_calculo') and row['cantidad_reg_calculo'] > 0 else 1
            abastecer_cajas = math.ceil(total_abastecer_unidades / cantidad_reg) if cantidad_reg else 0

            enviar = 'SI' if abastecer_cajas > 0 else 'NO'

            resultados.append({
                'codigo': row['codigo'],
                'nombre': row['nombre'],
                'cantidad': cantidad_reg,
                'unidad_medida': row['unidad_medida_reg'],
                'abastecer_oficina': abast_oficina,
                'abastecer_oficina_docenas': abast_oficina_docenas,
                'abastecer_callao1a': abast_callao1a,
                'abastecer_callao1b': abast_callao1b,
                'abastecer_callao2': abast_callao2,
                'abastecer_cajas': abastecer_cajas,
                'enviar': enviar
            })

        return success_response(data=resultados, message="Cálculo de abastecimiento realizado", headers=headers)

    finally:
        cursor.close()
        conn.close()

def guardar_abastecimiento(request, headers):
    """
    Guarda un abastecimiento con validación de contraseña para actas faltantes
    y subida de múltiples imágenes a GCS.
    """
    # 1. Obtener datos del formulario (multipart/form-data)
    # El JSON de datos suele venir en un campo llamado 'data' o similar
    form_data = request.form.get('data')
    if not form_data:
        return bad_request_error("No se recibieron datos de abastecimiento", headers)
    
    data = json.loads(form_data)
    nombre_abastecimiento = (data.get('nombre_abastecimiento') or '').strip().upper()
    registrado_por = (data.get('registrado_por') or '').strip().upper()
    detalles = data.get('detalles')
    password_cliente = data.get('password_autorizacion') # Contraseña enviada desde el front (ya no es requerida aquí)
    
    # 2. Obtener archivos (Actas)
    files = request.files.getlist('actas') # 'actas' es el nombre del campo en el input file múltiple

    if not nombre_abastecimiento or not registrado_por or detalles is None:
        return bad_request_error("Faltan campos obligatorios", headers)

    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Actas opcionales: el abastecimiento puede guardarse sin imágenes.

        cursor.execute(
            "INSERT INTO abastecimiento_cabecera_callao (nombre, registrado_por) VALUES (%s, %s)",
            (nombre_abastecimiento, registrado_por),
        )
        id_cabecera = cursor.lastrowid
        if not id_cabecera:
            raise Exception("No se pudo obtener el ID de la cabecera")

        sql_ins_detalle = """
            INSERT INTO abastecimiento_detalle_callao (
                id_abastecimiento, id_producto, cantidad_reg_calculo, id_unidad_medida,
                cant_almacen_oficina, cant_almacen_oficina_docenas, cant_almacen_callao_1_a, cant_almacen_callao_1_b, cant_almacen_callao_2,
                abastecer_cajas, enviar
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        for detalle in detalles:
            producto_id = _get_id_producto_por_codigo_o_nombre(detalle.get('codigo'), conn)
            if not producto_id:
                continue

            id_um = int(detalle.get('id_unidad_medida') or 0)
            cant_reg = int(detalle.get('cantidad_reg_calculo') or 0)
            if id_um <= 0 or cant_reg < 0:
                raise ValueError(f"Detalle inválido para producto {detalle.get('codigo')}: id_unidad_medida y cantidad_reg_calculo son obligatorios")

            cursor.execute(
                sql_ins_detalle,
                (
                    id_cabecera,
                    producto_id,
                    cant_reg,
                    id_um,
                    int(detalle.get('cant_almacen_oficina') or 0),
                    int(detalle.get('cant_almacen_oficina_docenas') or 0),
                    int(detalle.get('cant_almacen_callao_1_a') or 0),
                    int(detalle.get('cant_almacen_callao_1_b') or 0),
                    int(detalle.get('cant_almacen_callao_2') or 0),
                    int(detalle.get('abastecer_cajas') or 0),
                    detalle.get('enviar', 'NO'),
                ),
            )

        # 5. Subir Actas a GCS e insertar en la nueva tabla
        if files:
            for file in files:
                if file.filename != '':
                    url_publica = upload_to_gcs(file) # Tu función existente
                    if url_publica:
                        sql_acta = "INSERT INTO abastecimiento_actas_callao (id_abastecimiento, nombre_imagen, url_imagen) VALUES (%s, %s, %s)"
                        cursor.execute(sql_acta, (id_cabecera, file.filename, url_publica))

        conn.commit()
        return created_response(data={'id_abastecimiento': id_cabecera}, message="Abastecimiento y actas guardados exitosamente", headers=headers)

    except Exception as e:
        conn.rollback()
        logging.error(f"Error: {traceback.format_exc()}")
        return server_error(str(e), headers)
    finally:
        cursor.close()
        conn.close()

def get_historial_abastecimientos(request, headers):
    """Obtiene la lista de nombres de abastecimientos guardados (para el combo box)."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        sql = "SELECT id, nombre, registrado_por, fecha_registro FROM abastecimiento_cabecera_callao ORDER BY fecha_registro DESC"
        cursor.execute(sql)
        historial = cursor.fetchall()
        return success_response(data=historial, message="Historial de abastecimientos obtenido", headers=headers)
    finally:
        cursor.close()
        conn.close()

def get_detalle_abastecimiento(request, headers, nombre_abastecimiento):
    """
    Obtiene el detalle de un abastecimiento específico por su nombre.
    Idealmente usarías el ID, pero tu descripción dice que filtras por nombre.
    """
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Obtener la cabecera
        sql_cab = "SELECT id, nombre, registrado_por, fecha_registro FROM abastecimiento_cabecera_callao WHERE nombre = %s"
        cursor.execute(sql_cab, (nombre_abastecimiento,))
        cabecera = cursor.fetchone()
        if not cabecera:
            return not_found_error(f"Abastecimiento '{nombre_abastecimiento}' no encontrado", headers)

        # Obtener el detalle
        sql_det = """
            SELECT 
                p.codigo, p.nombre,
                ad.cantidad_reg_calculo as cantidad,
                um.nombre as unidad_medida,
                ad.cant_almacen_oficina,
                ad.cant_almacen_oficina_docenas,
                ad.cant_almacen_callao_1_a,
                ad.cant_almacen_callao_1_b,
                ad.cant_almacen_callao_2,
                ad.abastecer_cajas, ad.enviar
            FROM abastecimiento_detalle_callao ad
            JOIN productos_abastecimiento_callao p ON ad.id_producto = p.id
            JOIN unidades_medida_sea_callao um ON ad.id_unidad_medida = um.id
            WHERE ad.id_abastecimiento = %s
        """
        cursor.execute(sql_det, (cabecera['id'],))
        detalles = cursor.fetchall()

        response_data = {
            'cabecera': cabecera,
            'detalles': detalles
        }
        return success_response(data=response_data, message="Detalle de abastecimiento obtenido", headers=headers)
    finally:
        cursor.close()
        conn.close()

def get_historial_abastecimiento_general(request, headers):
    """
    Obtiene el historial general de todos los abastecimientos (como la hoja final).
    """
    conn = get_connection()
    cursor = conn.cursor()
    try:
        sql = """
            SELECT 
                p.codigo, p.nombre,
                ad.cantidad_reg_calculo as cantidad,
                um.nombre as unidad_medida,
                ad.cant_almacen_oficina,
                ad.cant_almacen_oficina_docenas,
                ad.cant_almacen_callao_1_a,
                ad.cant_almacen_callao_1_b,
                ad.cant_almacen_callao_2,
                ad.abastecer_cajas, ad.enviar,
                ac.nombre as nombre_abastecimiento,
                ac.fecha_registro,
                ac.registrado_por
            FROM abastecimiento_detalle_callao ad
            JOIN abastecimiento_cabecera_callao ac ON ad.id_abastecimiento = ac.id
            JOIN productos_abastecimiento_callao p ON ad.id_producto = p.id
            JOIN unidades_medida_sea_callao um ON ad.id_unidad_medida = um.id
            ORDER BY ac.fecha_registro DESC, p.nombre
        """
        cursor.execute(sql)
        historial = cursor.fetchall()
        return success_response(data=historial, message="Historial general de abastecimientos obtenido", headers=headers)
    finally:
        cursor.close()
        conn.close()

def get_actas_abastecimiento(request, headers, id_abastecimiento):
    """
    Obtiene las actas (imágenes) asociadas a un abastecimiento específico.
    """
    conn = get_connection()
    cursor = conn.cursor()
    try:
        sql = """
            SELECT 
                aa.id,
                aa.id_abastecimiento,
                aa.nombre_imagen,
                aa.url_imagen,
                aa.fecha_subida,
                ac.registrado_por,
                ac.fecha_registro
            FROM abastecimiento_actas_callao aa
            JOIN abastecimiento_cabecera_callao ac ON aa.id_abastecimiento = ac.id
            WHERE aa.id_abastecimiento = %s
            ORDER BY aa.fecha_subida DESC
        """
        cursor.execute(sql, (id_abastecimiento,))
        actas = cursor.fetchall()
        return success_response(data=actas, message="Actas obtenidas correctamente", headers=headers)
    finally:
        cursor.close()
        conn.close()

def subir_actas_abastecimiento(request, headers, id_abastecimiento):
    """
    Sube actas (imágenes) a un abastecimiento existente.
    Requiere validación de contraseña si no hay archivos.
    """
    # 1. Obtener datos del formulario (multipart/form-data)
    form_data = request.form.get('data')
    if not form_data:
        return bad_request_error("No se recibieron datos", headers)
    
    data = json.loads(form_data)
    password_cliente = (data.get("password_autorizacion") or "").strip()

    # 2. Obtener archivos (Actas)
    files = request.files.getlist('actas')
    
    # 3. Verificar que el abastecimiento existe
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT id FROM abastecimiento_cabecera_callao WHERE id = %s", (id_abastecimiento,))
        abastecimiento = cursor.fetchone()
        if not abastecimiento:
            return not_found_error(f"Abastecimiento con ID {id_abastecimiento} no encontrado", headers)
        
        # 4. VALIDACIÓN DE CONTRASEÑA (siempre requerida para subir actas a un abastecimiento existente)
        if not files or len(files) == 0:
            return bad_request_error("Se requiere al menos un archivo para subir", headers)
        
        pass_sistema = _password_efectiva_actas_abastecimiento(cursor)
        if not pass_sistema:
            return (
                json.dumps({
                    "message": "No hay contraseña configurada en el sistema (pass_abastecimiento_sin_acta ni pass_movimiento_sin_acta).",
                    "error": "Contraseña de sistema no configurada",
                }),
                403,
                headers,
            )
        if not password_cliente or password_cliente != pass_sistema:
            return (json.dumps({"message": "Se requiere una contraseña válida para subir actas"}), 403, headers)
        
        # 5. Subir Actas a GCS e insertar en la tabla
        actas_subidas = []
        for file in files:
            if file.filename != '':
                url_publica = upload_to_gcs(file)
                if url_publica:
                    sql_acta = "INSERT INTO abastecimiento_actas_callao (id_abastecimiento, nombre_imagen, url_imagen) VALUES (%s, %s, %s)"
                    cursor.execute(sql_acta, (id_abastecimiento, file.filename, url_publica))
                    actas_subidas.append({
                        'nombre_imagen': file.filename,
                        'url_imagen': url_publica
                    })
        
        conn.commit()
        return created_response(
            data={'id_abastecimiento': id_abastecimiento, 'actas_subidas': actas_subidas},
            message=f"{len(actas_subidas)} acta(s) subida(s) exitosamente",
            headers=headers
        )
        
    except Exception as e:
        conn.rollback()
        logging.error(f"Error subiendo actas: {traceback.format_exc()}")
        return server_error(str(e), headers)
    finally:
        cursor.close()
        conn.close()

def cambiar_password_abastecimiento(request, headers):
    """
    Cambia la contraseña para guardar abastecimiento sin actas.
    Requiere la contraseña anterior y la nueva contraseña.
    """
    data = request.get_json()
    if not data:
        return bad_request_error("Datos JSON inválidos", headers)
    
    password_anterior = data.get('password_anterior')
    password_nueva = data.get('password_nueva')
    
    if not password_anterior or not password_nueva:
        return bad_request_error("Se requieren password_anterior y password_nueva", headers)
    
    if len(password_nueva) < 4:
        return bad_request_error("La nueva contraseña debe tener al menos 4 caracteres", headers)
    
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Verificar contraseña anterior
        cursor.execute("SELECT valor FROM configuracion_sistema_callao WHERE clave = 'pass_abastecimiento_sin_acta'")
        res_config = cursor.fetchone()
        pass_actual = res_config['valor'] if res_config else None
        
        if not pass_actual or password_anterior != pass_actual:
            return bad_request_error("La contraseña anterior es incorrecta", headers)
        
        # Actualizar contraseña
        cursor.execute(
            "UPDATE configuracion_sistema_callao SET valor = %s, ultima_actualizacion = NOW() WHERE clave = 'pass_abastecimiento_sin_acta'",
            (password_nueva,)
        )
        
        if cursor.rowcount == 0:
            # Si no existe, crear el registro
            cursor.execute(
                "INSERT INTO configuracion_sistema_callao (clave, valor) VALUES ('pass_abastecimiento_sin_acta', %s)",
                (password_nueva,)
            )
        
        conn.commit()
        return success_response(message="Contraseña actualizada exitosamente", headers=headers)
    except Exception as e:
        conn.rollback()
        logging.error(f"Error cambiando contraseña: {traceback.format_exc()}")
        return server_error(f"Error al cambiar la contraseña: {str(e)}", headers)
    finally:
        cursor.close()
        conn.close()

# ============================================================
# NUEVOS ENDPOINTS DE CASCADA Y GESTIÓN DE ACTAS
# ============================================================

def get_entradas_cascada(request, headers):
    """
    Obtiene las entradas agrupadas por código_carga (vista cascada).
    Estructura: codigo_carga -> array de detalles de cada entrada
    """
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Obtener todas las entradas agrupadas por código_carga.
        # Si existe me.codigo_carga se prioriza para soportar masivos sin actas.
        tiene_codigo_carga_en_me = _tabla_tiene_columna(cursor, 'movimientos_entrada_callao', 'codigo_carga')
        expr_codigo_carga = """
                COALESCE(
                  me.codigo_carga,
                  (SELECT ma2.codigo_carga FROM movimientos_actas_callao ma2
                   WHERE ma2.id_movimiento_entrada = me.id
                     AND ma2.codigo_carga IS NOT NULL AND CHAR_LENGTH(TRIM(ma2.codigo_carga)) > 0
                   ORDER BY ma2.fecha_subida DESC LIMIT 1),
                  CONCAT('ENT-', me.id)
                ) AS codigo_carga,
        """ if tiene_codigo_carga_en_me else """
                COALESCE(
                  (SELECT ma2.codigo_carga FROM movimientos_actas_callao ma2
                   WHERE ma2.id_movimiento_entrada = me.id
                     AND ma2.codigo_carga IS NOT NULL AND CHAR_LENGTH(TRIM(ma2.codigo_carga)) > 0
                   ORDER BY ma2.fecha_subida DESC LIMIT 1),
                  CONCAT('ENT-', me.id)
                ) AS codigo_carga,
        """

        sql = f"""
            SELECT 
                {expr_codigo_carga}
                me.id,
                me.fecha_registro,
                p.codigo as producto_codigo,
                p.nombre as producto_nombre,
                tos.nombre as operacion,
                ts.codigo as tienda_salida_codigo,
                ts.nombre as tienda_salida_nombre,
                ti.codigo as tienda_ingreso_codigo,
                ti.nombre as tienda_ingreso_nombre,
                me.operador,
                me.cantidad,
                um.nombre as unidad_medida,
                me.entregado_por,
                me.registrado_por,
                me.observaciones,
                me.fecha_actualizacion,
                me.motivo_cambio
            FROM movimientos_entrada_callao me
            JOIN productos_abastecimiento_callao p ON me.id_producto = p.id
            JOIN tipos_operacion_sea_callao tos ON me.id_tipo_operacion = tos.id
            JOIN tiendas_gestion_sea_callao ts ON me.id_tienda_salida = ts.id
            JOIN tiendas_gestion_sea_callao ti ON me.id_tienda_ingreso = ti.id
            JOIN unidades_medida_sea_callao um ON me.id_unidad_medida = um.id
            ORDER BY me.fecha_registro DESC
        """
        cursor.execute(sql)
        todas_entradas = cursor.fetchall()

        # Obtener actas SOLO de entradas (para este endpoint) y enriquecer con fecha/hora y registrador
        sql_actas = """
            SELECT 
                ma.id,
                ma.id_movimiento_entrada,
                ma.id_movimiento_salida,
                ma.nombre_imagen,
                ma.url_imagen,
                ma.codigo_carga,
                ma.fecha_subida,
                me.registrado_por AS registrado_por
            FROM movimientos_actas_callao ma
            LEFT JOIN movimientos_entrada_callao me ON ma.id_movimiento_entrada = me.id
            WHERE ma.codigo_carga IS NOT NULL
              AND ma.id_movimiento_entrada IS NOT NULL
        """
        cursor.execute(sql_actas)
        todas_actas = cursor.fetchall()

        # Agrupar actas por código_carga (dedupe por URL para no repetir la misma imagen N veces)
        actas_por_carga = {}
        actas_vistas = set()
        for acta in todas_actas:
            codigo_carga = acta['codigo_carga']
            dedupe_key = (codigo_carga, acta.get('url_imagen') or '')
            if dedupe_key in actas_vistas:
                continue
            actas_vistas.add(dedupe_key)
            if codigo_carga not in actas_por_carga:
                actas_por_carga[codigo_carga] = []
            actas_por_carga[codigo_carga].append(acta)

        # Agrupar entradas por código_carga
        cascada = {}
        for entrada in todas_entradas:
            codigo_carga = entrada['codigo_carga']
            if codigo_carga not in cascada:
                cascada[codigo_carga] = {
                    'codigo_carga': codigo_carga,
                    'fecha_primera': entrada['fecha_registro'],
                    'cantidad_items': 0,
                    'operador': entrada['operador'],
                    'detalles': [],
                    'actas': actas_por_carga.get(codigo_carga, [])
                }
            cascada[codigo_carga]['detalles'].append(entrada)
            cascada[codigo_carga]['cantidad_items'] += 1

        # Convertir a lista ordenada
        resultado = list(cascada.values())
        return success_response(data=resultado, message="Entradas cascada obtenidas correctamente", headers=headers)

    finally:
        cursor.close()
        conn.close()

def get_salidas_cascada(request, headers):
    """
    Obtiene las salidas agrupadas por código_carga (vista cascada).
    """
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Obtener todas las salidas agrupadas por código_carga.
        # Si existe ms.codigo_carga se prioriza para soportar masivos sin actas.
        tiene_codigo_carga_en_ms = _tabla_tiene_columna(cursor, 'movimientos_salida_callao', 'codigo_carga')
        expr_codigo_carga = """
                COALESCE(
                  ms.codigo_carga,
                  (SELECT ma2.codigo_carga FROM movimientos_actas_callao ma2
                   WHERE ma2.id_movimiento_salida = ms.id
                     AND ma2.codigo_carga IS NOT NULL AND CHAR_LENGTH(TRIM(ma2.codigo_carga)) > 0
                   ORDER BY ma2.fecha_subida DESC LIMIT 1),
                  CONCAT('SAL-', ms.id)
                ) AS codigo_carga,
        """ if tiene_codigo_carga_en_ms else """
                COALESCE(
                  (SELECT ma2.codigo_carga FROM movimientos_actas_callao ma2
                   WHERE ma2.id_movimiento_salida = ms.id
                     AND ma2.codigo_carga IS NOT NULL AND CHAR_LENGTH(TRIM(ma2.codigo_carga)) > 0
                   ORDER BY ma2.fecha_subida DESC LIMIT 1),
                  CONCAT('SAL-', ms.id)
                ) AS codigo_carga,
        """
        sql = f"""
            SELECT 
                {expr_codigo_carga}
                ms.id,
                ms.fecha_registro,
                p.codigo as producto_codigo,
                p.nombre as producto_nombre,
                tos.nombre as operacion,
                ms.nro_comprobante,
                ms.asesor,
                ms.cantidad,
                um.nombre as unidad_medida,
                t.codigo as tienda_codigo,
                t.nombre as tienda_nombre,
                ms.entregado_por,
                ms.registrado_por,
                ms.observaciones,
                ms.fecha_actualizacion,
                ms.motivo_cambio
            FROM movimientos_salida_callao ms
            JOIN productos_abastecimiento_callao p ON ms.id_producto = p.id
            JOIN tipos_operacion_sea_callao tos ON ms.id_tipo_operacion = tos.id
            JOIN tiendas_gestion_sea_callao t ON ms.id_tienda = t.id
            JOIN unidades_medida_sea_callao um ON ms.id_unidad_medida = um.id
            ORDER BY ms.fecha_registro DESC
        """
        cursor.execute(sql)
        todas_salidas = cursor.fetchall()

        # Obtener actas SOLO de salidas (para este endpoint) y enriquecer con fecha/hora y registrador
        sql_actas = """
            SELECT 
                ma.id,
                ma.id_movimiento_entrada,
                ma.id_movimiento_salida,
                ma.nombre_imagen,
                ma.url_imagen,
                ma.codigo_carga,
                ma.fecha_subida,
                ms.registrado_por AS registrado_por
            FROM movimientos_actas_callao ma
            LEFT JOIN movimientos_salida_callao ms ON ma.id_movimiento_salida = ms.id
            WHERE ma.codigo_carga IS NOT NULL
              AND ma.id_movimiento_salida IS NOT NULL
        """
        cursor.execute(sql_actas)
        todas_actas = cursor.fetchall()

        actas_por_carga = {}
        actas_vistas = set()
        for acta in todas_actas:
            codigo_carga = acta['codigo_carga']
            dedupe_key = (codigo_carga, acta.get('url_imagen') or '')
            if dedupe_key in actas_vistas:
                continue
            actas_vistas.add(dedupe_key)
            if codigo_carga not in actas_por_carga:
                actas_por_carga[codigo_carga] = []
            actas_por_carga[codigo_carga].append(acta)

        cascada = {}
        for salida in todas_salidas:
            codigo_carga = salida['codigo_carga']
            if codigo_carga not in cascada:
                cascada[codigo_carga] = {
                    'codigo_carga': codigo_carga,
                    'fecha_primera': salida['fecha_registro'],
                    'cantidad_items': 0,
                    'asesor': salida['asesor'],
                    'detalles': [],
                    'actas': actas_por_carga.get(codigo_carga, [])
                }
            cascada[codigo_carga]['detalles'].append(salida)
            cascada[codigo_carga]['cantidad_items'] += 1

        resultado = list(cascada.values())
        return success_response(data=resultado, message="Salidas cascada obtenidas correctamente", headers=headers)

    finally:
        cursor.close()
        conn.close()

def get_traslados_cascada(request, headers):
    """
    Obtiene los traslados agrupados por código_carga (vista cascada).
    """
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Si existe mg.codigo_carga se prioriza para soportar masivos sin actas.
        tiene_codigo_carga_en_mg = _tabla_tiene_columna(cursor, 'movimientos_traslado_callao', 'codigo_carga')
        expr_codigo_carga = """
                COALESCE(
                  mg.codigo_carga,
                  (SELECT ma2.codigo_carga FROM movimientos_actas_callao ma2
                   WHERE ma2.id_movimiento_traslado = mg.id
                     AND ma2.codigo_carga IS NOT NULL AND CHAR_LENGTH(TRIM(ma2.codigo_carga)) > 0
                   ORDER BY ma2.fecha_subida DESC LIMIT 1),
                  CONCAT('TRA-', mg.id)
                ) AS codigo_carga,
        """ if tiene_codigo_carga_en_mg else """
                COALESCE(
                  (SELECT ma2.codigo_carga FROM movimientos_actas_callao ma2
                   WHERE ma2.id_movimiento_traslado = mg.id
                     AND ma2.codigo_carga IS NOT NULL AND CHAR_LENGTH(TRIM(ma2.codigo_carga)) > 0
                   ORDER BY ma2.fecha_subida DESC LIMIT 1),
                  CONCAT('TRA-', mg.id)
                ) AS codigo_carga,
        """
        sql = f"""
            SELECT 
                {expr_codigo_carga}
                mg.id,
                mg.fecha_registro,
                p.codigo as producto_codigo,
                p.nombre as producto_nombre,
                tos.nombre as operacion,
                ts.codigo as tienda_salida_codigo,
                ts.nombre as tienda_salida_nombre,
                ti.codigo as tienda_ingreso_codigo,
                ti.nombre as tienda_ingreso_nombre,
                mg.operador,
                mg.cantidad,
                um.nombre as unidad_medida,
                mg.entregado_por,
                mg.registrado_por,
                mg.observaciones,
                mg.fecha_actualizacion,
                mg.motivo_cambio
            FROM movimientos_traslado_callao mg
            JOIN productos_abastecimiento_callao p ON mg.id_producto = p.id
            JOIN tipos_operacion_sea_callao tos ON mg.id_tipo_operacion = tos.id
            JOIN tiendas_gestion_sea_callao ts ON mg.id_tienda_salida = ts.id
            JOIN tiendas_gestion_sea_callao ti ON mg.id_tienda_ingreso = ti.id
            JOIN unidades_medida_sea_callao um ON mg.id_unidad_medida = um.id
            ORDER BY mg.fecha_registro DESC
        """
        cursor.execute(sql)
        todos_traslados = cursor.fetchall()

        sql_actas = """
            SELECT 
                ma.id,
                ma.id_movimiento_traslado,
                ma.nombre_imagen,
                ma.url_imagen,
                ma.codigo_carga,
                ma.fecha_subida,
                mg.registrado_por AS registrado_por
            FROM movimientos_actas_callao ma
            LEFT JOIN movimientos_traslado_callao mg ON ma.id_movimiento_traslado = mg.id
            WHERE ma.codigo_carga IS NOT NULL
              AND ma.id_movimiento_traslado IS NOT NULL
        """
        cursor.execute(sql_actas)
        todas_actas = cursor.fetchall()

        actas_por_carga = {}
        actas_vistas = set()
        for acta in todas_actas:
            codigo_carga = acta['codigo_carga']
            dedupe_key = (codigo_carga, acta.get('url_imagen') or '')
            if dedupe_key in actas_vistas:
                continue
            actas_vistas.add(dedupe_key)
            if codigo_carga not in actas_por_carga:
                actas_por_carga[codigo_carga] = []
            actas_por_carga[codigo_carga].append(acta)

        cascada = {}
        for traslado in todos_traslados:
            codigo_carga = traslado['codigo_carga']
            if codigo_carga not in cascada:
                cascada[codigo_carga] = {
                    'codigo_carga': codigo_carga,
                    'fecha_primera': traslado['fecha_registro'],
                    'cantidad_items': 0,
                    'operador': traslado['operador'],
                    'detalles': [],
                    'actas': actas_por_carga.get(codigo_carga, [])
                }
            cascada[codigo_carga]['detalles'].append(traslado)
            cascada[codigo_carga]['cantidad_items'] += 1

        resultado = list(cascada.values())
        return success_response(data=resultado, message="Traslados cascada obtenidos correctamente", headers=headers)

    finally:
        cursor.close()
        conn.close()

# ============================================================
# ENDPOINTS DE GESTIÓN DE ACTAS
# ============================================================

def agregar_acta_a_entrada(request, headers):
    """
    Agrega una acta a un registro de entrada existente.
    Puede actualizar el nombre de la acta también.
    """
    if request.method not in ['POST', 'PUT']:
        return bad_request_error("Método no permitido", headers)

    data = request.form.get('data')
    if not data:
        return bad_request_error("Datos requeridos", headers)

    data = json.loads(data)
    id_entrada = data.get('id_entrada')
    nombre_acta = data.get('nombre_acta')
    files = request.files.getlist('archivo')

    if not id_entrada or not files:
        return bad_request_error("ID de entrada y archivo requeridos", headers)

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT id FROM movimientos_entrada_callao WHERE id = %s", (id_entrada,))
        if not cursor.fetchone():
            return not_found_error("Entrada no encontrada", headers)

        codigo_carga = _codigo_carga_desde_actas_entrada(cursor, id_entrada)
        # Importante para vista cascada: persistir codigo_carga en el movimiento (si existe columna)
        _asignar_codigo_carga_entrada_si_existe_columna(cursor, id_entrada, codigo_carga)

        # Guardar archivo(s)
        for file in files:
            if file.filename != '':
                url_publica = upload_to_gcs(file)
                if url_publica:
                    cursor.execute(
                        """INSERT INTO movimientos_actas_callao 
                           (id_movimiento_entrada, nombre_imagen, url_imagen, codigo_carga) 
                           VALUES (%s, %s, %s, %s)""",
                        (id_entrada, nombre_acta or file.filename, url_publica, codigo_carga)
                    )

        conn.commit()
        payload = _actas_payload(cursor, id_entrada=id_entrada)
        payload['id_entrada'] = id_entrada
        return created_response(data=payload, message="Acta agregada exitosamente", headers=headers)

    except Exception as e:
        conn.rollback()
        logging.error(f"Error: {traceback.format_exc()}")
        return server_error(str(e), headers)
    finally:
        cursor.close()
        conn.close()

def agregar_acta_a_salida(request, headers):
    """
    Agrega una acta a un registro de salida existente.
    """
    if request.method not in ['POST', 'PUT']:
        return bad_request_error("Método no permitido", headers)

    data = request.form.get('data')
    if not data:
        return bad_request_error("Datos requeridos", headers)

    data = json.loads(data)
    id_salida = data.get('id_salida')
    nombre_acta = data.get('nombre_acta')
    files = request.files.getlist('archivo')

    if not id_salida or not files:
        return bad_request_error("ID de salida y archivo requeridos", headers)

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT id FROM movimientos_salida_callao WHERE id = %s", (id_salida,))
        if not cursor.fetchone():
            return not_found_error("Salida no encontrada", headers)

        codigo_carga = _codigo_carga_desde_actas_salida(cursor, id_salida)
        # Importante para vista cascada: persistir codigo_carga en el movimiento (si existe columna)
        _asignar_codigo_carga_salida_si_existe_columna(cursor, id_salida, codigo_carga)

        # Guardar archivo(s)
        for file in files:
            if file.filename != '':
                url_publica = upload_to_gcs(file)
                if url_publica:
                    cursor.execute(
                        """INSERT INTO movimientos_actas_callao 
                           (id_movimiento_salida, nombre_imagen, url_imagen, codigo_carga) 
                           VALUES (%s, %s, %s, %s)""",
                        (id_salida, nombre_acta or file.filename, url_publica, codigo_carga)
                    )

        conn.commit()
        payload = _actas_payload(cursor, id_salida=id_salida)
        payload['id_salida'] = id_salida
        return created_response(data=payload, message="Acta agregada exitosamente", headers=headers)

    except Exception as e:
        conn.rollback()
        logging.error(f"Error: {traceback.format_exc()}")
        return server_error(str(e), headers)
    finally:
        cursor.close()
        conn.close()

def agregar_acta_a_traslado(request, headers):
    """
    Agrega una acta a un registro de traslado existente.
    """
    if request.method not in ['POST', 'PUT']:
        return bad_request_error("Método no permitido", headers)

    data = request.form.get('data')
    if not data:
        return bad_request_error("Datos requeridos", headers)

    data = json.loads(data)
    id_traslado = data.get('id_traslado')
    nombre_acta = data.get('nombre_acta')
    files = request.files.getlist('archivo')

    if not id_traslado or not files:
        return bad_request_error("ID de traslado y archivo requeridos", headers)

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT id FROM movimientos_traslado_callao WHERE id = %s", (id_traslado,))
        if not cursor.fetchone():
            return not_found_error("Traslado no encontrado", headers)

        codigo_carga = _codigo_carga_desde_actas_traslado(cursor, id_traslado)
        # Importante para vista cascada: persistir codigo_carga en el movimiento (si existe columna)
        _asignar_codigo_carga_traslado_si_existe_columna(cursor, id_traslado, codigo_carga)

        # Guardar archivo(s)
        for file in files:
            if file.filename != '':
                url_publica = upload_to_gcs(file)
                if url_publica:
                    cursor.execute(
                        """INSERT INTO movimientos_actas_callao 
                           (id_movimiento_traslado, nombre_imagen, url_imagen, codigo_carga) 
                           VALUES (%s, %s, %s, %s)""",
                        (id_traslado, nombre_acta or file.filename, url_publica, codigo_carga)
                    )

        conn.commit()
        payload = _actas_payload(cursor, id_traslado=id_traslado)
        payload['id_traslado'] = id_traslado
        return created_response(data=payload, message="Acta agregada exitosamente", headers=headers)

    except Exception as e:
        conn.rollback()
        logging.error(f"Error: {traceback.format_exc()}")
        return server_error(str(e), headers)
    finally:
        cursor.close()
        conn.close()

def eliminar_acta(request, headers, id_acta):
    """Elimina una acta por su ID."""
    if request.method != 'DELETE':
        return bad_request_error("Método no permitido", headers)

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Verificar que la acta existe
        cursor.execute("SELECT id FROM movimientos_actas_callao WHERE id = %s", (id_acta,))
        if not cursor.fetchone():
            return not_found_error("Acta no encontrada", headers)

        # Eliminar acta
        cursor.execute("DELETE FROM movimientos_actas_callao WHERE id = %s", (id_acta,))
        conn.commit()

        return success_response(message="Acta eliminada exitosamente", headers=headers)

    except Exception as e:
        conn.rollback()
        logging.error(f"Error: {traceback.format_exc()}")
        return server_error(str(e), headers)
    finally:
        cursor.close()
        conn.close()

def actualizar_nombre_acta(request, headers, id_acta):
    """Actualiza el nombre/descripción de una acta."""
    if request.method != 'PUT':
        return bad_request_error("Método no permitido", headers)

    data = request.get_json()
    if not data or 'nombre_imagen' not in data:
        return bad_request_error("Nombre de acta requerido", headers)

    nuevo_nombre = data.get('nombre_imagen')

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Verificar que la acta existe
        cursor.execute("SELECT id FROM movimientos_actas_callao WHERE id = %s", (id_acta,))
        if not cursor.fetchone():
            return not_found_error("Acta no encontrada", headers)

        # Actualizar nombre
        cursor.execute(
            "UPDATE movimientos_actas_callao SET nombre_imagen = %s WHERE id = %s",
            (nuevo_nombre, id_acta)
        )
        conn.commit()

        return success_response(message="Nombre de acta actualizado exitosamente", headers=headers)

    except Exception as e:
        conn.rollback()
        logging.error(f"Error: {traceback.format_exc()}")
        return server_error(str(e), headers)
    finally:
        cursor.close()
        conn.close()

# ============================================================
# ENDPOINTS DE GESTIÓN DE CONTRASEÑA
# ============================================================

def obtener_contrasena_actual(request, headers):
    """Obtiene la contraseña actual del sistema (solo para admin)."""
    conn = get_connection()
    try:
        pass_actual = _obtener_contrasena_sistema(conn)
        return success_response(data={'password': pass_actual}, message="Contraseña obtenida", headers=headers)
    except Exception as e:
        logging.error(f"Error: {traceback.format_exc()}")
        return server_error(str(e), headers)
    finally:
        conn.close()

def actualizar_contrasena_sistema(request, headers):
    """Actualiza la contraseña del sistema."""
    if request.method != 'PUT':
        return bad_request_error("Método no permitido", headers)

    data = request.get_json()
    if not data or 'nueva_contrasena' not in data:
        return bad_request_error("Nueva contraseña requerida", headers)

    nueva_contrasena = data.get('nueva_contrasena')
    actualizado_por = data.get('actualizado_por', 'sistema')

    if not nueva_contrasena or len(nueva_contrasena) < 4:
        return bad_request_error("La contraseña debe tener al menos 4 caracteres", headers)

    conn = get_connection()
    try:
        if _actualizar_contrasena_sistema(conn, nueva_contrasena, actualizado_por):
            return success_response(message="Contraseña actualizada exitosamente", headers=headers)
        else:
            return server_error("Error al actualizar contraseña", headers)
    except Exception as e:
        logging.error(f"Error: {traceback.format_exc()}")
        return server_error(str(e), headers)
    finally:
        conn.close()

# ============================================================
# FUNCIÓN PRINCIPAL (FUNCION QUE ENRUTA TODOS LOS PROCESOS)
# ============================================================
@functions_framework.http
def abastecimiento_entra_salida_callao(request):
    # 1. Definición de headers (se usa en todos los retornos)
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    }

    # Manejo de OPTIONS (CORS preflight)
    if request.method == "OPTIONS":
        return ("", 204, headers)

    try:
        # --- ENRUTAMIENTO BASADO EN MÉTODO HTTP Y RUTA ---
        path = request.path
        method = request.method

        # ==================== MÓDULO: TIENDAS ====================
        if path == '/api/tiendas' and method == 'GET':
            return get_tiendas(request, headers)
        
        # ==================== MÓDULO: UNIDADES DE MEDIDA ====================
        elif path == '/api/unidades-medida' and method == 'GET':
            return get_unidades_medida(request, headers)

        # ==================== MÓDULO: PRODUCTOS ====================
        elif path == '/api/productos' and method == 'GET':
            return get_productos(request, headers)
        elif path == '/api/productos' and method == 'POST':
            return create_producto(request, headers)
        elif path == '/api/productos/masivo' and method in ['PUT', 'POST']:
            return update_productos_masivo(request, headers)
        elif path.startswith('/api/productos/') and method == 'PUT':
            # Extraer ID de la ruta: /api/productos/123
            id_producto = path.split('/')[-1]
            if id_producto.isdigit():
                return update_producto(request, headers, int(id_producto))
            else:
                return not_found_error("ID de producto inválido", headers)

        # ==================== MÓDULO: ENTRADAS ====================
        elif path == '/api/entradas' and method == 'GET':
            return get_entradas(request, headers)
        elif path == '/api/entradas' and method == 'POST':
            return create_entrada(request, headers)
        elif path == '/api/entradas/masivo' and method == 'POST':
            return create_entradas_masivo(request, headers)
        elif path == '/api/entradas/cascada' and method == 'GET':
            return get_entradas_cascada(request, headers)
        elif path.startswith('/api/entradas/') and method == 'PUT':
            # Extraer ID de la ruta: /api/entradas/123
            id_entrada = path.split('/')[-1]
            if id_entrada.isdigit():
                return update_entrada(request, headers, int(id_entrada))
            else:
                return not_found_error("ID de entrada inválido", headers)
        # Ruta para obtener los tipos de operación de ENTRADA
        elif path == '/api/tipos-operacion/entrada' and method == 'GET':
            return get_tipos_operacion('ENTRADA', headers)

        # ==================== MÓDULO: SALIDAS ====================
        elif path == '/api/salidas' and method == 'GET':
            return get_salidas(request, headers)
        elif path == '/api/salidas' and method == 'POST':
            return create_salida(request, headers)
        elif path == '/api/salidas/masivo' and method == 'POST':
            return create_salidas_masivo(request, headers)
        elif path == '/api/salidas/cascada' and method == 'GET':
            return get_salidas_cascada(request, headers)
        elif path.startswith('/api/salidas/') and method == 'PUT':
            id_salida = path.split('/')[-1]
            if id_salida.isdigit():
                return update_salida(request, headers, int(id_salida))
            else:
                return not_found_error("ID de salida inválido", headers)
        # Ruta para obtener los tipos de operación de SALIDA
        elif path == '/api/tipos-operacion/salida' and method == 'GET':
            return get_tipos_operacion('SALIDA', headers)

        # ==================== MÓDULO: TRASLADOS ====================
        elif path == '/api/traslados' and method == 'GET':
            return get_traslados(request, headers)
        elif path == '/api/traslados' and method == 'POST':
            return create_traslado(request, headers)
        elif path == '/api/traslados/masivo' and method == 'POST':
            return create_traslados_masivo(request, headers)
        elif path == '/api/traslados/cascada' and method == 'GET':
            return get_traslados_cascada(request, headers)
        elif path.startswith('/api/traslados/') and method == 'PUT':
            id_traslado = path.split('/')[-1]
            if id_traslado.isdigit():
                return update_traslado(request, headers, int(id_traslado))
            else:
                return not_found_error("ID de traslado inválido", headers)
        elif path == '/api/tipos-operacion/traslado' and method == 'GET':
            return get_tipos_operacion('TRASLADO', headers)

        # ==================== MÓDULO: EXISTENCIAS / STOCK TOTAL ====================
        elif path == '/api/existencias' and method == 'GET':
            return get_existencias(request, headers)
        elif path == '/api/stock-total' and method == 'GET':
            return get_stock_total(request, headers)  # Vista similar a la hoja "Stock Total"
        elif path == '/api/stock-total/importar' and method == 'POST':
            return importar_stock_total_excel(request, headers)

        # ==================== MÓDULO: GESTIÓN DE ACTAS ====================
        elif path == '/api/actas/entrada' and method in ['POST', 'PUT']:
            return agregar_acta_a_entrada(request, headers)
        elif path == '/api/actas/salida' and method in ['POST', 'PUT']:
            return agregar_acta_a_salida(request, headers)
        elif path == '/api/actas/traslado' and method in ['POST', 'PUT']:
            return agregar_acta_a_traslado(request, headers)
        elif path.startswith('/api/actas/') and method == 'DELETE':
            id_acta = path.split('/')[-1]
            if id_acta.isdigit():
                return eliminar_acta(request, headers, int(id_acta))
            else:
                return not_found_error("ID de acta inválido", headers)
        elif path.startswith('/api/actas/') and method == 'PUT':
            id_acta = path.split('/')[-1]
            if id_acta.isdigit():
                return actualizar_nombre_acta(request, headers, int(id_acta))
            else:
                return not_found_error("ID de acta inválido", headers)

        # ==================== MÓDULO: GESTIÓN DE CONTRASEÑA ====================
        elif path == '/api/config/password' and method == 'GET':
            return obtener_contrasena_actual(request, headers)
        elif path == '/api/config/password' and method == 'PUT':
            return actualizar_contrasena_sistema(request, headers)

        # ==================== MÓDULO: HISTORIAL DE CAMBIOS ====================
        elif path == '/api/historial/entradas' and method == 'GET':
            return get_historial_entradas(request, headers)
        elif path == '/api/historial/salidas' and method == 'GET':
            return get_historial_salidas(request, headers)
        elif path == '/api/historial/traslados' and method == 'GET':
            return get_historial_traslados(request, headers)

        # ==================== MÓDULO: ABASTECIMIENTO ====================
        elif path == '/api/abastecimiento/calcular' and method == 'GET':
            return calcular_abastecimiento(request, headers)  # Calcula la vista previa
        elif path == '/api/abastecimiento/guardar' and method == 'POST':
            return guardar_abastecimiento(request, headers)   # Guarda un abastecimiento
        elif path == '/api/abastecimiento/historial' and method == 'GET':
            return get_historial_abastecimientos(request, headers) # Lista de nombres
        elif path.startswith('/api/abastecimiento/detalle/') and method == 'GET':
            nombre_abastecimiento = path.split('/')[-1]
            # Podrías necesitar decodificar el nombre si tiene caracteres especiales
            return get_detalle_abastecimiento(request, headers, nombre_abastecimiento)
        elif path.startswith('/api/abastecimiento/actas/') and method == 'GET':
            id_abastecimiento = path.split('/')[-1]
            if id_abastecimiento.isdigit():
                return get_actas_abastecimiento(request, headers, int(id_abastecimiento))
            else:
                return not_found_error("ID de abastecimiento inválido", headers)
        elif path.startswith('/api/abastecimiento/actas/') and method == 'POST':
            id_abastecimiento = path.split('/')[-1]
            if id_abastecimiento.isdigit():
                return subir_actas_abastecimiento(request, headers, int(id_abastecimiento))
            else:
                return not_found_error("ID de abastecimiento inválido", headers)
        elif path == '/api/abastecimiento/historial-general' and method == 'GET':
            return get_historial_abastecimiento_general(request, headers)

        # ==================== MÓDULO: CONFIGURACIÓN / CREDENCIALES ==================
        elif path == '/api/configuracion/cambiar-password-abastecimiento' and method == 'POST':
            return cambiar_password_abastecimiento(request, headers)

        # ==================== 404 - RUTA NO ENCONTRADA ====================
        else:
            return not_found_error(f"Ruta {method} {path} no encontrada", headers)

    except pymysql.Error as e:
        logging.error(f"Error en la base de datos: {traceback.format_exc()}")
        return server_error(f"Error en la base de datos: {str(e)}", headers)
    except Exception as e:
        logging.error(f"Error interno del servidor: {traceback.format_exc()}")
        return server_error(f"Error interno del servidor: {str(e)}", headers)