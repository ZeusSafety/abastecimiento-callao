import React, { useEffect, useMemo, useRef, useState } from 'react';

type Option = { value: string; label: string };

export function PrettySelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  size = 'sm',
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const selectedLabel = useMemo(() => {
    const found = options.find(o => o.value === value);
    return found?.label ?? '';
  }, [options, value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (e.target instanceof Node && ref.current.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const py = size === 'md' ? 'py-2.5' : 'py-2';
  const text = size === 'md' ? 'text-sm' : 'text-[12px]';

  const showPlaceholder = !value || !options.some(o => o.value === value);
  const buttonText = showPlaceholder ? placeholder || '' : selectedLabel;

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
        <span className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && !disabled && (
        <div className="absolute z-[80] mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden">
          <div className="max-h-64 overflow-auto">
            {options.map(o => (
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

