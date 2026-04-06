'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Producto } from '../context/CallaoContext';
import { ChevronDown } from 'lucide-react';

interface ProductoAutocompleteProps {
    productos: Producto[];
    value: string; // productoId
    onChange: (productoId: string, producto: Producto | null) => void;
    placeholder?: string;
    disabled?: boolean;
}

export default function ProductoAutocomplete({
    productos,
    value,
    onChange,
    placeholder = 'Buscar producto...',
    disabled = false,
}: ProductoAutocompleteProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);
    const [dropdownRect, setDropdownRect] = useState<{ left: number; top: number; width: number } | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const isUserTypingRef = useRef(false);

    // Encontrar producto seleccionado por ID (solo cuando cambia el value externo)
    useEffect(() => {
        if (!isUserTypingRef.current) {
            if (value) {
                const producto = productos.find(p => p.id === value);
                if (producto) {
                    const currentSelectedId = selectedProducto?.id;
                    if (producto.id !== currentSelectedId) {
                        setSelectedProducto(producto);
                        setSearchTerm(producto.nombre);
                    }
                }
            } else {
                // Solo limpiar si el value externo cambió a vacío y no hay término de búsqueda activo
                if (selectedProducto && !searchTerm) {
                    setSelectedProducto(null);
                    setSearchTerm('');
                }
            }
        }
    }, [value, productos]);

    // Cerrar dropdown al hacer click fuera
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node;
            const clickedInWrapper = wrapperRef.current?.contains(target);
            const clickedInDropdown = dropdownRef.current?.contains(target);
            
            if (!clickedInWrapper && !clickedInDropdown) {
                setIsOpen(false);
            }
        }
        // Usar 'click' en lugar de 'mousedown' para que el onClick del botón se ejecute primero
        document.addEventListener('click', handleClickOutside, true);
        return () => document.removeEventListener('click', handleClickOutside, true);
    }, []);

    const updateDropdownPosition = useCallback(() => {
        const input = inputRef.current;
        if (!input) return;
        const rect = input.getBoundingClientRect();
        setDropdownRect({
            left: rect.left,
            top: rect.bottom + 4,
            width: rect.width,
        });
    }, []);

    // Mantener el dropdown "pegado" al input (aunque esté dentro de tablas con overflow)
    useEffect(() => {
        if (!isOpen) return;
        updateDropdownPosition();

        const onResize = () => updateDropdownPosition();
        // Captura scroll en cualquier contenedor (incluye scroll dentro de modales/tablas)
        const onScroll = () => updateDropdownPosition();

        window.addEventListener('resize', onResize);
        window.addEventListener('scroll', onScroll, true);
        return () => {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('scroll', onScroll, true);
        };
    }, [isOpen, updateDropdownPosition]);

    // Filtrar productos basado en búsqueda
    const filteredProductos = productos.filter(p =>
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.codigo.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 50); // Limitar a 50 resultados

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        isUserTypingRef.current = true;
        setSearchTerm(term);
        setIsOpen(true);
        if (!term) {
            setSelectedProducto(null);
            onChange('', null);
        }
        // Resetear el flag después de un breve delay
        setTimeout(() => {
            isUserTypingRef.current = false;
        }, 100);
    };

    const handleSelectProducto = (producto: Producto) => {
        isUserTypingRef.current = false;
        setSelectedProducto(producto);
        setSearchTerm(producto.nombre);
        setIsOpen(false);
        onChange(producto.id, producto);
    };

    const handleInputFocus = () => {
        setIsOpen(true);
        // posicionar inmediatamente
        updateDropdownPosition();
    };

    return (
        <div ref={wrapperRef} className="relative w-full">
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={searchTerm}
                    onChange={handleInputChange}
                    onFocus={handleInputFocus}
                    disabled={disabled}
                    placeholder={placeholder}
                    className="form-input w-full pr-8"
                    style={{ fontSize: 12 }}
                />
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            
            {isOpen && searchTerm && filteredProductos.length > 0 && typeof document !== 'undefined' && dropdownRect && (
                <>
                    {/* Portal para evitar que el dropdown se recorte por overflow del contenedor (tablas/modales) */}
                    {createPortal(
                        <div
                            ref={dropdownRef}
                            className="bg-white border-2 border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                            style={{
                                position: 'fixed',
                                left: dropdownRect.left,
                                top: dropdownRect.top,
                                width: dropdownRect.width,
                                zIndex: 100000,
                            }}
                            onMouseDown={(e) => e.preventDefault()} // Prevenir que el mousedown cierre el dropdown
                        >
                            {filteredProductos.map((producto) => (
                                <button
                                    key={producto.id}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelectProducto(producto);
                                    }}
                                    className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                                    style={{ fontFamily: 'var(--font-poppins)' }}
                                >
                                    <div className="text-sm font-medium text-gray-900">{producto.nombre}</div>
                                    <div className="text-xs text-gray-500">Código: {producto.codigo}</div>
                                </button>
                            ))}
                        </div>,
                        document.body
                    )}
                </>
            )}
        </div>
    );
}
