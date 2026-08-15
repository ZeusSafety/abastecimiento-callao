/** Convierte fechas del sistema (ISO o DD/MM/YYYY) a YYYY-MM-DD para comparar. */
export function toDateKey(fechaStr?: string | null): string | null {
    if (!fechaStr) return null;
    const raw = String(fechaStr).trim();
    if (!raw) return null;

    const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dmy) {
        const dia = dmy[1].padStart(2, '0');
        const mes = dmy[2].padStart(2, '0');
        const anio = dmy[3];
        return `${anio}-${mes}-${dia}`;
    }

    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

    const parsed = new Date(raw);
    if (isNaN(parsed.getTime())) return null;
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** Inclusive en ambos extremos. Sin fechas = no filtra. Fechas ilegibles se mantienen visibles. */
export function fechaEnRango(fechaStr: string | null | undefined, desde: string, hasta: string): boolean {
    if (!desde && !hasta) return true;
    const key = toDateKey(fechaStr);
    if (!key) return true;
    if (desde && key < desde) return false;
    if (hasta && key > hasta) return false;
    return true;
}

export function hayRangoFechas(desde: string, hasta: string): boolean {
    return Boolean(desde || hasta);
}
