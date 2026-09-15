'use client';

import { useState } from 'react';
import {
    Download,
    ExternalLink,
    FileArchive,
    FileImage,
    FileSpreadsheet,
    FileText,
    File as FileIcon,
    Presentation,
    X,
} from 'lucide-react';

export type TipoActa =
    | 'imagen'
    | 'pdf'
    | 'word'
    | 'excel'
    | 'powerpoint'
    | 'texto'
    | 'comprimido'
    | 'desconocido';

const EXTENSIONES_POR_TIPO: Record<Exclude<TipoActa, 'desconocido'>, string[]> = {
    imagen: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'heic', 'heif', 'avif'],
    pdf: ['pdf'],
    word: ['doc', 'docx', 'odt', 'rtf'],
    excel: ['xls', 'xlsx', 'xlsm', 'xlsb', 'csv', 'ods'],
    powerpoint: ['ppt', 'pptx', 'odp'],
    texto: ['txt', 'md', 'json', 'xml', 'log'],
    comprimido: ['zip', 'rar', '7z', 'tar', 'gz'],
};

const ETIQUETA_POR_TIPO: Record<TipoActa, string> = {
    imagen: 'Imagen',
    pdf: 'Documento PDF',
    word: 'Documento Word',
    excel: 'Hoja de cálculo',
    powerpoint: 'Presentación',
    texto: 'Archivo de texto',
    comprimido: 'Archivo comprimido',
    desconocido: 'Archivo',
};

const COLOR_POR_TIPO: Record<TipoActa, { fondo: string; texto: string }> = {
    imagen: { fondo: 'bg-blue-50', texto: 'text-blue-600' },
    pdf: { fondo: 'bg-red-50', texto: 'text-red-600' },
    word: { fondo: 'bg-sky-50', texto: 'text-sky-700' },
    excel: { fondo: 'bg-emerald-50', texto: 'text-emerald-700' },
    powerpoint: { fondo: 'bg-orange-50', texto: 'text-orange-600' },
    texto: { fondo: 'bg-gray-100', texto: 'text-gray-600' },
    comprimido: { fondo: 'bg-amber-50', texto: 'text-amber-700' },
    desconocido: { fondo: 'bg-gray-100', texto: 'text-gray-500' },
};

/** Tipos aceptados al subir actas: imágenes y documentos. */
export const ACCEPT_ACTAS =
    'image/*,.pdf,.doc,.docx,.xls,.xlsx,.xlsm,.csv,.ppt,.pptx,.txt,.zip,.rar';

export const TEXTO_FORMATOS_ACTAS = 'Imágenes, PDF, Word, Excel, PowerPoint';

function extraerExtension(valor?: string | null): string {
    const match = /\.([a-z0-9]{1,6})$/i.exec((valor || '').trim());
    return match ? match[1].toLowerCase() : '';
}

export function getExtensionActa(nombre?: string | null, url?: string | null): string {
    const desdeNombre = extraerExtension(nombre);
    if (desdeNombre) return desdeNombre;
    const rutaLimpia = (url || '').split('?')[0].split('#')[0];
    return extraerExtension(rutaLimpia.split('/').pop());
}

export function getTipoActa(nombre?: string | null, url?: string | null): TipoActa {
    const ext = getExtensionActa(nombre, url);
    if (!ext) return 'desconocido';
    const encontrado = (Object.keys(EXTENSIONES_POR_TIPO) as Array<Exclude<TipoActa, 'desconocido'>>).find(
        tipo => EXTENSIONES_POR_TIPO[tipo].includes(ext),
    );
    return encontrado || 'desconocido';
}

export function getEtiquetaTipoActa(tipo: TipoActa): string {
    return ETIQUETA_POR_TIPO[tipo];
}

function IconoTipoActa({ tipo, className }: { tipo: TipoActa; className?: string }) {
    switch (tipo) {
        case 'imagen':
            return <FileImage className={className} />;
        case 'excel':
            return <FileSpreadsheet className={className} />;
        case 'powerpoint':
            return <Presentation className={className} />;
        case 'comprimido':
            return <FileArchive className={className} />;
        case 'pdf':
        case 'word':
        case 'texto':
            return <FileText className={className} />;
        default:
            return <FileIcon className={className} />;
    }
}

function TarjetaArchivo({ tipo, nombre, url }: { tipo: TipoActa; nombre: string; url?: string }) {
    const ext = getExtensionActa(nombre, url);
    const colores = COLOR_POR_TIPO[tipo];
    return (
        <div className={`w-full h-full flex flex-col items-center justify-center gap-1.5 p-3 ${colores.fondo}`}>
            <IconoTipoActa tipo={tipo} className={`w-9 h-9 ${colores.texto}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wide ${colores.texto}`}>
                {ext ? `.${ext}` : ETIQUETA_POR_TIPO[tipo]}
            </span>
            <span className="text-[9px] text-gray-500 font-semibold">Clic para abrir</span>
        </div>
    );
}

/**
 * Miniatura de un acta. Intenta renderizar imágenes y, para cualquier otro
 * archivo (o si la imagen falla), muestra una tarjeta con el tipo de archivo.
 */
export function ActaMiniatura({
    nombre,
    url,
    className = 'w-full h-full object-cover',
}: {
    nombre: string;
    url: string;
    className?: string;
}) {
    const [falloImagen, setFalloImagen] = useState(false);
    const tipo = getTipoActa(nombre, url);
    const intentarImagen = (tipo === 'imagen' || tipo === 'desconocido') && !falloImagen;

    if (intentarImagen) {
        return <img src={url} alt={nombre} className={className} onError={() => setFalloImagen(true)} />;
    }

    return <TarjetaArchivo tipo={tipo} nombre={nombre} url={url} />;
}

function BotonesArchivo({ url, nombre }: { url: string; nombre: string }) {
    return (
        <div className="flex flex-wrap items-center justify-center gap-2">
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#002D5A] hover:bg-[#001f3d] text-white text-xs font-bold transition-colors"
            >
                <ExternalLink className="w-4 h-4" />
                Abrir en nueva pestaña
            </a>
            <a
                href={url}
                download={nombre}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/90 hover:bg-white text-gray-700 text-xs font-bold transition-colors border border-gray-200"
            >
                <Download className="w-4 h-4" />
                Descargar
            </a>
        </div>
    );
}

function PanelArchivoNoPrevisualizable({ tipo, nombre, url }: { tipo: TipoActa; nombre: string; url: string }) {
    const colores = COLOR_POR_TIPO[tipo];
    return (
        <div
            className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full flex flex-col items-center gap-4 text-center"
            onClick={e => e.stopPropagation()}
        >
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${colores.fondo}`}>
                <IconoTipoActa tipo={tipo} className={`w-10 h-10 ${colores.texto}`} />
            </div>
            <div>
                <p className="text-sm font-bold text-gray-900 break-all">{nombre}</p>
                <p className="text-xs text-gray-500 mt-1">{ETIQUETA_POR_TIPO[tipo]}</p>
            </div>
            <p className="text-[11px] text-gray-500">
                Este archivo no se puede previsualizar aquí. Ábrelo o descárgalo para verlo.
            </p>
            <BotonesArchivo url={url} nombre={nombre} />
        </div>
    );
}

export interface ActaConNombre {
    nombre_imagen?: string | null;
}

function nombresDeActas(actas?: ActaConNombre[] | null): string[] {
    return (actas || []).map(a => (a?.nombre_imagen || '').trim()).filter(Boolean);
}

/**
 * Etiqueta "ACTA <nombre>" para la cabecera de cada carga en cascada. Incluye
 * el separador vertical y no renderiza nada cuando la carga no tiene actas.
 */
export function EtiquetaActasCabecera({ actas }: { actas?: ActaConNombre[] | null }) {
    const nombres = nombresDeActas(actas);
    if (nombres.length === 0) return null;

    const restantes = nombres.length - 1;
    return (
        <>
            <span className="hidden sm:block w-px h-4 bg-gray-300 self-center" />
            {/* Móvil: etiqueta arriba, nombre truncado abajo */}
            <span className="flex flex-col gap-0.5 min-w-0 w-full sm:hidden" title={nombres.join(' • ')}>
                <span className="inline-flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
                    <FileImage className="w-3.5 h-3.5 text-[#002D5A] flex-shrink-0" />
                    Acta
                    {restantes > 0 && (
                        <span className="text-[9px] font-bold text-[#002D5A] bg-[#002D5A]/10 rounded-full px-1.5 py-0.5">
                            +{restantes}
                        </span>
                    )}
                </span>
                <span className="block text-[12px] font-semibold text-gray-900 truncate pl-5">
                    {nombres[0]}
                </span>
            </span>
            {/* Desktop: en línea */}
            <span className="hidden sm:inline-flex items-center gap-2 min-w-0 max-w-full" title={nombres.join(' • ')}>
                <FileImage className="w-3.5 h-3.5 text-[#002D5A] flex-shrink-0" />
                <span className="text-[10px] text-gray-500 uppercase tracking-widest flex-shrink-0">Acta</span>
                <span className="truncate min-w-0 max-w-[220px]">{nombres[0]}</span>
                {restantes > 0 && (
                    <span className="text-[9px] font-bold text-[#002D5A] bg-[#002D5A]/10 rounded-full px-1.5 py-0.5 flex-shrink-0">
                        +{restantes}
                    </span>
                )}
            </span>
        </>
    );
}

/** ¿Alguna de las actas coincide con el término del buscador? */
export function actasCoincidenBusqueda(actas: ActaConNombre[] | null | undefined, termino: string): boolean {
    const q = termino.trim().toLowerCase();
    if (!q) return false;
    return nombresDeActas(actas).some(nombre => nombre.toLowerCase().includes(q));
}

/**
 * Visor a pantalla completa de un acta: imágenes, PDF (embebido), documentos
 * de Office (visor online) y cualquier otro archivo (abrir / descargar).
 */
export function ActaLightbox({
    nombre,
    url,
    onClose,
    zIndex = 40001,
}: {
    nombre: string;
    url: string;
    onClose: () => void;
    zIndex?: number;
}) {
    const [falloImagen, setFalloImagen] = useState(false);
    const tipo = getTipoActa(nombre, url);
    const esOffice = tipo === 'word' || tipo === 'excel' || tipo === 'powerpoint';
    const intentarImagen = (tipo === 'imagen' || tipo === 'desconocido') && !falloImagen;

    let contenido: React.ReactNode;
    if (intentarImagen) {
        contenido = (
            <img
                src={url}
                alt={nombre}
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300 select-none"
                onClick={e => e.stopPropagation()}
                onError={() => setFalloImagen(true)}
            />
        );
    } else if (tipo === 'pdf') {
        contenido = (
            <iframe src={url} title={nombre} className="w-full h-[85vh] bg-white rounded-xl shadow-2xl" />
        );
    } else if (esOffice) {
        contenido = (
            <div className="w-full h-[85vh] flex flex-col gap-3" onClick={e => e.stopPropagation()}>
                <iframe
                    src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
                    title={nombre}
                    className="flex-1 bg-white rounded-xl shadow-2xl"
                />
                <div className="flex flex-col items-center gap-1.5">
                    <p className="text-[11px] text-white/70">
                        ¿No se muestra la vista previa? Abre o descarga el archivo.
                    </p>
                    <BotonesArchivo url={url} nombre={nombre} />
                </div>
            </div>
        );
    } else {
        contenido = <PanelArchivoNoPrevisualizable tipo={tipo} nombre={nombre} url={url} />;
    }

    return (
        <div
            className="fixed inset-0 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200 flex items-center justify-center p-4 md:p-8"
            style={{ zIndex }}
            onClick={onClose}
        >
            <button
                onClick={e => {
                    e.stopPropagation();
                    onClose();
                }}
                className="absolute top-4 right-4 w-11 h-11 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors flex items-center justify-center backdrop-blur-md shadow-2xl z-10"
                aria-label="Cerrar"
            >
                <X className="w-6 h-6" />
            </button>

            {(intentarImagen || tipo === 'pdf') && (
                <div className="absolute top-4 left-4 right-20 flex flex-wrap items-center gap-3 z-10">
                    <span className="text-white text-xs font-bold truncate max-w-[40%]">{nombre}</span>
                    <BotonesArchivo url={url} nombre={nombre} />
                </div>
            )}

            <div
                className="w-full max-w-6xl flex items-center justify-center pt-16"
                onClick={e => e.stopPropagation()}
            >
                {contenido}
            </div>
        </div>
    );
}
