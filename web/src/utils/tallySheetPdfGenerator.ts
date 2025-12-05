import jsPDF from 'jspdf';

// Type definitions matching backend schemas
interface TallySheetColumnHeader {
  classification: string;
  classification_id: number;
  index: number;
}

interface TallySheetSummary {
  classification: string;
  classification_id: number;
  bags: number;
  heads: number;
  kilograms: number;
}

interface TallySheetPage {
  page_number: number;
  total_pages: number;
  columns: TallySheetColumnHeader[];
  entries: Array<{
    row: number;
    column: number;
    weight: number;
    classification: string;
    classification_id: number;
  }>;
  grid: (number | null)[][];
  summary_dressed: TallySheetSummary[];
  summary_byproduct: TallySheetSummary[];
  total_dressed_bags: number;
  total_dressed_heads: number;
  total_dressed_kilograms: number;
  total_byproduct_bags: number;
  total_byproduct_heads: number;
  total_byproduct_kilograms: number;
  is_byproduct: boolean;
}

interface TallySheetResponse {
  customer_name: string;
  product_type: string;
  date: string;
  pages: TallySheetPage[];
  grand_total_bags: number;
  grand_total_heads: number;
  grand_total_kilograms: number;
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  return `${month}/${day}/${year}`;
};

export const generateTallySheetPDF = (data: TallySheetResponse) => {
  const doc = new jsPDF();
  const { customer_name, product_type, date, pages, grand_total_bags, grand_total_heads, grand_total_kilograms } = data;

  const ROWS_PER_PAGE = 20;
  const CELL_WIDTH = 15;
  const CELL_HEIGHT = 8;
  const GRID_START_X = 20;
  const GRID_START_Y = 50;
  const ROW_NUMBER_WIDTH = 10;

  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) {
      doc.addPage();
    }

    const { page_number, total_pages, columns, grid, summary_dressed, summary_byproduct, is_byproduct, product_type: page_product_type } = page;

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('TALLY SHEET', 105, 15, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Customer: ${customer_name}`, 20, 25);
    doc.text(`Product: ${page_product_type}`, 20, 32);
    doc.text(`Date: ${formatDate(date)}`, 20, 39);
    doc.text(`Page: ${page_number} of ${total_pages}`, 160, 39, { align: 'right' });

    // Draw grid - always use 13 columns
    const numColumns = 13;
    const gridWidth = numColumns * CELL_WIDTH;
    const gridHeight = ROWS_PER_PAGE * CELL_HEIGHT;

    // Draw row numbers column
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    for (let row = 0; row < ROWS_PER_PAGE; row++) {
      const y = GRID_START_Y + (row * CELL_HEIGHT) + (CELL_HEIGHT / 2) + 2;
      doc.text((row + 1).toString(), GRID_START_X + ROW_NUMBER_WIDTH / 2, y, { align: 'center' });
    }

    // Draw column headers - always 13 columns
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    for (let colIndex = 0; colIndex < numColumns; colIndex++) {
      const x = GRID_START_X + ROW_NUMBER_WIDTH + (colIndex * CELL_WIDTH) + (CELL_WIDTH / 2);
      const y = GRID_START_Y - 5;
      const col = columns.find(c => c.index === colIndex);
      const headerText = col ? col.classification : '';
      doc.text(headerText, x, y, { align: 'center' });
    }

    // Draw grid borders and fill data
    doc.setDrawColor(0);
    doc.setLineWidth(0.1);

    // Draw outer border
    doc.rect(GRID_START_X + ROW_NUMBER_WIDTH, GRID_START_Y, gridWidth, gridHeight);

    // Draw horizontal lines
    for (let row = 0; row <= ROWS_PER_PAGE; row++) {
      const y = GRID_START_Y + (row * CELL_HEIGHT);
      doc.line(GRID_START_X + ROW_NUMBER_WIDTH, y, GRID_START_X + ROW_NUMBER_WIDTH + gridWidth, y);
    }

    // Draw vertical lines
    for (let col = 0; col <= numColumns; col++) {
      const x = GRID_START_X + ROW_NUMBER_WIDTH + (col * CELL_WIDTH);
      doc.line(x, GRID_START_Y, x, GRID_START_Y + gridHeight);
    }

    // Fill grid data
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    grid.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (cell !== null && cell !== undefined) {
          const x = GRID_START_X + ROW_NUMBER_WIDTH + (colIndex * CELL_WIDTH) + (CELL_WIDTH / 2);
          const y = GRID_START_Y + (rowIndex * CELL_HEIGHT) + (CELL_HEIGHT / 2) + 2;
          // For byproduct, show as integer (heads), for dressed show as decimal (weight)
          const displayValue = is_byproduct ? cell.toFixed(0) : cell.toFixed(2);
          doc.text(displayValue, x, y, { align: 'center' });
        }
      });
    });

    // Draw totals row below grid
    const totalsY = GRID_START_Y + gridHeight + 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL', GRID_START_X + ROW_NUMBER_WIDTH / 2, totalsY, { align: 'center' });

    // Calculate column totals - always 13 columns
    for (let colIndex = 0; colIndex < numColumns; colIndex++) {
      let columnTotal = 0;
      grid.forEach(row => {
        const cell = row[colIndex];
        if (cell !== null && cell !== undefined) {
          columnTotal += cell;
        }
      });
      const x = GRID_START_X + ROW_NUMBER_WIDTH + (colIndex * CELL_WIDTH) + (CELL_WIDTH / 2);
      // For byproduct, show as integer (heads), for dressed show as decimal (weight)
      const displayValue = is_byproduct ? columnTotal.toFixed(0) : columnTotal.toFixed(2);
      doc.text(displayValue, x, totalsY, { align: 'center' });
    }

    // Summary table - only show relevant summary based on page type
    const summaryStartY = totalsY + 15;
    const summaryX = 20;
    const summaryRowHeight = 6;
    const summaryColWidth = 25;

    if (is_byproduct && summary_byproduct.length > 0) {
      // Byproduct summary table
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Bags', summaryX, summaryStartY);
      doc.text('Heads', summaryX + summaryColWidth, summaryStartY);
      doc.text('Kilograms', summaryX + summaryColWidth * 2, summaryStartY);

      let currentY = summaryStartY + 5;
      summary_byproduct.forEach(summary => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(summary.classification, summaryX - 15, currentY);
        doc.text(summary.bags.toFixed(2), summaryX, currentY);
        doc.text(summary.heads.toFixed(0), summaryX + summaryColWidth, currentY);
        doc.text(summary.kilograms.toFixed(2), summaryX + summaryColWidth * 2, currentY);
        currentY += summaryRowHeight;
      });

      // Byproduct total
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL', summaryX - 15, currentY);
      doc.text(page.total_byproduct_bags.toFixed(2), summaryX, currentY);
      doc.text(page.total_byproduct_heads.toFixed(0), summaryX + summaryColWidth, currentY);
      doc.text(page.total_byproduct_kilograms.toFixed(2), summaryX + summaryColWidth * 2, currentY);
    } else if (!is_byproduct && summary_dressed.length > 0) {
      // Dressed summary table
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Bags', summaryX, summaryStartY);
      doc.text('Heads', summaryX + summaryColWidth, summaryStartY);
      doc.text('Kilograms', summaryX + summaryColWidth * 2, summaryStartY);

      let currentY = summaryStartY + 5;
      summary_dressed.forEach(summary => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(summary.classification, summaryX - 15, currentY);
        doc.text(summary.bags.toFixed(2), summaryX, currentY);
        doc.text(summary.heads.toFixed(2), summaryX + summaryColWidth, currentY);
        doc.text(summary.kilograms.toFixed(2), summaryX + summaryColWidth * 2, currentY);
        currentY += summaryRowHeight;
      });

      // Dressed total
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL', summaryX - 15, currentY);
      doc.text(page.total_dressed_bags.toFixed(2), summaryX, currentY);
      doc.text(page.total_dressed_heads.toFixed(2), summaryX + summaryColWidth, currentY);
      doc.text(page.total_dressed_kilograms.toFixed(2), summaryX + summaryColWidth * 2, currentY);
    }

    // Signature lines (only on last page)
    if (page_number === total_pages) {
      const signatureY = 250;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Prepared by: _______________', 20, signatureY);
      doc.text('Checked by: _______________', 20, signatureY + 7);
      doc.text('Approved by: _______________', 20, signatureY + 14);
      doc.text('Received by: _______________', 20, signatureY + 21);

      // Grand Total (only on last page)
      const grandTotalY = signatureY + 30;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Grand Total:', 20, grandTotalY);
      doc.text(`Bags: ${grand_total_bags.toFixed(2)}`, 80, grandTotalY);
      doc.text(`Heads: ${grand_total_heads.toFixed(2)}`, 80, grandTotalY + 7);
      doc.text(`Kilograms: ${grand_total_kilograms.toFixed(2)}`, 80, grandTotalY + 14);
    }
  });

  // Generate filename
  const dateStr = formatDate(date).replace(/\//g, '-');
  const filename = `Tally Sheet - ${customer_name} - ${dateStr}.pdf`;

  doc.save(filename);
};

