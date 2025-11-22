import { ExportResponse, CustomerExportData } from '../types';

export const generateSessionReportHTML = (data: ExportResponse): string => {
  const { customers, grand_total_dc, grand_total_bp } = data;

  const generateCustomerRows = (customer: CustomerExportData) => {
    const { customer_name, items, subtotal } = customer;
    
    let rows = '';
    items.forEach((item, index) => {
      rows += `
        <tr>
          <td class="customer-col">${index === 0 ? `<b>${customer_name}</b>` : ''}</td>
          <td class="center-text">${item.category}</td>
          <td class="center-text">${item.classification}</td>
          <td class="center-text">${item.bags}</td>
        </tr>
      `;
    });

    // Subtotal row
    rows += `
      <tr class="subtotal-row">
        <td colspan="3" class="right-text"><b>Subtotal:</b></td>
        <td class="center-text"><b>${subtotal}</b></td>
      </tr>
      <tr><td colspan="4" style="height: 20px;"></td></tr>
    `;

    return rows;
  };

  const customerRows = customers.map(generateCustomerRows).join('');

  const grandTotal = grand_total_dc + grand_total_bp;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
      <style>
        body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 20px; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: center; padding: 8px; font-weight: bold; }
        td { padding: 6px 8px; vertical-align: top; }
        .customer-col { width: 30%; text-align: left; }
        .center-text { text-align: center; }
        .right-text { text-align: right; }
        .subtotal-row td { border-top: 2px solid black; border-bottom: 2px solid black; padding-top: 8px; padding-bottom: 8px; }
        
        .grand-total-container {
          margin-top: 40px;
          display: flex;
          justify-content: flex-end;
        }
        .grand-total-box {
          border: 2px solid black;
          padding: 0;
          width: 250px;
        }
        .grand-total-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 12px;
          font-weight: bold;
          font-size: 16px;
        }
        .grand-total-row:first-child {
          border-bottom: 1px solid black;
        }
        .grand-total-label {
          font-weight: bold;
          font-size: 18px;
          margin-right: 20px;
          align-self: center;
        }
      </style>
    </head>
    <body>
      <table>
        <thead>
          <tr>
            <th style="text-align: left;">Customer</th>
            <th>Category</th>
            <th>Class</th>
            <th>Bags</th>
          </tr>
        </thead>
        <tbody>
          ${customerRows}
        </tbody>
      </table>

      <div class="grand-total-container">
        <div class="grand-total-label">Grandtotal:</div>
        <div class="grand-total-box">
          <div class="grand-total-row">
            <span>DC</span>
            <span>${grand_total_dc.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
          </div>
          <div class="grand-total-row">
            <span>BP</span>
            <span>${grand_total_bp.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

