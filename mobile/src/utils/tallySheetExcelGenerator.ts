import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

// Polyfill for Base64 if not available (needed for xlsx library in React Native)
// This must be set before xlsx is used
if (typeof (global as any).Base64 === 'undefined') {
  (global as any).Base64 = {
    encode: (input: string) => {
      // Simple base64 encode using btoa if available, otherwise manual implementation
      if (typeof btoa !== 'undefined') {
        return btoa(input);
      }
      // Manual base64 encoding fallback
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      let str = input;
      let output = '';
      for (let i = 0; i < str.length; i += 3) {
        const a = str.charCodeAt(i);
        const b = str.charCodeAt(i + 1) || 0;
        const c = str.charCodeAt(i + 2) || 0;
        const bitmap = (a << 16) | (b << 8) | c;
        output += chars.charAt((bitmap >> 18) & 63);
        output += chars.charAt((bitmap >> 12) & 63);
        output += i + 1 < str.length ? chars.charAt((bitmap >> 6) & 63) : '=';
        output += i + 2 < str.length ? chars.charAt(bitmap & 63) : '=';
      }
      return output;
    },
    decode: (input: string) => {
      if (typeof atob !== 'undefined') {
        return atob(input);
      }
      // Manual base64 decoding fallback
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      let str = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');
      let output = '';
      for (let i = 0; i < str.length; i += 4) {
        const enc1 = chars.indexOf(str.charAt(i));
        const enc2 = chars.indexOf(str.charAt(i + 1));
        const enc3 = chars.indexOf(str.charAt(i + 2));
        const enc4 = chars.indexOf(str.charAt(i + 3));
        const bitmap = (enc1 << 18) | (enc2 << 12) | (enc3 << 6) | enc4;
        output += String.fromCharCode((bitmap >> 16) & 255);
        if (enc3 !== 64) output += String.fromCharCode((bitmap >> 8) & 255);
        if (enc4 !== 64) output += String.fromCharCode(bitmap & 255);
      }
      return output;
    }
  };
}

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

const generateWorksheetForCustomer = (
  data: TallySheetResponse,
  workbook: XLSX.WorkBook
) => {
  const { customer_name, product_type, date, pages, grand_total_bags, grand_total_heads, grand_total_kilograms } = data;

  const ROWS_PER_PAGE = 20;
  const NUM_COLUMNS = 13;
  const SUMMARY_START_COL = 15; // Start summary table after the grid (row number + 13 columns + 1 gap)
  const SPACING_BETWEEN_TABLES = 3; // Rows between tables

  // Create single worksheet (matching web version)
  const sheetName = customer_name.length > 31 ? customer_name.substring(0, 31) : customer_name;
  const worksheetData: any[][] = [];

  let currentRow = 0;

  // Process each page
  pages.forEach((page, pageIndex) => {
    const { page_number, total_pages, columns, grid, summary_dressed, summary_byproduct, is_byproduct, product_type: page_product_type } = page;
    const summaries = is_byproduct ? summary_byproduct : summary_dressed;

    // Add spacing between tables (except for first table)
    if (pageIndex > 0) {
      for (let i = 0; i < SPACING_BETWEEN_TABLES; i++) {
        const emptyRow: any[] = Array(SUMMARY_START_COL + 3).fill('');
        worksheetData.push(emptyRow);
        currentRow++;
      }
    }

    const gridStartRow = currentRow;

    // Add header for each table
    const titleRow: any[] = Array(SUMMARY_START_COL + 3).fill('');
    titleRow[0] = 'TALLY SHEET';
    worksheetData.push(titleRow);
    currentRow++;

    // Empty row
    const emptyRow1: any[] = Array(SUMMARY_START_COL + 3).fill('');
    worksheetData.push(emptyRow1);
    currentRow++;

    // Customer and product info (use page-specific product type)
    const infoRow: any[] = Array(SUMMARY_START_COL + 3).fill('');
    infoRow[0] = `Customer: ${customer_name}`;
    infoRow[4] = `Product: ${page_product_type}`;
    worksheetData.push(infoRow);
    currentRow++;

    // Date and page info
    const dateRow: any[] = Array(SUMMARY_START_COL + 3).fill('');
    dateRow[0] = `Date: ${formatDate(date)}`;
    dateRow[4] = `Page: ${page_number} of ${total_pages}`;
    worksheetData.push(dateRow);
    currentRow++;

    // Empty row
    const emptyRow2: any[] = Array(SUMMARY_START_COL + 3).fill('');
    worksheetData.push(emptyRow2);
    currentRow++;

    // Column headers row - grid headers + summary headers on same row
    const headerRow: any[] = Array(SUMMARY_START_COL + 3).fill('');
    headerRow[0] = ''; // Row number column header
    for (let colIndex = 0; colIndex < NUM_COLUMNS; colIndex++) {
      const col = columns.find(c => c.index === colIndex);
      headerRow[colIndex + 1] = col ? col.classification : '';
    }
    // Summary table headers (same row as grid header)
    headerRow[SUMMARY_START_COL - 1] = 'Classification';
    headerRow[SUMMARY_START_COL] = 'Bags';
    headerRow[SUMMARY_START_COL + 1] = 'Heads';
    headerRow[SUMMARY_START_COL + 2] = 'Kilograms';
    worksheetData.push(headerRow);
    currentRow++;

    // Grid rows (20 rows) - with summary data on the right
    for (let row = 0; row < ROWS_PER_PAGE; row++) {
      const rowData: any[] = Array(SUMMARY_START_COL + 3).fill('');
      rowData[0] = row + 1; // Row number
      
      // Grid data cells
      for (let colIndex = 0; colIndex < NUM_COLUMNS; colIndex++) {
        const cell = grid[row] && grid[row][colIndex];
        if (cell !== null && cell !== undefined) {
          // For byproduct, show as integer (heads), for dressed show as decimal (weight)
          rowData[colIndex + 1] = is_byproduct ? Math.round(cell) : cell;
        }
      }

      // Summary data on the right (if this row has summary data)
      if (row < summaries.length) {
        const summary = summaries[row];
        rowData[SUMMARY_START_COL - 1] = summary.classification;
        rowData[SUMMARY_START_COL] = summary.bags;
        rowData[SUMMARY_START_COL + 1] = is_byproduct ? Math.round(summary.heads) : summary.heads;
        rowData[SUMMARY_START_COL + 2] = summary.kilograms;
      }

      worksheetData.push(rowData);
      currentRow++;
    }

    // Totals row - grid totals only
    const totalsRow: any[] = Array(SUMMARY_START_COL + 3).fill('');
    totalsRow[0] = 'TOTAL';
    
    // Grid totals
    for (let colIndex = 0; colIndex < NUM_COLUMNS; colIndex++) {
      let columnTotal = 0;
      grid.forEach(row => {
        const cell = row && row[colIndex];
        if (cell !== null && cell !== undefined) {
          columnTotal += cell;
        }
      });
      // For byproduct, show as integer (heads), for dressed show as decimal (weight)
      totalsRow[colIndex + 1] = is_byproduct ? Math.round(columnTotal) : columnTotal;
    }

    worksheetData.push(totalsRow);
    currentRow++;

    // Add any remaining summary rows that didn't fit in the grid rows
    const remainingSummaries = summaries.slice(ROWS_PER_PAGE);
    if (remainingSummaries.length > 0) {
      remainingSummaries.forEach(summary => {
        const summaryRow: any[] = Array(SUMMARY_START_COL + 3).fill('');
        summaryRow[SUMMARY_START_COL - 1] = summary.classification;
        summaryRow[SUMMARY_START_COL] = summary.bags;
        summaryRow[SUMMARY_START_COL + 1] = is_byproduct ? Math.round(summary.heads) : summary.heads;
        summaryRow[SUMMARY_START_COL + 2] = summary.kilograms;
        worksheetData.push(summaryRow);
        currentRow++;
      });
    }

    // Page total row in summary table (after all summary rows)
    const pageTotalBags = is_byproduct ? page.total_byproduct_bags : page.total_dressed_bags;
    const pageTotalHeads = is_byproduct ? page.total_byproduct_heads : page.total_dressed_heads;
    const pageTotalKilos = is_byproduct ? page.total_byproduct_kilograms : page.total_dressed_kilograms;
    const pageTotalRow: any[] = Array(SUMMARY_START_COL + 3).fill('');
    pageTotalRow[SUMMARY_START_COL - 1] = 'TOTAL';
    pageTotalRow[SUMMARY_START_COL] = pageTotalBags;
    pageTotalRow[SUMMARY_START_COL + 1] = is_byproduct ? Math.round(pageTotalHeads) : pageTotalHeads;
    pageTotalRow[SUMMARY_START_COL + 2] = pageTotalKilos;
    worksheetData.push(pageTotalRow);
    currentRow++;

    // Signatures (on every page) - 2x2 grid format
    const emptyRow3: any[] = Array(SUMMARY_START_COL + 3).fill('');
    worksheetData.push(emptyRow3);
    currentRow++;
    
    const sigRow1: any[] = Array(SUMMARY_START_COL + 3).fill('');
    sigRow1[0] = 'Prepared by: _______________';
    sigRow1[Math.floor(SUMMARY_START_COL / 2)] = 'Checked by: _______________';
    worksheetData.push(sigRow1);
    currentRow++;
    
    const sigRow2: any[] = Array(SUMMARY_START_COL + 3).fill('');
    sigRow2[0] = 'Approved by: _______________';
    sigRow2[Math.floor(SUMMARY_START_COL / 2)] = 'Received by: _______________';
    worksheetData.push(sigRow2);
    currentRow++;
  });

  // Grand Total table (only once at the end)
  const emptyRow4: any[] = Array(SUMMARY_START_COL + 3).fill('');
  worksheetData.push(emptyRow4);
  currentRow++;
  
  // Grand Total header row
  const grandTotalHeaderRow: any[] = Array(SUMMARY_START_COL + 3).fill('');
  grandTotalHeaderRow[0] = 'Grand Total';
  grandTotalHeaderRow[1] = 'Bags';
  grandTotalHeaderRow[2] = 'Heads';
  grandTotalHeaderRow[3] = 'Kilograms';
  worksheetData.push(grandTotalHeaderRow);
  currentRow++;
  
  // Grand Total data row
  const grandTotalRow: any[] = Array(SUMMARY_START_COL + 3).fill('');
  grandTotalRow[0] = 'TOTAL';
  grandTotalRow[1] = grand_total_bags;
  grandTotalRow[2] = grand_total_heads;
  grandTotalRow[3] = grand_total_kilograms;
  worksheetData.push(grandTotalRow);

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Set column widths - matching web version
  const colWidths: any[] = [];
  colWidths[0] = { wch: 8 }; // Row number column
  for (let col = 1; col <= NUM_COLUMNS; col++) {
    colWidths[col] = { wch: 12 }; // Grid data columns
  }
  // Empty columns for spacing
  for (let col = NUM_COLUMNS + 1; col < SUMMARY_START_COL - 1; col++) {
    colWidths[col] = { wch: 2 };
  }
  colWidths[SUMMARY_START_COL - 1] = { wch: 20 }; // Classification
  colWidths[SUMMARY_START_COL] = { wch: 12 }; // Bags
  colWidths[SUMMARY_START_COL + 1] = { wch: 12 }; // Heads
  colWidths[SUMMARY_START_COL + 2] = { wch: 15 }; // Kilograms
  worksheet['!cols'] = colWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
};

export const generateTallySheetExcel = async (data: TallySheetResponse | TallySheetMultiCustomerResponse) => {
  const workbook = XLSX.utils.book_new();
  
  // Check if it's a multi-customer response
  const isMultiCustomer = 'customers' in data;
  const customers = isMultiCustomer ? (data as TallySheetMultiCustomerResponse).customers : [data as TallySheetResponse];
  
  // Generate a worksheet for each customer
  customers.forEach((customerData) => {
    generateWorksheetForCustomer(customerData, workbook);
  });

  // Generate filename based on number of customers
  let filename: string;
  if (customers.length === 1) {
    const dateStr = formatDate(customers[0].date).replace(/\//g, '-');
    filename = `Tally Sheet - ${customers[0].customer_name} - ${dateStr}.xlsx`;
  } else {
    const dateStr = formatDate(customers[0].date).replace(/\//g, '-');
    filename = `Tally Sheet - Multiple Customers (${customers.length}) - ${dateStr}.xlsx`;
  }

  // Write to file system
  // Use 'array' type for React Native compatibility, then convert to base64
  const wbout = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  
  // Convert Uint8Array to base64 string
  // Use a compatible base64 encoding method for React Native
  let base64String = '';
  const bytes = new Uint8Array(wbout);
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const byte1 = bytes[i];
    const byte2 = bytes[i + 1] || 0;
    const byte3 = bytes[i + 2] || 0;
    
    const bitmap = (byte1 << 16) | (byte2 << 8) | byte3;
    
    base64String += 
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'[
        (bitmap >> 18) & 63
      ] +
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'[
        (bitmap >> 12) & 63
      ] +
      (i + 1 < len
        ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'[
            (bitmap >> 6) & 63
          ]
        : '=') +
      (i + 2 < len
        ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'[
            bitmap & 63
          ]
        : '=');
  }
  
  const uri = FileSystem.documentDirectory + filename;
  
  // Write the base64 string - expo-file-system accepts base64 strings directly
  // Check if EncodingType exists, otherwise use string literal
  const encoding = (FileSystem.EncodingType && FileSystem.EncodingType.Base64) 
    ? FileSystem.EncodingType.Base64 
    : 'base64';
  
  await FileSystem.writeAsStringAsync(uri, base64String, {
    encoding: encoding as any,
  });

  // Share the file
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Share Tally Sheet',
    });
  } else {
    throw new Error('Sharing is not available on this device');
  }
};
