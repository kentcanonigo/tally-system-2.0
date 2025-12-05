import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

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

export const generateTallySheetExcel = async (data: TallySheetResponse) => {
  const workbook = XLSX.utils.book_new();
  const { customer_name, product_type, date, pages, grand_total_bags, grand_total_heads, grand_total_kilograms } = data;

  const ROWS_PER_PAGE = 20;

  pages.forEach((page, pageIndex) => {
    const { page_number, total_pages, columns, grid, summary_dressed, summary_byproduct, is_byproduct } = page;
    const worksheetData: any[][] = [];

    // Header rows
    worksheetData.push(['TALLY SHEET']);
    worksheetData.push([]);
    worksheetData.push([`Customer: ${customer_name}`, '', '', '', `Product: ${product_type}`]);
    worksheetData.push([`Date: ${formatDate(date)}`, '', '', '', `Page: ${page_number} of ${total_pages}`]);
    worksheetData.push([]);

    // Column headers row - always 13 columns
    const headerRow: any[] = [''];
    for (let colIndex = 0; colIndex < 13; colIndex++) {
      const col = columns.find(c => c.index === colIndex);
      headerRow.push(col ? col.classification : '');
    }
    worksheetData.push(headerRow);

    // Grid rows (20 rows) - always 13 columns
    for (let row = 0; row < ROWS_PER_PAGE; row++) {
      const rowData: any[] = [row + 1]; // Row number
      for (let colIndex = 0; colIndex < 13; colIndex++) {
        const cell = grid[row] && grid[row][colIndex];
        if (cell !== null && cell !== undefined) {
          // For byproduct, show as integer (heads), for dressed show as decimal (weight)
          rowData.push(is_byproduct ? Math.round(cell) : cell);
        } else {
          rowData.push('');
        }
      }
      worksheetData.push(rowData);
    }

    // Totals row - always 13 columns
    const totalsRow: any[] = ['TOTAL'];
    for (let colIndex = 0; colIndex < 13; colIndex++) {
      let columnTotal = 0;
      grid.forEach(row => {
        const cell = row && row[colIndex];
        if (cell !== null && cell !== undefined) {
          columnTotal += cell;
        }
      });
      // For byproduct, show as integer (heads), for dressed show as decimal (weight)
      totalsRow.push(is_byproduct ? Math.round(columnTotal) : columnTotal);
    }
    worksheetData.push(totalsRow);
    worksheetData.push([]);

    // Summary table - only show relevant summary based on page type
    if (is_byproduct && summary_byproduct.length > 0) {
      worksheetData.push(['Summary - Byproduct', '', '', '']);
      worksheetData.push(['Classification', 'Bags', 'Heads', 'Kilograms']);
      
      summary_byproduct.forEach(summary => {
        worksheetData.push([
          summary.classification,
          summary.bags,
          Math.round(summary.heads),
          summary.kilograms
        ]);
      });
      
      // Byproduct totals
      worksheetData.push([
        'TOTAL',
        page.total_byproduct_bags,
        Math.round(page.total_byproduct_heads),
        page.total_byproduct_kilograms
      ]);
    } else if (!is_byproduct && summary_dressed.length > 0) {
      worksheetData.push(['Summary - Dressed', '', '', '']);
      worksheetData.push(['Classification', 'Bags', 'Heads', 'Kilograms']);
      
      summary_dressed.forEach(summary => {
        worksheetData.push([
          summary.classification,
          summary.bags,
          summary.heads,
          summary.kilograms
        ]);
      });
      
      // Dressed totals
      worksheetData.push([
        'TOTAL',
        page.total_dressed_bags,
        page.total_dressed_heads,
        page.total_dressed_kilograms
      ]);
    }

    // Signature section (only on last page)
    if (page_number === total_pages) {
      worksheetData.push([]);
      worksheetData.push(['Prepared by: _______________']);
      worksheetData.push(['Checked by: _______________']);
      worksheetData.push(['Approved by: _______________']);
      worksheetData.push(['Received by: _______________']);
      worksheetData.push([]);
      worksheetData.push(['Grand Total:']);
      worksheetData.push([`Bags: ${grand_total_bags.toFixed(2)}`]);
      worksheetData.push([`Heads: ${grand_total_heads.toFixed(2)}`]);
      worksheetData.push([`Kilograms: ${grand_total_kilograms.toFixed(2)}`]);
    }

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths - always 13 columns
    const colWidths = [{ wch: 8 }, ...Array(13).fill({ wch: 12 })];
    worksheet['!cols'] = colWidths;

    // Add worksheet to workbook
    const sheetName = `Page ${page_number}`;
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  });

  // Generate filename
  const dateStr = formatDate(date).replace(/\//g, '-');
  const filename = `Tally Sheet - ${customer_name} - ${dateStr}.xlsx`;

  // Write to file system
  const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  const uri = FileSystem.documentDirectory + filename;
  
  await FileSystem.writeAsStringAsync(uri, wbout, {
    encoding: FileSystem.EncodingType.Base64,
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

