'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
}

export default function TableSkeleton({ rows = 5, cols = 8 }: TableSkeletonProps) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-12 text-center">
        <div className="flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-[#002D5A] animate-spin" />
          <p className="text-gray-500 text-sm font-medium">Cargando datos...</p>
        </div>
      </td>
    </tr>
  );
}
