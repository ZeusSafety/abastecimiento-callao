'use client';

import { useEffect, useState } from 'react';
import * as api from '../services/api';

export type TipoMovimientoActas = 'entrada' | 'salida' | 'traslado';

/**
 * Las vistas de cambios no reciben las actas desde su endpoint de historial, así
 * que se consulta la cascada y se indexan las actas de cada carga por el id de
 * cada uno de sus movimientos.
 */
export function useActasPorMovimiento(tipo: TipoMovimientoActas) {
    const [actasPorMovimiento, setActasPorMovimiento] = useState<Map<string, api.ActaMovimientoDB[]>>(
        () => new Map(),
    );

    useEffect(() => {
        let cancelado = false;

        const cargar = async () => {
            try {
                const cargas =
                    tipo === 'entrada'
                        ? await api.getEntradasCascada()
                        : tipo === 'salida'
                            ? await api.getSalidasCascada()
                            : await api.getTrasladosCascada();

                if (cancelado) return;

                const indice = new Map<string, api.ActaMovimientoDB[]>();
                cargas.forEach(carga => {
                    if (!carga.actas || carga.actas.length === 0) return;
                    carga.detalles.forEach(detalle => indice.set(String(detalle.id), carga.actas));
                });
                setActasPorMovimiento(indice);
            } catch (error) {
                console.error('Error cargando actas por movimiento:', error);
            }
        };

        cargar();
        return () => {
            cancelado = true;
        };
    }, [tipo]);

    return actasPorMovimiento;
}

/** Actas (sin repetir) de un conjunto de movimientos. */
export function actasDeMovimientos(
    ids: Array<string | number | null | undefined>,
    actasPorMovimiento: Map<string, api.ActaMovimientoDB[]>,
): api.ActaMovimientoDB[] {
    const yaAgregadas = new Set<number>();
    const actas: api.ActaMovimientoDB[] = [];

    ids.forEach(id => {
        if (id === null || id === undefined || id === '') return;
        (actasPorMovimiento.get(String(id)) || []).forEach(acta => {
            if (yaAgregadas.has(acta.id)) return;
            yaAgregadas.add(acta.id);
            actas.push(acta);
        });
    });

    return actas;
}
