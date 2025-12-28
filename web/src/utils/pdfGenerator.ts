import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ExportResponse } from '../types';

const formatDateForFilename = (date: Date): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month}-${day}-${year}`;
};

export const generateSessionReportPDF = (data: ExportResponse) => {
  const doc = new jsPDF();
  const { customers, grand_total_dc, grand_total_bp, grand_total_fr } = data;

  const tableBody: any[] = [];

  customers.forEach((customer) => {
    const { customer_name, items } = customer;

    // Split items by category
    const dcItems = items.filter(item => item.category === 'DC');
    const frItems = items.filter(item => item.category === 'FR');
    const bpItems = items.filter(item => item.category === 'BP');
    
    // Calculate subtotals
    const dcSubtotal = dcItems.reduce((sum, item) => sum + item.bags, 0);
    const frSubtotal = frItems.reduce((sum, item) => sum + item.bags, 0);
    const bpSubtotal = bpItems.reduce((sum, item) => sum + item.bags, 0);

    let isFirstRow = true;

    // Process DC Items
    if (dcItems.length > 0) {
      dcItems.forEach((item) => {
        tableBody.push([
          isFirstRow ? { content: customer_name, styles: { fontStyle: 'bold' } } : '',
          item.category,
          item.classification,
          item.bags
        ]);
        isFirstRow = false;
      });

      // DC Subtotal row
      tableBody.push([
        { 
          content: 'Subtotal:', 
          colSpan: 3, 
          styles: { 
            halign: 'right', 
            fontStyle: 'bold',
            lineWidth: { top: 0.1, bottom: 0.1 }
          } 
        },
        { 
          content: dcSubtotal.toString(), 
          styles: { 
            fontStyle: 'bold',
            lineWidth: { top: 0.1, bottom: 0.1 }
          } 
        }
      ]);
    }

    // Process FR Items
    if (frItems.length > 0) {
      frItems.forEach((item) => {
        tableBody.push([
          isFirstRow ? { content: customer_name, styles: { fontStyle: 'bold' } } : '',
          item.category,
          item.classification,
          item.bags
        ]);
        isFirstRow = false;
      });

      // FR Subtotal row
      tableBody.push([
        { 
          content: 'Subtotal:', 
          colSpan: 3, 
          styles: { 
            halign: 'right', 
            fontStyle: 'bold',
            lineWidth: { top: 0.1, bottom: 0.1 }
          } 
        },
        { 
          content: frSubtotal.toString(), 
          styles: { 
            fontStyle: 'bold',
            lineWidth: { top: 0.1, bottom: 0.1 }
          } 
        }
      ]);
    }

    // Process BP Items
    if (bpItems.length > 0) {
      bpItems.forEach((item) => {
        tableBody.push([
          isFirstRow ? { content: customer_name, styles: { fontStyle: 'bold' } } : '',
          item.category,
          item.classification,
          item.bags
        ]);
        isFirstRow = false;
      });

      // BP Subtotal row
      tableBody.push([
        { 
          content: 'Subtotal:', 
          colSpan: 3, 
          styles: { 
            halign: 'right', 
            fontStyle: 'bold',
            lineWidth: { top: 0.1, bottom: 0.1 }
          } 
        },
        { 
          content: bpSubtotal.toString(), 
          styles: { 
            fontStyle: 'bold',
            lineWidth: { top: 0.1, bottom: 0.1 }
          } 
        }
      ]);
    }

    // Spacer row
    tableBody.push([{ content: '', colSpan: 4, styles: { minCellHeight: 5, cellPadding: 0, lineWidth: 0 } }]);
  });

  autoTable(doc, {
    head: [['Customer', 'Category', 'Class', 'Bags']],
    body: tableBody,
    theme: 'plain',
    styles: {
      fontSize: 10,
      cellPadding: 2,
      valign: 'middle',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 40 }, // Customer
      1: { cellWidth: 30 }, // Category
      2: { cellWidth: 30 }, // Class
      3: { cellWidth: 30 }, // Bags
    },
    headStyles: {
      fontStyle: 'bold',
      halign: 'center',
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineWidth: { bottom: 0.1 }
    },
    didDrawPage: (data) => {
      // Header
      doc.setFontSize(16);
      doc.text('Tally Session Report', data.settings.margin.left, 15);
    },
    margin: { top: 25 },
  });

  // Grand Total Box
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  // Check if we need a new page
  if (finalY > doc.internal.pageSize.height - 50) {
    doc.addPage();
    // finalY = 20; // Not really accessible here easily without tracking, but assuming simplistic for now
  }
  
  const boxWidth = 80;
  const startX = doc.internal.pageSize.width - boxWidth - 14; // Right aligned with margin
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Grandtotal:', startX - 30, finalY + 15);
  
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  
  doc.setFontSize(12);
  
  // Adjust box height if FR exists
  const boxHeight = grand_total_fr > 0 ? 36 : 24;
  doc.rect(startX, finalY, boxWidth, boxHeight); // Box
  
  // Horizontal lines inside box
  doc.line(startX, finalY + 12, startX + boxWidth, finalY + 12);
  if (grand_total_fr > 0) {
    doc.line(startX, finalY + 24, startX + boxWidth, finalY + 24);
  }
  
  // DC Row
  doc.text('DC', startX + 5, finalY + 8);
  doc.text(grand_total_dc.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), startX + boxWidth - 5, finalY + 8, { align: 'right' });
  
  // FR Row (if exists)
  if (grand_total_fr > 0) {
    doc.text('FR', startX + 5, finalY + 20);
    doc.text(grand_total_fr.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), startX + boxWidth - 5, finalY + 20, { align: 'right' });
  }
  
  // BP Row
  doc.text('BP', startX + 5, finalY + (grand_total_fr > 0 ? 32 : 20));
  doc.text(grand_total_bp.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), startX + boxWidth - 5, finalY + (grand_total_fr > 0 ? 32 : 20), { align: 'right' });

  // Generate filename with current date
  const currentDate = new Date();
  const dateString = formatDateForFilename(currentDate);
  const filename = `Allocation Report (${dateString}).pdf`;

  doc.save(filename);
};
