'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Lock, Key, Eye, EyeOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import * as api from '../../services/api';

const PASSWORD_ACCESO = 'Hervin123';

export default function GestionCredencialPage() {
    const router = useRouter();
    const pathname = usePathname();
    const [autenticado, setAutenticado] = useState(false);
    const [passwordAcceso, setPasswordAcceso] = useState('');
    const [mostrarPasswordAcceso, setMostrarPasswordAcceso] = useState(false);
    const [errorAcceso, setErrorAcceso] = useState('');
    
    // Estados para cambio de contraseña
    const [passwordAnterior, setPasswordAnterior] = useState('');
    const [passwordNueva, setPasswordNueva] = useState('');
    const [passwordConfirmacion, setPasswordConfirmacion] = useState('');
    const [mostrarPasswordAnterior, setMostrarPasswordAnterior] = useState(false);
    const [mostrarPasswordNueva, setMostrarPasswordNueva] = useState(false);
    const [mostrarPasswordConfirmacion, setMostrarPasswordConfirmacion] = useState(false);
    const [cambiando, setCambiando] = useState(false);
    const [mensajeExito, setMensajeExito] = useState('');
    const [mensajeError, setMensajeError] = useState('');

    // Verificar si ya está autenticado (usando sessionStorage)
    useEffect(() => {
        const auth = sessionStorage.getItem('credencial_autenticado');
        if (auth === 'true') {
            setAutenticado(true);
        }
    }, []);

    // Limpiar sesión cuando se sale de la página
    useEffect(() => {
        if (pathname !== '/callao/gestion-credencial') {
            sessionStorage.removeItem('credencial_autenticado');
            setAutenticado(false);
        }
    }, [pathname]);

    const handleAcceso = () => {
        setErrorAcceso('');
        if (!passwordAcceso.trim()) {
            setErrorAcceso('Ingrese la contraseña de acceso');
            return;
        }

        if (passwordAcceso === PASSWORD_ACCESO) {
            setAutenticado(true);
            sessionStorage.setItem('credencial_autenticado', 'true');
            setPasswordAcceso('');
        } else {
            setErrorAcceso('Contraseña incorrecta');
            setPasswordAcceso('');
        }
    };

    const handleCambiarPassword = async () => {
        setMensajeExito('');
        setMensajeError('');

        // Validaciones
        if (!passwordAnterior.trim()) {
            setMensajeError('Ingrese la contraseña anterior');
            return;
        }

        if (!passwordNueva.trim()) {
            setMensajeError('Ingrese la nueva contraseña');
            return;
        }

        if (passwordNueva.length < 4) {
            setMensajeError('La nueva contraseña debe tener al menos 4 caracteres');
            return;
        }

        if (passwordNueva !== passwordConfirmacion) {
            setMensajeError('Las contraseñas nuevas no coinciden');
            return;
        }

        if (passwordAnterior === passwordNueva) {
            setMensajeError('La nueva contraseña debe ser diferente a la anterior');
            return;
        }

        setCambiando(true);
        try {
            // Validar contraseña anterior contra la contraseña dinámica actual del sistema
            const actual = await api.obtenerPasswordMovimientos();
            if (!actual.password || passwordAnterior !== actual.password) {
                setMensajeError('La contraseña anterior es incorrecta');
                return;
            }

            await api.cambiarPasswordMovimientos(passwordNueva, 'Admin');
            setMensajeExito('Contraseña cambiada exitosamente');
            setPasswordAnterior('');
            setPasswordNueva('');
            setPasswordConfirmacion('');
        } catch (error: any) {
            setMensajeError(error.message || 'Error al cambiar la contraseña');
        } finally {
            setCambiando(false);
        }
    };

    // Si no está autenticado, mostrar acceso restringido (dentro del layout, sin tapar el sidebar)
    if (!autenticado) {
        return (
            <div className="animate-in fade-in duration-500 font-poppins min-h-[calc(100vh-120px)] flex items-center justify-center px-1 sm:px-0">
                <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-xl border border-gray-100 w-full max-w-md mx-auto">
                    <div className="text-center mb-5">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#002D5A] rounded-full flex items-center justify-center mx-auto mb-3">
                            <Lock className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                        </div>
                        <h1 className="text-lg sm:text-xl font-bold text-[#002D5A] mb-1.5 leading-tight">
                            Acceso Restringido
                        </h1>
                        <p className="text-xs sm:text-sm text-gray-600 leading-relaxed px-1">
                            Ingrese la contraseña para acceder a la gestión de credenciales
                        </p>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                Contraseña de Acceso
                            </label>
                            <div className="relative">
                                <input
                                    type={mostrarPasswordAcceso ? 'text' : 'password'}
                                    value={passwordAcceso}
                                    onChange={e => {
                                        setPasswordAcceso(e.target.value);
                                        setErrorAcceso('');
                                    }}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            handleAcceso();
                                        }
                                    }}
                                    className="w-full min-w-0 px-3 py-2.5 pr-10 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-[#002D5A] outline-none transition-all text-sm"
                                    placeholder="Ingrese la contraseña"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setMostrarPasswordAcceso(!mostrarPasswordAcceso)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-0.5"
                                    aria-label={mostrarPasswordAcceso ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                >
                                    {mostrarPasswordAcceso ? (
                                        <EyeOff className="w-4 h-4" />
                                    ) : (
                                        <Eye className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                            {errorAcceso && (
                                <p className="mt-1.5 text-xs text-red-600 flex items-start gap-1.5">
                                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                    <span>{errorAcceso}</span>
                                </p>
                            )}
                        </div>

                        <button
                            onClick={handleAcceso}
                            className="w-full px-4 py-2.5 bg-[#002D5A] hover:bg-[#001f3d] text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg text-sm active:scale-[0.99]"
                        >
                            Acceder
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Si está autenticado, mostrar formulario de cambio de contraseña
    return (
        <div id="view-gestion-credencial" className="animate-in fade-in duration-500 font-poppins text-[#002D5A] min-h-[calc(100vh-120px)] flex items-center justify-center">
            <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm border border-gray-100 transition-all w-full max-w-2xl mx-auto">
                {/* Header Principal */}
                <header className="flex justify-between items-center flex-wrap gap-3 mb-4 min-w-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-[#002D5A] to-[#0056b3] rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-900/10">
                            <Key className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="font-bold text-gray-900 m-0 tracking-tight text-[15px] sm:text-base truncate">
                                Gestión de Credenciales
                            </h1>
                            <p className="text-[10px] text-gray-400 mt-0.5 font-medium italic opacity-80 leading-snug">
                                Cambio de contraseña para guardar movimientos sin actas
                            </p>
                        </div>
                    </div>
                </header>

                {/* Formulario de Cambio de Contraseña */}
                <div className="bg-gray-50/50 rounded-2xl p-4 sm:p-5 border border-gray-100">
                    <div className="max-w-xl mx-auto">
                        <div className="mb-4">
                            <h2 className="text-base font-bold text-[#002D5A] mb-1.5 flex items-center gap-2">
                                <Lock className="w-4 h-4 flex-shrink-0" />
                                Cambiar Contraseña
                            </h2>
                            <p className="text-xs text-gray-600 leading-relaxed">
                                Actualice la contraseña utilizada para guardar movimientos sin actas adjuntas.
                            </p>
                        </div>

                        {/* Mensajes de éxito/error */}
                        {mensajeExito && (
                            <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs font-semibold text-emerald-900">{mensajeExito}</p>
                                </div>
                            </div>
                        )}

                        {mensajeError && (
                            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs font-semibold text-red-900">{mensajeError}</p>
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            {/* Contraseña Anterior */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                    Contraseña Anterior *
                                </label>
                                <div className="relative">
                                    <input
                                        type={mostrarPasswordAnterior ? 'text' : 'password'}
                                        value={passwordAnterior}
                                        onChange={e => {
                                            setPasswordAnterior(e.target.value);
                                            setMensajeError('');
                                        }}
                                        className="w-full min-w-0 px-3 py-2.5 pr-10 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-[#002D5A] outline-none transition-all text-sm"
                                        placeholder="Ingrese la contraseña actual"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setMostrarPasswordAnterior(!mostrarPasswordAnterior)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-0.5"
                                    >
                                        {mostrarPasswordAnterior ? (
                                            <EyeOff className="w-4 h-4" />
                                        ) : (
                                            <Eye className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Contraseña Nueva */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                    Contraseña Nueva *
                                </label>
                                <div className="relative">
                                    <input
                                        type={mostrarPasswordNueva ? 'text' : 'password'}
                                        value={passwordNueva}
                                        onChange={e => {
                                            setPasswordNueva(e.target.value);
                                            setMensajeError('');
                                        }}
                                        className="w-full min-w-0 px-3 py-2.5 pr-10 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-[#002D5A] outline-none transition-all text-sm"
                                        placeholder="Ingrese la nueva contraseña"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setMostrarPasswordNueva(!mostrarPasswordNueva)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-0.5"
                                    >
                                        {mostrarPasswordNueva ? (
                                            <EyeOff className="w-4 h-4" />
                                        ) : (
                                            <Eye className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                                <p className="mt-1 text-[10px] text-gray-500">
                                    Mínimo 4 caracteres
                                </p>
                            </div>

                            {/* Confirmación de Contraseña */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                    Confirmar Contraseña Nueva *
                                </label>
                                <div className="relative">
                                    <input
                                        type={mostrarPasswordConfirmacion ? 'text' : 'password'}
                                        value={passwordConfirmacion}
                                        onChange={e => {
                                            setPasswordConfirmacion(e.target.value);
                                            setMensajeError('');
                                        }}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                handleCambiarPassword();
                                            }
                                        }}
                                        className="w-full min-w-0 px-3 py-2.5 pr-10 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-[#002D5A] outline-none transition-all text-sm"
                                        placeholder="Confirme la nueva contraseña"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setMostrarPasswordConfirmacion(!mostrarPasswordConfirmacion)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-0.5"
                                    >
                                        {mostrarPasswordConfirmacion ? (
                                            <EyeOff className="w-4 h-4" />
                                        ) : (
                                            <Eye className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Botones */}
                            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-3">
                                <button
                                    onClick={() => {
                                        sessionStorage.removeItem('credencial_autenticado');
                                        router.back();
                                    }}
                                    className="flex-1 px-3 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl font-semibold transition-all text-sm"
                                >
                                    Volver
                                </button>
                                <button
                                    onClick={handleCambiarPassword}
                                    disabled={cambiando}
                                    className="flex-1 px-3 py-2.5 bg-[#002D5A] hover:bg-[#001f3d] text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                                >
                                    {cambiando ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            Cambiando...
                                        </>
                                    ) : (
                                        <>
                                            <Key className="w-3.5 h-3.5" />
                                            Cambiar Contraseña
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
