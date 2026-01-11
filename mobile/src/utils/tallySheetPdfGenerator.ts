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

interface TallySheetSummaryWithCategory extends TallySheetSummary {
  category: 'Dressed' | 'Frozen' | 'Byproduct';
}

// Default order for classifications (case-insensitive matching)
const DEFAULT_DRESSED_ORDER = ['Dressed Chicken', 'os', 'p4', 'p3', 'p2', 'p1', 'us', 'SQ', 'cb'];
const DEFAULT_BYPRODUCT_ORDER = ['lv', 'gz', 'si', 'ft', 'hd', 'pv', 'bld'];

const getDefaultOrder = (category: string): string[] => {
  if (category === 'Dressed') return DEFAULT_DRESSED_ORDER;
  if (category === 'Byproduct') return DEFAULT_BYPRODUCT_ORDER;
  return []; // Frozen: alphabetical
};

// Sort classifications by custom order or default order
const sortClassifications = <T extends { classification_id: number; classification: string }>(
  items: T[],
  category: 'Dressed' | 'Frozen' | 'Byproduct',
  customOrder?: { [category: string]: number[] }
): T[] => {
  const categoryOrder = customOrder?.[category];
  
  if (categoryOrder && categoryOrder.length > 0) {
    // Use custom order
    const itemMap = new Map(items.map(item => [item.classification_id, item]));
    const ordered: T[] = [];
    const unordered: T[] = [];

    // Add items in custom order
    for (const id of categoryOrder) {
      const item = itemMap.get(id);
      if (item) {
        ordered.push(item);
        itemMap.delete(id);
      }
    }

    // Add remaining items alphabetically
    for (const item of itemMap.values()) {
      unordered.push(item);
    }
    unordered.sort((a, b) => 
      a.classification.localeCompare(b.classification, undefined, { sensitivity: 'base' })
    );

    return [...ordered, ...unordered];
  }

  // Use default order
  const defaultOrder = getDefaultOrder(category);
  if (defaultOrder.length === 0) {
    // Alphabetical for Frozen
    return [...items].sort((a, b) => 
      a.classification.localeCompare(b.classification, undefined, { sensitivity: 'base' })
    );
  }

  const ordered: T[] = [];
  const unordered: T[] = [];
  const lowerDefaultOrder = defaultOrder.map(c => c.toLowerCase());

  // Add classifications in default order
  for (const defaultClass of lowerDefaultOrder) {
    const found = items.find(item => 
      item.classification.toLowerCase() === defaultClass
    );
    if (found) {
      ordered.push(found);
    }
  }

  // Add remaining classifications alphabetically
  for (const item of items) {
    if (!ordered.find(o => o.classification_id === item.classification_id)) {
      unordered.push(item);
    }
  }
  unordered.sort((a, b) => 
    a.classification.localeCompare(b.classification, undefined, { sensitivity: 'base' })
  );

  return [...ordered, ...unordered];
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
        summaries = page.summary_frozen || [];
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

const generateCustomerHTML = (data: TallySheetResponse, showGrandTotal: boolean = true): string => {
  const { customer_name, product_type, date, pages, grand_total_bags, grand_total_heads, grand_total_kilograms } = data;
  const ROWS_PER_PAGE = 20;

  const generatePageHTML = (page: TallySheetPage): string => {
    const { page_number, total_pages, columns, grid, summary_dressed, summary_frozen, summary_byproduct, is_byproduct, product_type: page_product_type } = page;
    // Determine which summary to use based on product type
    const isFrozen = page_product_type === "Frozen Chicken";
    const summaries = is_byproduct ? summary_byproduct : (isFrozen ? summary_frozen : summary_dressed);
    
    let html = `
      <div style="page-break-after: ${page_number < total_pages ? 'always' : 'auto'}; padding: 20px;">
        <h1 style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 10px;">TALLY SHEET</h1>
        <div style="margin-bottom: 10px;">
          <div>Customer: ${customer_name}</div>
          <div>Product: ${page_product_type}</div>
          <div style="display: flex; justify-content: space-between;">
            <span>Date: ${formatDate(date)}</span>
            <span>Page: ${page_number} of ${total_pages}</span>
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr>
              <th style="border: 1px solid #000; padding: 5px; width: 40px;">#</th>
              ${Array.from({ length: 13 }, (_, colIndex) => {
                const col = columns.find(c => c.index === colIndex);
                const headerText = col ? col.classification : '';
                return `<th style="border: 1px solid #000; padding: 5px; text-align: center;">${headerText}</th>`;
              }).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    // Grid rows - always 13 columns
    for (let row = 0; row < ROWS_PER_PAGE; row++) {
      html += '<tr>';
      html += `<td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold;">${row + 1}</td>`;
      for (let colIndex = 0; colIndex < 13; colIndex++) {
        const cell = grid[row] && grid[row][colIndex];
        let value = '';
        if (cell !== null && cell !== undefined) {
          // For byproduct, show as integer (heads), for dressed show as decimal (weight)
          value = is_byproduct ? formatNumber(cell, 0) : formatNumber(cell, 2);
        }
        html += `<td style="border: 1px solid #000; padding: 5px; text-align: center;">${value}</td>`;
      }
      html += '</tr>';
    }

    // Totals row - always 13 columns
    html += '<tr style="font-weight: bold;">';
    html += '<td style="border: 1px solid #000; padding: 5px; text-align: center;">TOTAL</td>';
    for (let colIndex = 0; colIndex < 13; colIndex++) {
      let columnTotal = 0;
      grid.forEach(row => {
        const cell = row && row[colIndex];
        if (cell !== null && cell !== undefined) {
          columnTotal += cell;
        }
      });
      // For byproduct, show as integer (heads), for dressed show as decimal (weight)
      const displayValue = is_byproduct ? formatNumber(columnTotal, 0) : formatNumber(columnTotal, 2);
      html += `<td style="border: 1px solid #000; padding: 5px; text-align: center;">${displayValue}</td>`;
    }
    html += '</tr>';

    html += `
          </tbody>
        </table>
        
        <div style="margin-top: 20px;">
    `;

    // Only show relevant summary based on page type
    if (is_byproduct && summary_byproduct.length > 0) {
      html += `
        <h3 style="font-size: 12px; font-weight: bold; margin-bottom: 5px;">Summary - Byproduct</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <thead>
            <tr>
              <th style="border: 1px solid #000; padding: 3px; text-align: left;">Classification</th>
              <th style="border: 1px solid #000; padding: 3px; text-align: center;">Bags</th>
              <th style="border: 1px solid #000; padding: 3px; text-align: center;">Kilograms</th>
            </tr>
          </thead>
          <tbody>
      `;

      summary_byproduct.forEach(summary => {
        html += `
          <tr>
            <td style="border: 1px solid #000; padding: 3px;">${summary.classification}</td>
            <td style="border: 1px solid #000; padding: 3px; text-align: center;">${formatNumber(summary.bags, 2)}</td>
            <td style="border: 1px solid #000; padding: 3px; text-align: center;">${formatNumber(summary.heads, 0)}</td>
          </tr>
        `;
      });

      html += `
          <tr style="font-weight: bold;">
            <td style="border: 1px solid #000; padding: 3px;">TOTAL</td>
            <td style="border: 1px solid #000; padding: 3px; text-align: center;">${formatNumber(page.total_byproduct_bags, 2)}</td>
            <td style="border: 1px solid #000; padding: 3px; text-align: center;">${formatNumber(page.total_byproduct_heads, 0)}</td>
          </tr>
        </tbody>
      </table>
      `;
    } else if (isFrozen && summary_frozen && summary_frozen.length > 0) {
      html += `
        <h3 style="font-size: 12px; font-weight: bold; margin-bottom: 5px;">Summary - Frozen</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <thead>
            <tr>
              <th style="border: 1px solid #000; padding: 3px; text-align: left;">Classification</th>
              <th style="border: 1px solid #000; padding: 3px; text-align: center;">Bags</th>
              <th style="border: 1px solid #000; padding: 3px; text-align: center;">Heads</th>
              <th style="border: 1px solid #000; padding: 3px; text-align: center;">Kilograms</th>
            </tr>
          </thead>
          <tbody>
      `;

      summary_frozen.forEach(summary => {
        html += `
          <tr>
            <td style="border: 1px solid #000; padding: 3px;">${summary.classification}</td>
            <td style="border: 1px solid #000; padding: 3px; text-align: center;">${formatNumber(summary.bags, 2)}</td>
            <td style="border: 1px solid #000; padding: 3px; text-align: center;">${formatNumber(summary.heads, 2)}</td>
            <td style="border: 1px solid #000; padding: 3px; text-align: center;">${formatNumber(summary.kilograms, 2)}</td>
          </tr>
        `;
      });

      html += `
          <tr style="font-weight: bold;">
            <td style="border: 1px solid #000; padding: 3px;">TOTAL</td>
            <td style="border: 1px solid #000; padding: 3px; text-align: center;">${formatNumber(page.total_frozen_bags, 2)}</td>
            <td style="border: 1px solid #000; padding: 3px; text-align: center;">${formatNumber(page.total_frozen_heads, 2)}</td>
            <td style="border: 1px solid #000; padding: 3px; text-align: center;">${formatNumber(page.total_frozen_kilograms, 2)}</td>
          </tr>
        </tbody>
      </table>
      `;
    } else if (!is_byproduct && !isFrozen && summary_dressed.length > 0) {
      html += `
        <h3 style="font-size: 12px; font-weight: bold; margin-bottom: 5px;">Summary - Dressed</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <thead>
            <tr>
              <th style="border: 1px solid #000; padding: 3px; text-align: left;">Classification</th>
              <th style="border: 1px solid #000; padding: 3px; text-align: center;">Bags</th>
              <th style="border: 1px solid #000; padding: 3px; text-align: center;">Heads</th>
              <th style="border: 1px solid #000; padding: 3px; text-align: center;">Kilograms</th>
            </tr>
          </thead>
          <tbody>
      `;

      summary_dressed.forEach(summary => {
        html += `
          <tr>
            <td style="border: 1px solid #000; padding: 3px;">${summary.classification}</td>
            <td style="border: 1px solid #000; padding: 3px; text-align: center;">${formatNumber(summary.bags, 2)}</td>
            <td style="border: 1px solid #000; padding: 3px; text-align: center;">${formatNumber(summary.heads, 2)}</td>
            <td style="border: 1px solid #000; padding: 3px; text-align: center;">${formatNumber(summary.kilograms, 2)}</td>
          </tr>
        `;
      });

      html += `
          <tr style="font-weight: bold;">
            <td style="border: 1px solid #000; padding: 3px;">TOTAL</td>
            <td style="border: 1px solid #000; padding: 3px; text-align: center;">${formatNumber(page.total_dressed_bags, 2)}</td>
            <td style="border: 1px solid #000; padding: 3px; text-align: center;">${formatNumber(page.total_dressed_heads, 2)}</td>
            <td style="border: 1px solid #000; padding: 3px; text-align: center;">${formatNumber(page.total_dressed_kilograms, 2)}</td>
          </tr>
        </tbody>
      </table>
      `;
    }

    html += `
      </div>
    `;

    // Signature section (on every page) - all in one line
    html += `
      <div style="margin-top: 20px; display: flex; justify-content: space-between; flex-wrap: wrap;">
        <span>Prepared by: _______________</span>
        <span>Checked by: _______________</span>
        <span>Approved by: _______________</span>
        <span>Received by: _______________</span>
      </div>
    `;

    // Grand totals (only on last page and if showGrandTotal is true)
    if (page_number === total_pages && showGrandTotal) {
      html += `
        <div style="margin-top: 20px;">
          <div style="font-size: 14px; font-weight: bold;">
            Grand Total: Bags: ${formatNumber(grand_total_bags, 2)} - Heads: ${formatNumber(grand_total_heads, 2)} - Kilograms: ${formatNumber(grand_total_kilograms, 2)}
          </div>
        </div>
      `;
    }

    html += '</div>';
    return html;
  };

  const pagesHTML = pages.map(generatePageHTML).join('');

  return pagesHTML;
};

export const generateTallySheetHTML = (
  data: TallySheetResponse | TallySheetMultiCustomerResponse,
  showGrandTotal: boolean = true,
  classificationOrder?: { [category: string]: number[] }
): string => {
  // Check if it's a multi-customer response
  const isMultiCustomer = 'customers' in data;
  let customers = isMultiCustomer ? (data as TallySheetMultiCustomerResponse).customers : [data as TallySheetResponse];
  
  // Sort customers alphabetically by name (backend already sorts, but ensure it here too)
  customers = [...customers].sort((a, b) => 
    a.customer_name.localeCompare(b.customer_name, undefined, { sensitivity: 'base' })
  );
  
  // Use showGrandTotal parameter, but for customer pages we don't show simple grand total, use detailed table instead
  const showCustomerGrandTotal = false; // Don't show simple grand total, use detailed table instead
  
  // Generate HTML for each customer with a page break between customers
  const customersHTML = customers.map((customerData, index) => {
    const customerHTML = generateCustomerHTML(customerData, showCustomerGrandTotal);
    // Add a page break before each customer except the first
    if (index > 0) {
      return `<div style="page-break-before: always;"></div>${customerHTML}`;
    }
    return customerHTML;
  }).join('');

  // Generate grand total category table HTML - one per customer
  let grandTotalCategoryTableHTML = '';
  customers.forEach((customerData) => {
    const { customer_name } = customerData;
    
    // Calculate grand totals for this specific customer
    const customerGrandTotals = calculateGrandTotalsByClassification([customerData]);
    
    if (customerGrandTotals && customerGrandTotals.size > 0) {
      // Group totals by category
      const totalsByCategory = {
        Dressed: [] as TallySheetSummaryWithCategory[],
        Frozen: [] as TallySheetSummaryWithCategory[],
        Byproduct: [] as TallySheetSummaryWithCategory[],
      };
      
      customerGrandTotals.forEach((summary) => {
        totalsByCategory[summary.category].push(summary);
      });
    
    // Sort each category by custom order or default order
    Object.keys(totalsByCategory).forEach(category => {
      totalsByCategory[category as keyof typeof totalsByCategory] = sortClassifications(
        totalsByCategory[category as keyof typeof totalsByCategory],
        category as 'Dressed' | 'Frozen' | 'Byproduct',
        classificationOrder
      );
    });
    
    const categoryOrder: Array<'Dressed' | 'Frozen' | 'Byproduct'> = ['Dressed', 'Frozen', 'Byproduct'];
    
    let categoryTablesHTML = '';
    categoryOrder.forEach((category) => {
      const categoryTotals = totalsByCategory[category];
      if (categoryTotals.length === 0) return; // Skip empty categories
      
      const isByproduct = category === 'Byproduct';
      const categoryTotalBags = categoryTotals.reduce((sum, s) => sum + s.bags, 0);
      const categoryTotalHeads = categoryTotals.reduce((sum, s) => sum + s.heads, 0);
      const categoryTotalKilos = categoryTotals.reduce((sum, s) => sum + s.kilograms, 0);
      
      categoryTablesHTML += `
        <h2 style="font-size: 14px; font-weight: bold; margin-top: 20px; margin-bottom: 10px;">${category} Chicken</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
          <thead>
            <tr>
              <th style="border: 1px solid #000; padding: 8px; text-align: left; background-color: #70AD47; color: white;">Classification</th>
              <th style="border: 1px solid #000; padding: 8px; text-align: center; background-color: #70AD47; color: white;">Bags</th>
              ${isByproduct 
                ? '<th style="border: 1px solid #000; padding: 8px; text-align: center; background-color: #70AD47; color: white;">Kilograms</th>'
                : '<th style="border: 1px solid #000; padding: 8px; text-align: center; background-color: #70AD47; color: white;">Heads</th><th style="border: 1px solid #000; padding: 8px; text-align: center; background-color: #70AD47; color: white;">Kilograms</th>'
              }
            </tr>
          </thead>
          <tbody>
            ${categoryTotals.map(summary => `
              <tr>
                <td style="border: 1px solid #000; padding: 6px;">${summary.classification}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: right;">${formatNumber(summary.bags, 2)}</td>
                ${isByproduct
                  ? `<td style="border: 1px solid #000; padding: 6px; text-align: right;">${formatNumber(summary.heads, 2)}</td>`
                  : `<td style="border: 1px solid #000; padding: 6px; text-align: right;">${formatNumber(summary.heads, 2)}</td>
                     <td style="border: 1px solid #000; padding: 6px; text-align: right;">${formatNumber(summary.kilograms, 2)}</td>`
                }
              </tr>
            `).join('')}
            <tr style="font-weight: bold; background-color: #C6E0B4;">
              <td style="border: 1px solid #000; padding: 8px;">${category} TOTAL</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatNumber(categoryTotalBags, 2)}</td>
              ${isByproduct
                ? `<td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatNumber(categoryTotalHeads, 2)}</td>`
                : `<td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatNumber(categoryTotalHeads, 2)}</td>
                   <td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatNumber(categoryTotalKilos, 2)}</td>`
              }
            </tr>
          </tbody>
        </table>
      `;
    });
    
      // Overall totals
      const allTotals = Array.from(customerGrandTotals.values());
    const overallTotalBags = allTotals.reduce((sum, s) => sum + s.bags, 0);
    // For overall heads: only sum heads from dressed/frozen (byproducts don't show heads column)
    const overallTotalHeads = allTotals.reduce((sum, s) => {
      if (s.category === 'Byproduct') {
        return sum; // Skip byproducts (they don't have a heads column)
      } else {
        return sum + s.heads; // Sum heads from dressed/frozen
      }
    }, 0);
    // For overall kilograms: sum kilograms from dressed/frozen, plus heads from byproducts (since byproducts display heads as "Kilograms")
    const overallTotalKilos = allTotals.reduce((sum, s) => {
      if (s.category === 'Byproduct') {
        return sum + s.heads; // Use heads value for byproducts (displayed as "Kilograms")
      } else {
        return sum + s.kilograms; // Use actual kilograms for dressed/frozen
      }
    }, 0);
    
      grandTotalCategoryTableHTML += `
        <div style="page-break-before: always; padding: 20px;">
          <h1 style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 20px;">${customer_name} Grand Totals</h1>
          ${categoryTablesHTML}
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 20px;">
          <thead>
            <tr>
              <th style="border: 1px solid #000; padding: 8px; text-align: left; background-color: #70AD47; color: white;">Classification</th>
              <th style="border: 1px solid #000; padding: 8px; text-align: center; background-color: #70AD47; color: white;">Bags</th>
              <th style="border: 1px solid #000; padding: 8px; text-align: center; background-color: #70AD47; color: white;">Heads</th>
              <th style="border: 1px solid #000; padding: 8px; text-align: center; background-color: #70AD47; color: white;">Kilograms</th>
            </tr>
          </thead>
          <tbody>
            <tr style="font-weight: bold; background-color: #D0D0D0;">
              <td style="border: 1px solid #000; padding: 8px;">GRAND TOTAL</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatNumber(overallTotalBags, 2)}</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatNumber(overallTotalHeads, 2)}</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatNumber(overallTotalKilos, 2)}</td>
            </tr>
          </tbody>
        </table>
        </div>
      `;
    }
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
        @media print {
          .page-break { page-break-after: always; }
        }
      </style>
    </head>
    <body>
      ${customersHTML}
      ${grandTotalCategoryTableHTML}
    </body>
    </html>
  `;
};

