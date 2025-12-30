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

interface TallySheetSummaryWithCategory extends TallySheetSummary {
  category: 'Dressed' | 'Frozen' | 'Byproduct';
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
  summary_frozen: TallySheetSummary[];
  summary_byproduct: TallySheetSummary[];
  total_dressed_bags: number;
  total_dressed_heads: number;
  total_dressed_kilograms: number;
  total_frozen_bags: number;
  total_frozen_heads: number;
  total_frozen_kilograms: number;
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

interface TallySheetMultiCustomerResponse {
  customers: TallySheetResponse[];
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  return `${month}/${day}/${year}`;
};

const formatNumber = (value: number, decimals: number = 2): string => {
  return value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// Calculate grand totals by classification across all customers, grouped by category
const calculateGrandTotalsByClassification = (customers: TallySheetResponse[]): Map<number, TallySheetSummaryWithCategory> => {
  const totalsMap = new Map<number, TallySheetSummaryWithCategory>();

  customers.forEach(customer => {
    customer.pages.forEach(page => {
      // Process dressed, frozen, and byproduct summaries
      let summaries: TallySheetSummary[] = [];
      let category: 'Dressed' | 'Frozen' | 'Byproduct' = 'Dressed';
      
      if (page.is_byproduct) {
        summaries = page.summary_byproduct || [];
        category = 'Byproduct';
      } else if (page.product_type === "Frozen Chicken") {
        // Handle case where summary_frozen might not exist in response yet
        summaries = (page as any).summary_frozen || [];
        category = 'Frozen';
      } else {
        summaries = page.summary_dressed || [];
        category = 'Dressed';
      }
      
      summaries.forEach(summary => {
        const existing = totalsMap.get(summary.classification_id);
        if (existing) {
          existing.bags += summary.bags;
          existing.heads += summary.heads;
          existing.kilograms += summary.kilograms;
        } else {
          totalsMap.set(summary.classification_id, {
            classification: summary.classification,
            classification_id: summary.classification_id,
            bags: summary.bags,
            heads: summary.heads,
            kilograms: summary.kilograms,
            category: category,
          });
        }
      });
    });
  });

  return totalsMap;
};

export const generateTallySheetPDF = (data: TallySheetResponse | TallySheetMultiCustomerResponse, showGrandTotal: boolean = true) => {
  // Check if it's a multi-customer response
  const isMultiCustomer = 'customers' in data;
  let customers: TallySheetResponse[] = isMultiCustomer ? (data as TallySheetMultiCustomerResponse).customers : [data as TallySheetResponse];
  
  // Sort customers alphabetically by name
  customers = [...customers].sort((a, b) => 
    a.customer_name.localeCompare(b.customer_name, undefined, { sensitivity: 'base' })
  );
  
  // Calculate grand totals by classification (for both single and multiple customers)
  const grandTotalsByClassification = calculateGrandTotalsByClassification(customers);
  
  // Show grand total category table if showGrandTotal is true (for both single and multiple customers)
  const showGrandTotalCategoryTable = showGrandTotal;
  
  // Landscape orientation for letter size paper
  const doc = new jsPDF('landscape', 'mm', 'letter');
  
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
  
  let isFirstPage = true;
  
  // Process each customer
  customers.forEach((customerData) => {
    const { customer_name, date, pages } = customerData;

    pages.forEach((page) => {
      if (!isFirstPage) {
        doc.addPage();
      }
      isFirstPage = false;

    const { page_number, total_pages, columns, grid, summary_dressed, summary_frozen, summary_byproduct, is_byproduct, product_type: page_product_type } = page;
    // Determine which summary to use based on product type
    const summaries = is_byproduct ? summary_byproduct : (page_product_type === "Frozen Chicken" ? summary_frozen : summary_dressed);
    const isFrozen = page_product_type === "Frozen Chicken";

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
          const displayValue = is_byproduct ? formatNumber(cell, 0) : formatNumber(cell, 2);
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
      const displayValue = is_byproduct ? formatNumber(columnTotal, 0) : formatNumber(columnTotal, 2);
      doc.text(displayValue, x, totalsY, { align: 'center' });
    }

    // ========== SUMMARY SECTION (on every page) - positioned on the right ==========
    // Align summary table header with grid border start position
    const summaryHeaderTop = GRID_START_Y; // Align with grid border start
    const summaryStartY = summaryHeaderTop + 5; // Data rows start 5mm below header (summaryRowHeight)
    const summaryX = GRID_START_X + ROW_NUMBER_WIDTH + GRID_WIDTH + 8; // Right side of grid with reduced gap
    const summaryRowHeight = 5;
    // For byproducts, we only show 3 columns (Classification, Bags, Kilograms), so adjust width
    const summaryTableWidth = is_byproduct ? 70 : 90; // Total width of summary table
    const summaryCol1Width = 25; // Classification column width
    const summaryCol2Width = 20; // Bags column width
    const summaryCol3Width = is_byproduct ? 0 : 20; // Heads column width (not used for byproducts)

    // Calculate table height (header + rows + total row)
    const numSummaryRows = summaries.length;
    const summaryTableHeight = 5 + (numSummaryRows * summaryRowHeight) + summaryRowHeight; // Header + data rows + total row

    // Draw summary table borders
    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    
    // Outer border - starts at summaryHeaderTop
    doc.rect(summaryX, summaryHeaderTop, summaryTableWidth, summaryTableHeight);
    
    // Horizontal lines
    doc.setLineWidth(0.1);
    // Line below header
    doc.line(summaryX, summaryStartY, summaryX + summaryTableWidth, summaryStartY);
    // Lines between data rows (drawn below each data row)
    for (let i = 0; i < numSummaryRows; i++) {
      const y = summaryStartY + ((i + 1) * summaryRowHeight);
      doc.line(summaryX, y, summaryX + summaryTableWidth, y);
    }
    // Line above total row is already drawn by the loop above (when i = numSummaryRows - 1)
    
    // Vertical lines
    doc.line(summaryX + summaryCol1Width, summaryHeaderTop, summaryX + summaryCol1Width, summaryHeaderTop + summaryTableHeight);
    doc.line(summaryX + summaryCol1Width + summaryCol2Width, summaryHeaderTop, summaryX + summaryCol1Width + summaryCol2Width, summaryHeaderTop + summaryTableHeight);
    if (!is_byproduct) {
      // Only draw the third vertical line for dressed (Heads column)
      doc.line(summaryX + summaryCol1Width + summaryCol2Width + summaryCol3Width, summaryHeaderTop, summaryX + summaryCol1Width + summaryCol2Width + summaryCol3Width, summaryHeaderTop + summaryTableHeight);
    }

    // Single summary table on the right - text centered vertically in cells
    // Header row
    const headerRowY = summaryHeaderTop + (summaryRowHeight / 2) + 1.5; // Center of header cell
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    // Left align classification, right align numbers
    doc.text('Classification', summaryX + 2, headerRowY);
    doc.text('Bags', summaryX + summaryCol1Width + summaryCol2Width - 2, headerRowY, { align: 'right' });
    if (is_byproduct) {
      // For byproducts: Classification, Bags, Kilograms (which is heads value)
      doc.text('Kilograms', summaryX + summaryTableWidth - 2, headerRowY, { align: 'right' });
    } else {
      // For dressed: Classification, Bags, Heads, Kilograms
      doc.text('Heads', summaryX + summaryCol1Width + summaryCol2Width + summaryCol3Width - 2, headerRowY, { align: 'right' });
      doc.text('Kilograms', summaryX + summaryTableWidth - 2, headerRowY, { align: 'right' });
    }

    // Summary rows - dynamic based on entries for this page
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    summaries.forEach((summary, index) => {
      // Calculate Y position at center of each row cell
      const rowY = summaryStartY + (index * summaryRowHeight) + (summaryRowHeight / 2) + 1.5;
      // Left align classification
      doc.text(summary.classification, summaryX + 2, rowY);
      // Right align numbers
      doc.text(formatNumber(summary.bags, 2), summaryX + summaryCol1Width + summaryCol2Width - 2, rowY, { align: 'right' });
      if (is_byproduct) {
        // For byproducts: show heads value as Kilograms
        doc.text(formatNumber(summary.heads, 0), summaryX + summaryTableWidth - 2, rowY, { align: 'right' });
      } else {
        // For dressed: show Heads and Kilograms
        doc.text(formatNumber(summary.heads, 2), summaryX + summaryCol1Width + summaryCol2Width + summaryCol3Width - 2, rowY, { align: 'right' });
        doc.text(formatNumber(summary.kilograms, 2), summaryX + summaryTableWidth - 2, rowY, { align: 'right' });
      }
    });

    // Page total row - centered vertically
    const totalRowTextY = summaryStartY + (numSummaryRows * summaryRowHeight) + (summaryRowHeight / 2) + 1.5;
    const pageTotalBags = is_byproduct ? page.total_byproduct_bags : (isFrozen ? page.total_frozen_bags : page.total_dressed_bags);
    const pageTotalHeads = is_byproduct ? page.total_byproduct_heads : (isFrozen ? page.total_frozen_heads : page.total_dressed_heads);
    const pageTotalKilos = is_byproduct ? page.total_byproduct_kilograms : (isFrozen ? page.total_frozen_kilograms : page.total_dressed_kilograms);
    doc.setFont('helvetica', 'bold');
    // Left align TOTAL label
    doc.text('TOTAL', summaryX + 2, totalRowTextY);
    // Right align numbers
    doc.text(formatNumber(pageTotalBags, 2), summaryX + summaryCol1Width + summaryCol2Width - 2, totalRowTextY, { align: 'right' });
    if (is_byproduct) {
      // For byproducts: show heads total as Kilograms
      doc.text(formatNumber(pageTotalHeads, 0), summaryX + summaryTableWidth - 2, totalRowTextY, { align: 'right' });
    } else {
      // For dressed: show Heads and Kilograms totals
      doc.text(formatNumber(pageTotalHeads, 2), summaryX + summaryCol1Width + summaryCol2Width + summaryCol3Width - 2, totalRowTextY, { align: 'right' });
      doc.text(formatNumber(pageTotalKilos, 2), summaryX + summaryTableWidth - 2, totalRowTextY, { align: 'right' });
    }
    
    // Update currentY for signature positioning
    const currentY = summaryStartY + (numSummaryRows * summaryRowHeight) + summaryRowHeight;

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

      // ========== GRAND TOTAL (only on last page of last customer and if showGrandTotal is true) ==========
      const isLastCustomer = customers.indexOf(customerData) === customers.length - 1;
      const isLastPageOfLastCustomer = isLastCustomer && page_number === total_pages;
      if (isLastPageOfLastCustomer && showGrandTotal) {
        const grandTotalY = signatureStartY + 15;
        
        // Draw a line above grand total
        doc.setLineWidth(0.2);
        doc.line(MARGIN, grandTotalY - 2, PAGE_WIDTH - MARGIN, grandTotalY - 2);
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Grand Total:', MARGIN + 5, grandTotalY + 5);
        doc.setFontSize(10);
        
        // Calculate overall grand totals across all customers
        const overallGrandTotalBags = customers.reduce((sum, c) => sum + c.grand_total_bags, 0);
        const overallGrandTotalHeads = customers.reduce((sum, c) => sum + c.grand_total_heads, 0);
        const overallGrandTotalKilos = customers.reduce((sum, c) => sum + c.grand_total_kilograms, 0);
        
        doc.text(`Bags: ${formatNumber(overallGrandTotalBags, 2)}`, MARGIN + 45, grandTotalY + 5);
        doc.text(`Heads: ${formatNumber(overallGrandTotalHeads, 2)}`, MARGIN + 85, grandTotalY + 5);
        doc.text(`Kilograms: ${formatNumber(overallGrandTotalKilos, 2)}`, MARGIN + 125, grandTotalY + 5);
      }
    });
  });

  // ========== GRAND TOTAL CATEGORY TABLE (at the end for both single and multiple customers) ==========
  if (showGrandTotalCategoryTable && grandTotalsByClassification && grandTotalsByClassification.size > 0) {
    // Add a new page for the grand total category table
    doc.addPage();
    
    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('GRAND TOTAL BY CLASSIFICATION', PAGE_WIDTH / 2, 18, { align: 'center' });
    
    // Group totals by category
    const totalsByCategory = {
      Dressed: [] as TallySheetSummaryWithCategory[],
      Frozen: [] as TallySheetSummaryWithCategory[],
      Byproduct: [] as TallySheetSummaryWithCategory[],
    };
    
    grandTotalsByClassification.forEach((summary) => {
      totalsByCategory[summary.category].push(summary);
    });
    
    // Sort each category by classification name
    Object.keys(totalsByCategory).forEach(category => {
      totalsByCategory[category as keyof typeof totalsByCategory].sort((a, b) =>
        a.classification.localeCompare(b.classification, undefined, { sensitivity: 'base' })
      );
    });
    
    // Table dimensions - made more compact
    const tableStartX = MARGIN + 20;
    const tableWidth = PAGE_WIDTH - (2 * tableStartX);
    const rowHeight = 5.5; // Reduced from 7
    const col1Width = tableWidth * 0.5; // Classification
    const col2Width = tableWidth * 0.15; // Bags
    const col3Width = tableWidth * 0.15; // Heads
    // col4 (Kilograms) uses remaining width
    const spacingBetweenTables = 3; // Reduced from 5
    const PAGE_HEIGHT = 215.9; // Letter landscape height in mm
    const BOTTOM_MARGIN = 20; // Minimum space from bottom of page
    
    let currentY = 28; // Reduced from 35
    const categoryOrder: Array<'Dressed' | 'Frozen' | 'Byproduct'> = ['Dressed', 'Frozen', 'Byproduct'];
    
    // Render each category sub-table
    
    categoryOrder.forEach((category) => {
      const categoryTotals = totalsByCategory[category];
      if (categoryTotals.length === 0) return; // Skip empty categories
      
      // Check if we need a new page before adding this category
      const estimatedHeight = 2 + 5 + (categoryTotals.length + 2) * rowHeight + spacingBetweenTables;
      if (currentY + estimatedHeight > PAGE_HEIGHT - BOTTOM_MARGIN) {
        doc.addPage();
        currentY = 20; // Start near top of new page
      }
      
      // Category header
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      currentY += 2; // Reduced from 5
      doc.text(`${category} Chicken`, tableStartX, currentY);
      currentY += 5; // Reduced from 8
      
      // Calculate table dimensions for this category
      const numRows = categoryTotals.length + 2; // +2 for header and total row
      const tableHeight = numRows * rowHeight;
      const tableStartY = currentY;
      
      // Draw table borders
      doc.setDrawColor(0);
      doc.setLineWidth(0.2);
      doc.rect(tableStartX, tableStartY, tableWidth, tableHeight);
      
      // Draw horizontal lines
      doc.setLineWidth(0.1);
      for (let i = 0; i <= numRows; i++) {
        const y = tableStartY + (i * rowHeight);
        doc.line(tableStartX, y, tableStartX + tableWidth, y);
      }
      
      // Draw vertical lines
      doc.line(tableStartX + col1Width, tableStartY, tableStartX + col1Width, tableStartY + tableHeight);
      doc.line(tableStartX + col1Width + col2Width, tableStartY, tableStartX + col1Width + col2Width, tableStartY + tableHeight);
      doc.line(tableStartX + col1Width + col2Width + col3Width, tableStartY, tableStartX + col1Width + col2Width + col3Width, tableStartY + tableHeight);
      
      // Header row
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      const headerY = tableStartY + (rowHeight / 2) + 1.5;
      doc.text('Classification', tableStartX + 2, headerY);
      doc.text('Bags', tableStartX + col1Width + col2Width - 2, headerY, { align: 'right' });
      doc.text('Heads', tableStartX + col1Width + col2Width + col3Width - 2, headerY, { align: 'right' });
      doc.text('Kilograms', tableStartX + tableWidth - 2, headerY, { align: 'right' });
      
      // Data rows
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      categoryTotals.forEach((summary, index) => {
        const rowY = tableStartY + ((index + 1) * rowHeight) + (rowHeight / 2) + 1.5;
        doc.text(summary.classification, tableStartX + 2, rowY);
        doc.text(formatNumber(summary.bags, 2), tableStartX + col1Width + col2Width - 2, rowY, { align: 'right' });
        doc.text(formatNumber(summary.heads, 2), tableStartX + col1Width + col2Width + col3Width - 2, rowY, { align: 'right' });
        doc.text(formatNumber(summary.kilograms, 2), tableStartX + tableWidth - 2, rowY, { align: 'right' });
      });
      
      // Category total row
      const categoryTotalRowY = tableStartY + ((categoryTotals.length + 1) * rowHeight) + (rowHeight / 2) + 1.5;
      const categoryTotalBags = categoryTotals.reduce((sum, s) => sum + s.bags, 0);
      const categoryTotalHeads = categoryTotals.reduce((sum, s) => sum + s.heads, 0);
      const categoryTotalKilos = categoryTotals.reduce((sum, s) => sum + s.kilograms, 0);
      
      doc.setFont('helvetica', 'bold');
      doc.text(`${category} TOTAL`, tableStartX + 2, categoryTotalRowY);
      doc.text(formatNumber(categoryTotalBags, 2), tableStartX + col1Width + col2Width - 2, categoryTotalRowY, { align: 'right' });
      doc.text(formatNumber(categoryTotalHeads, 2), tableStartX + col1Width + col2Width + col3Width - 2, categoryTotalRowY, { align: 'right' });
      doc.text(formatNumber(categoryTotalKilos, 2), tableStartX + tableWidth - 2, categoryTotalRowY, { align: 'right' });
      
      currentY = tableStartY + tableHeight + spacingBetweenTables;
    });
    
    // Overall total row (after all category tables)
    const allTotals = Array.from(grandTotalsByClassification.values());
    const overallTotalBags = allTotals.reduce((sum, s) => sum + s.bags, 0);
    const overallTotalHeads = allTotals.reduce((sum, s) => sum + s.heads, 0);
    const overallTotalKilos = allTotals.reduce((sum, s) => sum + s.kilograms, 0);
    
    // Check if we need a new page for the overall total
    if (currentY + rowHeight + 3 > PAGE_HEIGHT - BOTTOM_MARGIN) {
      doc.addPage();
      currentY = 20;
    }
    
    currentY += 3; // Reduced from 5
    const overallTotalY = currentY;
    const overallTotalHeight = rowHeight;
    
    // Draw overall total table border
    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    doc.rect(tableStartX, overallTotalY, tableWidth, overallTotalHeight);
    
    // Draw vertical lines for overall total
    doc.line(tableStartX + col1Width, overallTotalY, tableStartX + col1Width, overallTotalY + overallTotalHeight);
    doc.line(tableStartX + col1Width + col2Width, overallTotalY, tableStartX + col1Width + col2Width, overallTotalY + overallTotalHeight);
    doc.line(tableStartX + col1Width + col2Width + col3Width, overallTotalY, tableStartX + col1Width + col2Width + col3Width, overallTotalY + overallTotalHeight);
    
    // Overall total row text
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const overallTotalTextY = overallTotalY + (rowHeight / 2) + 1.5;
    doc.text('GRAND TOTAL', tableStartX + 2, overallTotalTextY);
    doc.text(formatNumber(overallTotalBags, 2), tableStartX + col1Width + col2Width - 2, overallTotalTextY, { align: 'right' });
    doc.text(formatNumber(overallTotalHeads, 2), tableStartX + col1Width + col2Width + col3Width - 2, overallTotalTextY, { align: 'right' });
    doc.text(formatNumber(overallTotalKilos, 2), tableStartX + tableWidth - 2, overallTotalTextY, { align: 'right' });
  }

  // Generate filename
  const firstCustomer = customers[0];
  const dateStr = formatDate(firstCustomer.date).replace(/\//g, '-');
  let filename: string;
  if (customers.length === 1) {
    filename = `Tally Sheet - ${firstCustomer.customer_name} - ${dateStr}.pdf`;
  } else {
    filename = `Tally Sheet - Multiple Customers (${customers.length}) - ${dateStr}.pdf`;
  }

  doc.save(filename);
};
