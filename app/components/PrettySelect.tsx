import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Option = { value: string; label: string };

export function PrettySelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  size = 'sm',
  /** Lista anclada a `document.body` (evita recorte por `overflow` en tablas/modales). */
  portal = false,
  /** z-index del panel en modo portal (p. ej. dentro de modal con z alto). */
  portalZIndex = 25000,
  /** Dirección del menú. Por defecto `above` (hacia arriba). Usa `below` si hace falta espacio arriba. */
  placement,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  portal?: boolean;
  portalZIndex?: number;
  placement?: 'above' | 'below';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [portalAnchor, setPortalAnchor] = useState<{
    left: number;
    width: number;
    buttonTop: number;
    buttonBottom: number;
  } | null>(null);

  const dropPlacement: 'above' | 'below' = placement ?? 'above';

  const selectedLabel = useMemo(() => {
    const found = options.find(o => o.value === value);
    return found?.label ?? '';
  }, [options, value]);

  useLayoutEffect(() => {
    if (!open || !portal) {
      setPortalAnchor(null);
      return;
    }
    const btn = ref.current?.querySelector('button');
    if (!btn) return;
    const update = () => {
      const r = btn.getBoundingClientRect();
      setPortalAnchor({
        left: r.left,
        width: r.width,
        buttonTop: r.top,
        buttonBottom: r.bottom,
      });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, portal]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current) return;
      if (ref.current.contains(t)) return;
      if (portal && panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open, portal, portalZIndex]);

  const py = size === 'md' ? 'py-2.5' : 'py-2';
  const text = size === 'md' ? 'text-sm' : 'text-[12px]';

  const showPlaceholder = !value || !options.some(o => o.value === value);
  const buttonText = showPlaceholder ? placeholder || '' : selectedLabel;

  const portalStyle: React.CSSProperties | undefined =
    portal && portalAnchor && typeof window !== 'undefined'
      ? dropPlacement === 'below'
        ? {
            position: 'fixed',
            top: portalAnchor.buttonBottom + 6,
            left: portalAnchor.left,
            width: Math.max(portalAnchor.width, 140),
            zIndex: portalZIndex,
          }
        : {
            position: 'fixed',
            left: portalAnchor.left,
            width: Math.max(portalAnchor.width, 140),
            bottom: window.innerHeight - portalAnchor.buttonTop + 8,
            maxHeight: Math.min(256, Math.max(96, portalAnchor.buttonTop - 16)),
            zIndex: portalZIndex,
          }
      : undefined;

  const inlineDropdownClass =
    'absolute z-[80] left-0 right-0 w-full rounded-xl border border-gray-200 bg-white shadow-xl ' +
    (dropPlacement === 'above' ? 'bottom-full mb-2' : 'top-full mt-2');

  const optionButtons = options.map(o => (
    <button
      key={o.value}
      type="button"
      onClick={() => {
        onChange(o.value);
        setOpen(false);
      }}
      className={`w-full text-left px-3 ${py} ${text} font-semibold transition-colors ${
        value === o.value ? 'bg-blue-50 text-[#002D5A]' : 'hover:bg-gray-50 text-gray-700'
      }`}
    >
      {o.label}
    </button>
  ));

  const renderDropdown = () =>
    portal ? (
      <div
        ref={panelRef}
        className={
          'rounded-xl border border-gray-200 bg-white shadow-xl overflow-y-auto ' +
          (dropPlacement === 'below' ? 'max-h-64' : '')
        }
        style={portalStyle}
      >
        {optionButtons}
      </div>
    ) : (
      <div className={inlineDropdownClass}>
        <div className="max-h-64 overflow-y-auto">{optionButtons}</div>
      </div>
    );

  const dropdownContent = open && !disabled ? renderDropdown() : null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-3 px-3 ${py} ${text} bg-white border rounded-xl shadow-sm transition-all outline-none ${
          open ? 'ring-4 ring-blue-50 border-[#002D5A]' : 'border-gray-200 hover:border-gray-300'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        style={{ appearance: 'none' }}
      >
        <span className={`truncate font-medium ${showPlaceholder ? 'text-gray-400' : 'text-gray-700'}`}>
          {buttonText}
        </span>
        <span className={`text-gray-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {portal
        ? dropdownContent && portalAnchor && typeof document !== 'undefined'
          ? createPortal(dropdownContent, document.body)
          : null
        : dropdownContent}
    </div>
  );
}

