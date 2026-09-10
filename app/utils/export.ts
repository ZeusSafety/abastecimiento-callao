import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
 
// Función para exportar a Excel
export function exportToExcel(
  data: any[],
  columns: { header: string; key: string }[],
  filename: string
) {
  // Crear workbook
  const wb = XLSX.utils.book_new();
  
  // Preparar datos para Excel
  const excelData = [
    columns.map(col => col.header), // Headers
    ...data.map(row => columns.map(col => {
      const value = row[col.key];
      // Manejar valores nulos o undefined
      if (value === null || value === undefined) return '';
      // Si es un objeto, convertir a string
      if (typeof value === 'object') return JSON.stringify(value);
      return value;
    }))
  ];
  
  // Crear worksheet
  const ws = XLSX.utils.aoa_to_sheet(excelData);
  
  // Ajustar ancho de columnas
  const colWidths = columns.map((_, index) => {
    const maxLength = Math.max(
      columns[index].header.length,
      ...data.map(row => {
        const val = row[columns[index].key];
        return val ? String(val).length : 0;
      })
    );
    return { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
  });
  ws['!cols'] = colWidths;
  
  // Agregar worksheet al workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');
  
  // Descargar archivo
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// Función para exportar a PDF
export function exportToPDF(
  data: any[],
  columns: { header: string; dataKey: string }[],
  filename: string,
  title: string
) {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  
  // Agregar título
  doc.setFontSize(16);
  doc.text(title, 14, 15);
  
  // Preparar datos para la tabla
  const tableData = data.map(row => 
    columns.map(col => {
      const value = row[col.dataKey];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    })
  );
  
  // Crear tabla
  autoTable(doc, {
    head: [columns.map(col => col.header)],
    body: tableData,
    startY: 25,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [0, 45, 90], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { top: 25 },
  });
  
  // Descargar PDF
  doc.save(`${filename}.pdf`);
}
