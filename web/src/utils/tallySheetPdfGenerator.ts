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
  product_type: string;
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
  // Landscape orientation for letter size paper
  const doc = new jsPDF('landscape', 'mm', 'letter');
  const { customer_name, date, pages, grand_total_bags, grand_total_heads, grand_total_kilograms } = data;

  // Layout constants
  const PAGE_WIDTH = 279.4; // Letter landscape width in mm
  const MARGIN = 10;
  const ROWS_PER_PAGE = 20;
  const NUM_COLUMNS = 13;
  
  // Grid dimensions
  const ROW_NUMBER_WIDTH = 8;
  const CELL_WIDTH = 11.5;
  const CELL_HEIGHT = 5.5;
  const GRID_START_X = MARGIN + 5;
  const GRID_START_Y = 42; // Increased from 38 to add more space below date
  const GRID_WIDTH = NUM_COLUMNS * CELL_WIDTH;
  const GRID_HEIGHT = ROWS_PER_PAGE * CELL_HEIGHT;

  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) {
      doc.addPage();
    }

    const { page_number, total_pages, columns, grid, summary_dressed, summary_byproduct, is_byproduct, product_type: page_product_type } = page;
    const summaries = is_byproduct ? summary_byproduct : summary_dressed;

    // ========== HEADER SECTION ==========
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('TALLY SHEET', PAGE_WIDTH / 2, 15, { align: 'center' });

    // Header info in two columns
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Customer: ${customer_name}`, MARGIN, 22);
    doc.text(`Product: ${page_product_type}`, MARGIN, 27);
    doc.text(`Date: ${formatDate(date)}`, MARGIN, 32);
    doc.text(`Page: ${page_number} of ${total_pages}`, PAGE_WIDTH - MARGIN, 32, { align: 'right' });

    // ========== GRID SECTION ==========
    // Draw row numbers
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    for (let row = 0; row < ROWS_PER_PAGE; row++) {
      const y = GRID_START_Y + (row * CELL_HEIGHT) + (CELL_HEIGHT / 2) + 1.5;
      doc.text((row + 1).toString(), GRID_START_X + ROW_NUMBER_WIDTH / 2, y, { align: 'center' });
    }

    // Draw column headers - with proper spacing from text above
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    for (let colIndex = 0; colIndex < NUM_COLUMNS; colIndex++) {
      const x = GRID_START_X + ROW_NUMBER_WIDTH + (colIndex * CELL_WIDTH) + (CELL_WIDTH / 2);
      const y = GRID_START_Y - 4; // Proper spacing from grid top
      const col = columns.find(c => c.index === colIndex);
      const headerText = col ? col.classification : '';
      doc.text(headerText, x, y, { align: 'center' });
    }

    // Draw grid borders
    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    
    // Outer border
    doc.rect(GRID_START_X + ROW_NUMBER_WIDTH, GRID_START_Y, GRID_WIDTH, GRID_HEIGHT);
    
    // Horizontal lines
    doc.setLineWidth(0.1);
    for (let row = 0; row <= ROWS_PER_PAGE; row++) {
      const y = GRID_START_Y + (row * CELL_HEIGHT);
      doc.line(GRID_START_X + ROW_NUMBER_WIDTH, y, GRID_START_X + ROW_NUMBER_WIDTH + GRID_WIDTH, y);
    }
    
    // Vertical lines
    for (let col = 0; col <= NUM_COLUMNS; col++) {
      const x = GRID_START_X + ROW_NUMBER_WIDTH + (col * CELL_WIDTH);
      doc.line(x, GRID_START_Y, x, GRID_START_Y + GRID_HEIGHT);
    }
    
    // Row number column border
    doc.setLineWidth(0.2);
    doc.line(GRID_START_X + ROW_NUMBER_WIDTH, GRID_START_Y, GRID_START_X + ROW_NUMBER_WIDTH, GRID_START_Y + GRID_HEIGHT);

    // Fill grid data
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    grid.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (cell !== null && cell !== undefined) {
          const x = GRID_START_X + ROW_NUMBER_WIDTH + (colIndex * CELL_WIDTH) + (CELL_WIDTH / 2);
          const y = GRID_START_Y + (rowIndex * CELL_HEIGHT) + (CELL_HEIGHT / 2) + 1.5;
          const displayValue = is_byproduct ? cell.toFixed(0) : cell.toFixed(2);
          doc.text(displayValue, x, y, { align: 'center' });
        }
      });
    });

    // Totals row
    const totalsY = GRID_START_Y + GRID_HEIGHT + 4;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL', GRID_START_X + ROW_NUMBER_WIDTH / 2, totalsY, { align: 'center' });

    // Calculate and display column totals
    for (let colIndex = 0; colIndex < NUM_COLUMNS; colIndex++) {
      let columnTotal = 0;
      grid.forEach(row => {
        const cell = row[colIndex];
        if (cell !== null && cell !== undefined) {
          columnTotal += cell;
        }
      });
      const x = GRID_START_X + ROW_NUMBER_WIDTH + (colIndex * CELL_WIDTH) + (CELL_WIDTH / 2);
      const displayValue = is_byproduct ? columnTotal.toFixed(0) : columnTotal.toFixed(2);
      doc.text(displayValue, x, totalsY, { align: 'center' });
    }

    // ========== SUMMARY SECTION (on every page) - positioned on the right ==========
    const summaryStartY = GRID_START_Y; // Align with grid top
    const summaryX = GRID_START_X + ROW_NUMBER_WIDTH + GRID_WIDTH + 15; // Right side of grid
    const summaryRowHeight = 5;
    const summaryTableWidth = 90; // Total width of summary table
    const summaryCol1Width = 25; // Classification column width
    const summaryCol2Width = 20; // Bags column width
    const summaryCol3Width = 20; // Heads column width

    // Calculate table height (header + rows + total row)
    const numSummaryRows = summaries.length;
    const summaryTableHeight = 5 + (numSummaryRows * summaryRowHeight) + summaryRowHeight; // Header + data rows + total row

    // Draw summary table borders
    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    
    // Outer border
    doc.rect(summaryX, summaryStartY - 5, summaryTableWidth, summaryTableHeight);
    
    // Horizontal lines
    doc.setLineWidth(0.1);
    // Line below header
    doc.line(summaryX, summaryStartY, summaryX + summaryTableWidth, summaryStartY);
    // Lines between data rows
    for (let i = 0; i < numSummaryRows; i++) {
      const y = summaryStartY + 5 + (i * summaryRowHeight);
      doc.line(summaryX, y, summaryX + summaryTableWidth, y);
    }
    // Line above total row
    const totalRowY = summaryStartY + 5 + (numSummaryRows * summaryRowHeight);
    doc.line(summaryX, totalRowY, summaryX + summaryTableWidth, totalRowY);
    
    // Vertical lines
    doc.line(summaryX + summaryCol1Width, summaryStartY - 5, summaryX + summaryCol1Width, summaryStartY - 5 + summaryTableHeight);
    doc.line(summaryX + summaryCol1Width + summaryCol2Width, summaryStartY - 5, summaryX + summaryCol1Width + summaryCol2Width, summaryStartY - 5 + summaryTableHeight);
    doc.line(summaryX + summaryCol1Width + summaryCol2Width + summaryCol3Width, summaryStartY - 5, summaryX + summaryCol1Width + summaryCol2Width + summaryCol3Width, summaryStartY - 5 + summaryTableHeight);

    // Single summary table on the right - text centered vertically in cells
    // Header row
    const headerRowY = summaryStartY - 5 + (summaryRowHeight / 2) + 1.5; // Center of header cell
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    // Left align classification, right align numbers
    doc.text('Classification', summaryX + 2, headerRowY);
    doc.text('Bags', summaryX + summaryCol1Width + summaryCol2Width - 2, headerRowY, { align: 'right' });
    doc.text('Heads', summaryX + summaryCol1Width + summaryCol2Width + summaryCol3Width - 2, headerRowY, { align: 'right' });
    doc.text('Kilograms', summaryX + summaryTableWidth - 2, headerRowY, { align: 'right' });

    // Summary rows - dynamic based on entries for this page
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    summaries.forEach((summary, index) => {
      // Calculate Y position at center of each row cell
      const rowY = summaryStartY + 5 + (index * summaryRowHeight) + (summaryRowHeight / 2) + 1.5;
      // Left align classification
      doc.text(summary.classification, summaryX + 2, rowY);
      // Right align numbers
      doc.text(summary.bags.toFixed(2), summaryX + summaryCol1Width + summaryCol2Width - 2, rowY, { align: 'right' });
      if (is_byproduct) {
        doc.text(summary.heads.toFixed(0), summaryX + summaryCol1Width + summaryCol2Width + summaryCol3Width - 2, rowY, { align: 'right' });
      } else {
        doc.text(summary.heads.toFixed(2), summaryX + summaryCol1Width + summaryCol2Width + summaryCol3Width - 2, rowY, { align: 'right' });
      }
      doc.text(summary.kilograms.toFixed(2), summaryX + summaryTableWidth - 2, rowY, { align: 'right' });
    });

    // Page total row - centered vertically
    const totalRowTextY = summaryStartY + 5 + (numSummaryRows * summaryRowHeight) + (summaryRowHeight / 2) + 1.5;
    const pageTotalBags = is_byproduct ? page.total_byproduct_bags : page.total_dressed_bags;
    const pageTotalHeads = is_byproduct ? page.total_byproduct_heads : page.total_dressed_heads;
    const pageTotalKilos = is_byproduct ? page.total_byproduct_kilograms : page.total_dressed_kilograms;
    doc.setFont('helvetica', 'bold');
    // Left align TOTAL label
    doc.text('TOTAL', summaryX + 2, totalRowTextY);
    // Right align numbers
    doc.text(pageTotalBags.toFixed(2), summaryX + summaryCol1Width + summaryCol2Width - 2, totalRowTextY, { align: 'right' });
    if (is_byproduct) {
      doc.text(pageTotalHeads.toFixed(0), summaryX + summaryCol1Width + summaryCol2Width + summaryCol3Width - 2, totalRowTextY, { align: 'right' });
    } else {
      doc.text(pageTotalHeads.toFixed(2), summaryX + summaryCol1Width + summaryCol2Width + summaryCol3Width - 2, totalRowTextY, { align: 'right' });
    }
    doc.text(pageTotalKilos.toFixed(2), summaryX + summaryTableWidth - 2, totalRowTextY, { align: 'right' });
    
    // Update currentY for signature positioning
    const currentY = summaryStartY + 5 + (numSummaryRows * summaryRowHeight) + summaryRowHeight;

    // ========== SIGNATURES (on every page) - below summary table, all in one line ==========
    const signatureStartY = Math.max(totalsY + 8, currentY + 8);
    const signatureSpacing = (PAGE_WIDTH - (2 * MARGIN)) / 4; // Divide available width into 4 equal parts
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    // All signatures in one line
    doc.text('Prepared by: _______________', MARGIN + 5, signatureStartY);
    doc.text('Checked by: _______________', MARGIN + 5 + signatureSpacing, signatureStartY);
    doc.text('Approved by: _______________', MARGIN + 5 + (signatureSpacing * 2), signatureStartY);
    doc.text('Received by: _______________', MARGIN + 5 + (signatureSpacing * 3), signatureStartY);

    // ========== GRAND TOTAL (only on last page) ==========
    if (page_number === total_pages) {
      const grandTotalY = signatureStartY + 15;
      
      // Draw a line above grand total
      doc.setLineWidth(0.2);
      doc.line(MARGIN, grandTotalY - 2, PAGE_WIDTH - MARGIN, grandTotalY - 2);
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Grand Total:', MARGIN + 5, grandTotalY + 5);
      doc.setFontSize(10);
      doc.text(`Bags: ${grand_total_bags.toFixed(2)}`, MARGIN + 45, grandTotalY + 5);
      doc.text(`Heads: ${grand_total_heads.toFixed(2)}`, MARGIN + 85, grandTotalY + 5);
      doc.text(`Kilograms: ${grand_total_kilograms.toFixed(2)}`, MARGIN + 125, grandTotalY + 5);
    }
  });

  // Generate filename
  const dateStr = formatDate(date).replace(/\//g, '-');
  const filename = `Tally Sheet - ${customer_name} - ${dateStr}.pdf`;

  doc.save(filename);
};
