'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DIAS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
const ANIO_MIN = 2018;
const ANIO_MAX = new Date().getFullYear() + 3;

type Panel = 'days' | 'months' | 'years';

interface FiltroRangoFechasProps {
    fechaInicio: string;
    fechaFin: string;
    onChange: (inicio: string, fin: string) => void;
}

function toKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function parseKey(key?: string): Date | null {
    if (!key) return null;
    const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function formatDisplay(key: string): string {
    const d = parseKey(key);
    if (!d) return '';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function DatePicker({
    value,
    min,
    max,
    onChange,
    placeholder,
    label,
}: {
    value: string;
    min?: string;
    max?: string;
    onChange: (v: string) => void;
    placeholder: string;
    label: string;
}) {
    const [open, setOpen] = useState(false);
    const [panel, setPanel] = useState<Panel>('days');
    const [mounted, setMounted] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const selected = parseKey(value);
    const [view, setView] = useState(() => selected || new Date());

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (open) {
            setView(selected || new Date());
            setPanel('days');
        }
    }, [open, value]);

    useLayoutEffect(() => {
        if (!open || !triggerRef.current) return;
        const update = () => {
            const r = triggerRef.current!.getBoundingClientRect();
            const width = 304;
            const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
            const below = r.bottom + 6;
            const estimatedH = 380;
            const top = below + estimatedH > window.innerHeight - 8
                ? Math.max(8, r.top - estimatedH - 8)
                : below;
            setPos({ top, left });
        };
        update();
        window.addEventListener('scroll', update, true);
        window.addEventListener('resize', update);
        return () => {
            window.removeEventListener('scroll', update, true);
            window.removeEventListener('resize', update);
        };
    }, [open, panel]);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            const t = e.target as Node;
            if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (panel !== 'days') setPanel('days');
                else setOpen(false);
            }
        };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
        };
    }, [open, panel]);

    const cells = useMemo(() => {
        const year = view.getFullYear();
        const month = view.getMonth();
        const first = new Date(year, month, 1);
        const startOffset = (first.getDay() + 6) % 7;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const prevDays = new Date(year, month, 0).getDate();
        const items: { key: string; day: number; inMonth: boolean }[] = [];

        for (let i = startOffset; i > 0; i--) {
            const date = new Date(year, month - 1, prevDays - i + 1);
            items.push({ key: toKey(date), day: date.getDate(), inMonth: false });
        }
        for (let d = 1; d <= daysInMonth; d++) {
            items.push({ key: toKey(new Date(year, month, d)), day: d, inMonth: true });
        }
        let next = 1;
        while (items.length % 7 !== 0) {
            const date = new Date(year, month + 1, next++);
            items.push({ key: toKey(date), day: date.getDate(), inMonth: false });
        }
        return items;
    }, [view]);

    const decadeStart = Math.floor(view.getFullYear() / 12) * 12;
    const years = useMemo(
        () => Array.from({ length: 12 }, (_, i) => decadeStart + i).filter(y => y >= ANIO_MIN && y <= ANIO_MAX),
        [decadeStart],
    );

    const todayKey = toKey(new Date());
    const disabled = (key: string) => Boolean((min && key < min) || (max && key > max));

    const pick = (key: string) => {
        if (disabled(key)) return;
        onChange(key);
        setOpen(false);
    };

    const step = (dir: number) => {
        if (panel === 'years') {
            const next = view.getFullYear() + dir * 12;
            setView(new Date(Math.min(ANIO_MAX, Math.max(ANIO_MIN, next)), view.getMonth(), 1));
            return;
        }
        if (panel === 'months') {
            setView(new Date(view.getFullYear() + dir, view.getMonth(), 1));
            return;
        }
        setView(new Date(view.getFullYear(), view.getMonth() + dir, 1));
    };

    const headerTitle =
        panel === 'years'
            ? `${decadeStart} – ${decadeStart + 11}`
            : panel === 'months'
              ? String(view.getFullYear())
              : `${MESES[view.getMonth()]} ${view.getFullYear()}`;

    const calendar = open && mounted
        ? createPortal(
            <div
                ref={popRef}
                style={{ top: pos.top, left: pos.left }}
                className="fixed z-[200] w-[304px] rounded-2xl bg-white border border-gray-200 shadow-xl shadow-[#002D5A]/10 overflow-hidden"
            >
                <div className="flex items-center gap-1 px-2 py-2 bg-[#002D5A] text-white">
                    <button
                        type="button"
                        onClick={() => step(-1)}
                        className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
                        aria-label="Anterior"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="flex-1 flex items-center justify-center gap-1">
                        {panel === 'days' ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setPanel('months')}
                                    className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[12px] font-semibold tracking-wide hover:bg-white/15 transition-colors"
                                    title="Elegir mes"
                                >
                                    {MESES[view.getMonth()]}
                                    <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPanel('years')}
                                    className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[12px] font-semibold tracking-wide hover:bg-white/15 transition-colors"
                                    title="Elegir año"
                                >
                                    {view.getFullYear()}
                                    <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setPanel(panel === 'years' ? 'months' : 'days')}
                                className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[12px] font-semibold tracking-wide hover:bg-white/15 transition-colors"
                            >
                                {headerTitle}
                                <ChevronDown className="w-3.5 h-3.5 opacity-80 rotate-180" />
                            </button>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => step(1)}
                        className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
                        aria-label="Siguiente"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                <div className="px-3 py-3 min-h-[268px]">
                    {panel === 'days' && (
                        <>
                            <div className="grid grid-cols-7 mb-1 border-b border-slate-100">
                                {DIAS.map(d => (
                                    <span key={d} className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 py-1.5">
                                        {d}
                                    </span>
                                ))}
                            </div>
                            <div className="grid grid-cols-7">
                                {cells.map(cell => {
                                    const isSel = cell.key === value;
                                    const isToday = cell.key === todayKey;
                                    const off = disabled(cell.key);
                                    return (
                                        <button
                                            key={cell.key}
                                            type="button"
                                            disabled={off}
                                            onClick={() => pick(cell.key)}
                                            className={`h-8 m-0.5 rounded-lg text-[12px] tabular-nums transition-colors ${
                                                isSel
                                                    ? 'bg-[#002D5A] text-white font-semibold shadow-sm'
                                                    : off
                                                      ? 'text-slate-300 cursor-not-allowed'
                                                      : cell.inMonth
                                                        ? isToday
                                                            ? 'text-[#002D5A] font-semibold bg-blue-50 ring-1 ring-[#002D5A]/30 hover:bg-[#002D5A] hover:text-white'
                                                            : 'text-slate-700 hover:bg-[#E9F1FF] hover:text-[#002D5A]'
                                                        : 'text-slate-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            {cell.day}
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {panel === 'months' && (
                        <div className="grid grid-cols-3 gap-1.5 pt-1">
                            {MESES_CORTO.map((mes, i) => {
                                const isSel = view.getMonth() === i;
                                return (
                                    <button
                                        key={mes}
                                        type="button"
                                        onClick={() => {
                                            setView(new Date(view.getFullYear(), i, 1));
                                            setPanel('days');
                                        }}
                                        className={`h-11 rounded-xl text-[12px] font-semibold uppercase tracking-wide transition-colors ${
                                            isSel
                                                ? 'bg-[#002D5A] text-white shadow-sm'
                                                : 'text-slate-700 hover:bg-[#E9F1FF] hover:text-[#002D5A]'
                                        }`}
                                    >
                                        {mes}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {panel === 'years' && (
                        <div className="grid grid-cols-3 gap-1.5 pt-1">
                            {years.map(y => {
                                const isSel = view.getFullYear() === y;
                                return (
                                    <button
                                        key={y}
                                        type="button"
                                        onClick={() => {
                                            setView(new Date(y, view.getMonth(), 1));
                                            setPanel('months');
                                        }}
                                        className={`h-11 rounded-xl text-[13px] font-semibold tabular-nums transition-colors ${
                                            isSel
                                                ? 'bg-[#002D5A] text-white shadow-sm'
                                                : 'text-slate-700 hover:bg-[#E9F1FF] hover:text-[#002D5A]'
                                        }`}
                                    >
                                        {y}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-slate-50/80">
                    <button
                        type="button"
                        onClick={() => { onChange(''); setOpen(false); }}
                        className="px-2 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wide text-slate-500 hover:text-[#002D5A] hover:bg-white transition-colors"
                    >
                        Limpiar
                    </button>
                    <button
                        type="button"
                        disabled={disabled(todayKey)}
                        onClick={() => pick(todayKey)}
                        className="px-3 py-1.5 rounded-xl text-[11px] font-semibold uppercase tracking-wide bg-[#002D5A] text-white hover:bg-[#003d7a] disabled:bg-slate-300 disabled:cursor-not-allowed shadow-sm transition-colors"
                    >
                        Hoy
                    </button>
                </div>
            </div>,
            document.body,
        )
        : null;

    return (
        <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen(v => !v)}
                className={`flex items-center gap-2 min-w-[128px] px-2.5 py-2 text-sm bg-white border rounded-xl text-left outline-none transition-all shadow-sm ${
                    open
                        ? 'border-[#002D5A] ring-4 ring-blue-50'
                        : value
                          ? 'border-gray-200 hover:border-[#002D5A]'
                          : 'border-gray-200 hover:border-[#002D5A]/40'
                }`}
            >
                <Calendar className={`w-3.5 h-3.5 flex-shrink-0 ${value || open ? 'text-[#002D5A]' : 'text-slate-400'}`} />
                <span className={`text-[12px] tabular-nums ${value ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                    {value ? formatDisplay(value) : placeholder}
                </span>
            </button>
            {calendar}
        </div>
    );
}

export function FiltroRangoFechas({ fechaInicio, fechaFin, onChange }: FiltroRangoFechasProps) {
    const activo = Boolean(fechaInicio || fechaFin);

    return (
        <div
            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border shadow-sm ${
                activo
                    ? 'bg-blue-50/80 border-[#002D5A]/30'
                    : 'bg-white border-gray-200'
            }`}
        >
            <DatePicker
                label="Inicio"
                placeholder="dd/mm/aaaa"
                value={fechaInicio}
                max={fechaFin || undefined}
                onChange={v => onChange(v, fechaFin && v && fechaFin < v ? '' : fechaFin)}
            />
            <span className="text-slate-300 text-xs">—</span>
            <DatePicker
                label="Fin"
                placeholder="dd/mm/aaaa"
                value={fechaFin}
                min={fechaInicio || undefined}
                onChange={v => onChange(fechaInicio, v)}
            />
            {activo && (
                <button
                    type="button"
                    onClick={() => onChange('', '')}
                    title="Quitar filtro de fechas"
                    className="p-1 rounded-lg text-slate-400 hover:text-[#002D5A] hover:bg-white transition-colors"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
}
