import ExcelJS from 'exceljs';

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

// Calculate grand totals by classification across all customers
const calculateGrandTotalsByClassification = (customers: TallySheetResponse[]): Map<number, TallySheetSummary> => {
  const totalsMap = new Map<number, TallySheetSummary>();

  customers.forEach(customer => {
    customer.pages.forEach(page => {
      // Process both dressed and byproduct summaries
      const summaries = page.is_byproduct ? page.summary_byproduct : page.summary_dressed;
      
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
          });
        }
      });
    });
  });

  return totalsMap;
};

export const generateTallySheetExcel = async (data: TallySheetResponse | TallySheetMultiCustomerResponse, showGrandTotal: boolean = true) => {
  const workbook = new ExcelJS.Workbook();
  
  // Check if it's a multi-customer response
  const isMultiCustomer = 'customers' in data;
  let customers: TallySheetResponse[] = isMultiCustomer ? (data as TallySheetMultiCustomerResponse).customers : [data as TallySheetResponse];
  
  // Sort customers alphabetically by name
  customers = [...customers].sort((a, b) => 
    a.customer_name.localeCompare(b.customer_name, undefined, { sensitivity: 'base' })
  );
  
  // Calculate grand totals by classification if multiple customers
  const grandTotalsByClassification = customers.length > 1 ? calculateGrandTotalsByClassification(customers) : null;
  
  // Only show grand total category table if there are multiple customers
  const showGrandTotalCategoryTable = customers.length > 1 && showGrandTotal;
  
  // Process each customer
  let allCurrentRows: number[] = [];
  
  customers.forEach((customerData) => {
    const { customer_name, date, pages, grand_total_bags, grand_total_heads, grand_total_kilograms } = customerData;

    const ROWS_PER_PAGE = 20;
    const NUM_COLUMNS = 13;
    const SUMMARY_START_COL = 15; // Start summary table after the grid (row number + 13 columns + 1 gap)
    const SPACING_BETWEEN_TABLES = 3; // Rows between tables

    // Create worksheet for this customer
    const sheetName = customer_name.length > 31 ? customer_name.substring(0, 31) : customer_name;
    const worksheet = workbook.addWorksheet(sheetName);

  // Define styles
  const headerStyle = {
    font: { bold: true, size: 16, color: { argb: 'FFFFFFFF' } },
    fill: {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FF4472C4' } // Blue background
    },
    alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
    border: {
      top: { style: 'thin' as const, color: { argb: 'FF000000' } },
      bottom: { style: 'thin' as const, color: { argb: 'FF000000' } },
      left: { style: 'thin' as const, color: { argb: 'FF000000' } },
      right: { style: 'thin' as const, color: { argb: 'FF000000' } }
    }
  };

  const gridHeaderStyle = {
    font: { bold: true, size: 10, color: { argb: 'FFFFFFFF' } },
    fill: {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FF365F91' } // Darker blue
    },
    alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
    border: {
      top: { style: 'thin' as const, color: { argb: 'FF000000' } },
      bottom: { style: 'thin' as const, color: { argb: 'FF000000' } },
      left: { style: 'thin' as const, color: { argb: 'FF000000' } },
      right: { style: 'thin' as const, color: { argb: 'FF000000' } }
    }
  };

  const gridCellStyle = {
    alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
    border: {
      top: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } },
      left: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } }
    }
  };

  const gridCellAltStyle = {
    ...gridCellStyle,
    fill: {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFF2F2F2' } // Light gray
    }
  };

  const totalsRowStyle = {
    font: { bold: true, size: 10 },
    fill: {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFE7E6E6' } // Gray background
    },
    alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
    border: {
      top: { style: 'medium' as const, color: { argb: 'FF000000' } },
      bottom: { style: 'medium' as const, color: { argb: 'FF000000' } },
      left: { style: 'thin' as const, color: { argb: 'FF000000' } },
      right: { style: 'thin' as const, color: { argb: 'FF000000' } }
    }
  };

  const summaryHeaderStyle = {
    font: { bold: true, size: 10, color: { argb: 'FFFFFFFF' } },
    fill: {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FF70AD47' } // Green background
    },
    alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
    border: {
      top: { style: 'thin' as const, color: { argb: 'FF000000' } },
      bottom: { style: 'thin' as const, color: { argb: 'FF000000' } },
      left: { style: 'thin' as const, color: { argb: 'FF000000' } },
      right: { style: 'thin' as const, color: { argb: 'FF000000' } }
    }
  };

  const summaryCellStyle = {
    alignment: { horizontal: 'right' as const, vertical: 'middle' as const },
    border: {
      top: { style: 'thin' as const, color: { argb: 'FF000000' } },
      bottom: { style: 'thin' as const, color: { argb: 'FF000000' } },
      left: { style: 'thin' as const, color: { argb: 'FF000000' } },
      right: { style: 'thin' as const, color: { argb: 'FF000000' } }
    }
  };

  const summaryCellLeftStyle = {
    ...summaryCellStyle,
    alignment: { horizontal: 'left' as const, vertical: 'middle' as const }
  };

  const summaryTotalStyle = {
    font: { bold: true, size: 10 },
    fill: {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFC6E0B4' } // Light green
    },
    alignment: { horizontal: 'right' as const, vertical: 'middle' as const },
    border: {
      top: { style: 'medium' as const, color: { argb: 'FF000000' } },
      bottom: { style: 'medium' as const, color: { argb: 'FF000000' } },
      left: { style: 'thin' as const, color: { argb: 'FF000000' } },
      right: { style: 'thin' as const, color: { argb: 'FF000000' } }
    }
  };

  const summaryTotalLeftStyle = {
    ...summaryTotalStyle,
    alignment: { horizontal: 'left' as const, vertical: 'middle' as const }
  };

  let currentRow = 1;

  // Process each page
  pages.forEach((page, pageIndex) => {
    const { columns, grid, summary_dressed, summary_byproduct, is_byproduct, product_type: page_product_type } = page;
    const summaries = is_byproduct ? summary_byproduct : summary_dressed;

    // Add spacing between tables (except for first table)
    if (pageIndex > 0) {
      for (let i = 0; i < SPACING_BETWEEN_TABLES; i++) {
        worksheet.addRow([]);
        currentRow++;
      }
    }

    // Add header for each table
    const titleRow = worksheet.addRow(['TALLY SHEET']);
    titleRow.height = 25;
    worksheet.mergeCells(currentRow, 1, currentRow, SUMMARY_START_COL + 3);
    const titleCell = worksheet.getCell(currentRow, 1);
    titleCell.style = headerStyle;
    currentRow++;

    // Empty row
    worksheet.addRow([]);
    currentRow++;

    // Customer and product info (use page-specific product type)
    const infoRow = worksheet.addRow([`Customer: ${customer_name}`, '', '', '', `Product: ${page_product_type}`]);
    infoRow.getCell(1).font = { bold: true, size: 11 };
    infoRow.getCell(5).font = { bold: true, size: 11 };
    currentRow++;

    // Date and page info
    const dateRow = worksheet.addRow([`Date: ${formatDate(date)}`, '', '', '', `Page: ${page.page_number} of ${page.total_pages}`]);
    dateRow.getCell(1).font = { size: 11 };
    dateRow.getCell(5).font = { size: 11 };
    currentRow++;

    // Empty row
    worksheet.addRow([]);
    currentRow++;

    const gridStartRow = currentRow;

    // Column headers row
    const headerRow = worksheet.addRow(['']);
    headerRow.height = 20;
    for (let colIndex = 0; colIndex < NUM_COLUMNS; colIndex++) {
      const col = columns.find(c => c.index === colIndex);
      const cell = headerRow.getCell(colIndex + 2); // +2 because first column is row numbers
      cell.value = col ? col.classification : '';
      cell.style = gridHeaderStyle;
    }
    // Row number column header
    headerRow.getCell(1).style = gridHeaderStyle;
    currentRow++;

    // Grid rows (20 rows) - with summary data on the right
    for (let row = 0; row < ROWS_PER_PAGE; row++) {
      const dataRow = worksheet.addRow([row + 1]);
      dataRow.height = 18;
      
      // Row number cell
      const rowNumCell = dataRow.getCell(1);
      rowNumCell.style = {
        ...gridCellStyle,
        font: { bold: true },
        fill: {
          type: 'pattern' as const,
          pattern: 'solid' as const,
          fgColor: { argb: 'FFE7E6E6' }
        }
      };

      // Data cells
      for (let colIndex = 0; colIndex < NUM_COLUMNS; colIndex++) {
        const cell = grid[row] && grid[row][colIndex];
        const dataCell = dataRow.getCell(colIndex + 2);
        if (cell !== null && cell !== undefined) {
          dataCell.value = is_byproduct ? Math.round(cell) : cell;
          dataCell.numFmt = is_byproduct ? '0' : '0.00';
        } else {
          dataCell.value = '';
        }
        // Alternate row colors
        dataCell.style = row % 2 === 0 ? gridCellStyle : gridCellAltStyle;
      }

      // Summary data on the right (if this row has summary data)
      if (row < summaries.length) {
        const summary = summaries[row];
        dataRow.getCell(SUMMARY_START_COL).value = summary.classification;
        dataRow.getCell(SUMMARY_START_COL).style = summaryCellLeftStyle;
        dataRow.getCell(SUMMARY_START_COL + 1).value = summary.bags;
        dataRow.getCell(SUMMARY_START_COL + 1).numFmt = '0.00';
        dataRow.getCell(SUMMARY_START_COL + 1).style = summaryCellStyle;
        if (is_byproduct) {
          // For byproducts: show heads value as Kilograms
          dataRow.getCell(SUMMARY_START_COL + 2).value = Math.round(summary.heads);
          dataRow.getCell(SUMMARY_START_COL + 2).numFmt = '0';
          dataRow.getCell(SUMMARY_START_COL + 2).style = summaryCellStyle;
        } else {
          // For dressed: show Heads and Kilograms
          dataRow.getCell(SUMMARY_START_COL + 2).value = summary.heads;
          dataRow.getCell(SUMMARY_START_COL + 2).numFmt = '0.00';
          dataRow.getCell(SUMMARY_START_COL + 2).style = summaryCellStyle;
          dataRow.getCell(SUMMARY_START_COL + 3).value = summary.kilograms;
          dataRow.getCell(SUMMARY_START_COL + 3).numFmt = '0.00';
          dataRow.getCell(SUMMARY_START_COL + 3).style = summaryCellStyle;
        }
      }
      currentRow++;
    }

    // Totals row
    const totalsRow = worksheet.addRow(['TOTAL']);
    totalsRow.height = 20;
    totalsRow.getCell(1).style = totalsRowStyle;
    for (let colIndex = 0; colIndex < NUM_COLUMNS; colIndex++) {
      let columnTotal = 0;
      grid.forEach(row => {
        const cell = row[colIndex];
        if (cell !== null && cell !== undefined) {
          columnTotal += cell;
        }
      });
      const totalCell = totalsRow.getCell(colIndex + 2);
      totalCell.value = is_byproduct ? Math.round(columnTotal) : columnTotal;
      totalCell.numFmt = is_byproduct ? '0' : '0.00';
      totalCell.style = totalsRowStyle;
    }

    // Page total row in summary table (same row as grid totals)
    const pageTotalBags = is_byproduct ? page.total_byproduct_bags : page.total_dressed_bags;
    const pageTotalHeads = is_byproduct ? page.total_byproduct_heads : page.total_dressed_heads;
    const pageTotalKilos = is_byproduct ? page.total_byproduct_kilograms : page.total_dressed_kilograms;
    totalsRow.getCell(SUMMARY_START_COL).value = 'TOTAL';
    totalsRow.getCell(SUMMARY_START_COL).style = summaryTotalLeftStyle;
    totalsRow.getCell(SUMMARY_START_COL + 1).value = pageTotalBags;
    totalsRow.getCell(SUMMARY_START_COL + 1).numFmt = '0.00';
    totalsRow.getCell(SUMMARY_START_COL + 1).style = summaryTotalStyle;
    if (is_byproduct) {
      // For byproducts: show heads total as Kilograms
      totalsRow.getCell(SUMMARY_START_COL + 2).value = Math.round(pageTotalHeads);
      totalsRow.getCell(SUMMARY_START_COL + 2).numFmt = '0';
      totalsRow.getCell(SUMMARY_START_COL + 2).style = summaryTotalStyle;
    } else {
      // For dressed: show Heads and Kilograms totals
      totalsRow.getCell(SUMMARY_START_COL + 2).value = pageTotalHeads;
      totalsRow.getCell(SUMMARY_START_COL + 2).numFmt = '0.00';
      totalsRow.getCell(SUMMARY_START_COL + 2).style = summaryTotalStyle;
      totalsRow.getCell(SUMMARY_START_COL + 3).value = pageTotalKilos;
      totalsRow.getCell(SUMMARY_START_COL + 3).numFmt = '0.00';
      totalsRow.getCell(SUMMARY_START_COL + 3).style = summaryTotalStyle;
    }
    currentRow++;

    // Summary table header (same row as grid header)
    const summaryHeaderRow = worksheet.getRow(gridStartRow);
    summaryHeaderRow.getCell(SUMMARY_START_COL).value = 'Classification';
    summaryHeaderRow.getCell(SUMMARY_START_COL).style = summaryHeaderStyle;
    summaryHeaderRow.getCell(SUMMARY_START_COL + 1).value = 'Bags';
    summaryHeaderRow.getCell(SUMMARY_START_COL + 1).style = summaryHeaderStyle;
    if (is_byproduct) {
      // For byproducts: Classification, Bags, Kilograms (which is heads value)
      summaryHeaderRow.getCell(SUMMARY_START_COL + 2).value = 'Kilograms';
      summaryHeaderRow.getCell(SUMMARY_START_COL + 2).style = summaryHeaderStyle;
    } else {
      // For dressed: Classification, Bags, Heads, Kilograms
      summaryHeaderRow.getCell(SUMMARY_START_COL + 2).value = 'Heads';
      summaryHeaderRow.getCell(SUMMARY_START_COL + 2).style = summaryHeaderStyle;
      summaryHeaderRow.getCell(SUMMARY_START_COL + 3).value = 'Kilograms';
      summaryHeaderRow.getCell(SUMMARY_START_COL + 3).style = summaryHeaderStyle;
    }



    // Signatures (on every page) - all in one line
    worksheet.addRow([]);
    currentRow++;
    const sigRow = worksheet.addRow([]);
    sigRow.getCell(1).value = 'Prepared by: _______________';
    sigRow.getCell(1).font = { size: 10 };
    sigRow.getCell(2).value = 'Checked by: _______________';
    sigRow.getCell(2).font = { size: 10 };
    sigRow.getCell(3).value = 'Approved by: _______________';
    sigRow.getCell(3).font = { size: 10 };
    sigRow.getCell(4).value = 'Received by: _______________';
    sigRow.getCell(4).font = { size: 10 };
    currentRow++;
  });

    // Grand Total table (only once at the end of each customer's worksheet and if showGrandTotal is true)
    if (showGrandTotal) {
      worksheet.addRow([]);
      currentRow++;
      
      // Grand Total header row
      const grandTotalHeaderRow = worksheet.addRow([]);
      grandTotalHeaderRow.height = 20;
      grandTotalHeaderRow.getCell(1).value = 'Grand Total';
      grandTotalHeaderRow.getCell(1).style = summaryHeaderStyle;
      grandTotalHeaderRow.getCell(2).value = 'Bags';
      grandTotalHeaderRow.getCell(2).style = summaryHeaderStyle;
      grandTotalHeaderRow.getCell(3).value = 'Heads';
      grandTotalHeaderRow.getCell(3).style = summaryHeaderStyle;
      grandTotalHeaderRow.getCell(4).value = 'Kilograms';
      grandTotalHeaderRow.getCell(4).style = summaryHeaderStyle;
      currentRow++;
      
      // Grand Total data row
      const grandTotalRow = worksheet.addRow([]);
      grandTotalRow.height = 22;
      grandTotalRow.getCell(1).value = 'TOTAL';
      grandTotalRow.getCell(1).style = summaryTotalLeftStyle;
      grandTotalRow.getCell(2).value = grand_total_bags;
      grandTotalRow.getCell(2).numFmt = '0.00';
      grandTotalRow.getCell(2).style = summaryTotalStyle;
      grandTotalRow.getCell(3).value = grand_total_heads;
      grandTotalRow.getCell(3).numFmt = '0.00';
      grandTotalRow.getCell(3).style = summaryTotalStyle;
      grandTotalRow.getCell(4).value = grand_total_kilograms;
      grandTotalRow.getCell(4).numFmt = '0.00';
      grandTotalRow.getCell(4).style = summaryTotalStyle;
    }

    // Set column widths
    worksheet.getColumn(1).width = 8; // Row number column
    for (let col = 2; col <= NUM_COLUMNS + 1; col++) {
      worksheet.getColumn(col).width = 12; // Grid data columns
    }
    worksheet.getColumn(SUMMARY_START_COL).width = 20; // Classification
    worksheet.getColumn(SUMMARY_START_COL + 1).width = 12; // Bags
    worksheet.getColumn(SUMMARY_START_COL + 2).width = 12; // Heads
    worksheet.getColumn(SUMMARY_START_COL + 3).width = 15; // Kilograms
    
    allCurrentRows.push(currentRow);
  });

  // Add grand total category table worksheet if multiple customers
  if (showGrandTotalCategoryTable && grandTotalsByClassification && grandTotalsByClassification.size > 0) {
    const summaryWorksheet = workbook.addWorksheet('Grand Total by Classification');
    
    // Convert map to array and sort by classification name
    const sortedTotals = Array.from(grandTotalsByClassification.values()).sort((a, b) => 
      a.classification.localeCompare(b.classification, undefined, { sensitivity: 'base' })
    );
    
    // Header row
    const headerRow = summaryWorksheet.addRow(['Classification', 'Bags', 'Heads', 'Kilograms']);
    headerRow.height = 20;
    headerRow.eachCell((cell, colNumber) => {
      cell.style = summaryHeaderStyle;
    });
    
    // Data rows
    sortedTotals.forEach(summary => {
      const row = summaryWorksheet.addRow([
        summary.classification,
        summary.bags,
        summary.heads,
        summary.kilograms
      ]);
      row.getCell(2).numFmt = '0.00';
      row.getCell(3).numFmt = '0.00';
      row.getCell(4).numFmt = '0.00';
      row.eachCell((cell, colNumber) => {
        if (colNumber === 1) {
          cell.style = summaryCellLeftStyle;
        } else {
          cell.style = summaryCellStyle;
        }
      });
    });
    
    // Total row
    const totalBags = sortedTotals.reduce((sum, s) => sum + s.bags, 0);
    const totalHeads = sortedTotals.reduce((sum, s) => sum + s.heads, 0);
    const totalKilos = sortedTotals.reduce((sum, s) => sum + s.kilograms, 0);
    
    const totalRow = summaryWorksheet.addRow(['TOTAL', totalBags, totalHeads, totalKilos]);
    totalRow.height = 22;
    totalRow.getCell(1).style = summaryTotalLeftStyle;
    totalRow.getCell(2).numFmt = '0.00';
    totalRow.getCell(2).style = summaryTotalStyle;
    totalRow.getCell(3).numFmt = '0.00';
    totalRow.getCell(3).style = summaryTotalStyle;
    totalRow.getCell(4).numFmt = '0.00';
    totalRow.getCell(4).style = summaryTotalStyle;
    
    // Set column widths
    summaryWorksheet.getColumn(1).width = 30; // Classification
    summaryWorksheet.getColumn(2).width = 15; // Bags
    summaryWorksheet.getColumn(3).width = 15; // Heads
    summaryWorksheet.getColumn(4).width = 18; // Kilograms
  }

  // Generate filename
  const firstCustomer = customers[0];
  const dateStr = formatDate(firstCustomer.date).replace(/\//g, '-');
  let filename: string;
  if (customers.length === 1) {
    filename = `Tally Sheet - ${firstCustomer.customer_name} - ${dateStr}.xlsx`;
  } else {
    filename = `Tally Sheet - Multiple Customers (${customers.length}) - ${dateStr}.xlsx`;
  }

  // Save file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};
