import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invoiceId } = await req.json();
    
    const invoices = await base44.entities.חשבונית.list();
    const invoiceData = invoices.find(i => i.id === invoiceId);
    
    if (!invoiceData) {
      return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const customers = await base44.entities.לקוח.list();
    const customer = customers.find(c => c.id === invoiceData.לקוח_id);
    
    const technicians = await base44.entities.טכנאי.list();
    const technician = technicians.find(t => t.id === invoiceData.טכנאי_id);
    
    const lines = await base44.entities.שורת_חשבונית.list();
    const workLines = lines
      .filter(l => l.חשבונית_id === invoiceId && l.סוג_שורה === 'עבודה')
      .sort((a, b) => {
        if ((a.מיון_שורות || 1) !== (b.מיון_שורות || 1)) {
          return (a.מיון_שורות || 1) - (b.מיון_שורות || 1);
        }
        return new Date(a.created_date).getTime() - new Date(b.created_date).getTime();
      });
    const itemLines = lines
      .filter(l => l.חשבונית_id === invoiceId && l.סוג_שורה === 'פריט')
      .sort((a, b) => {
        if ((a.מיון_שורות || 1) !== (b.מיון_שורות || 1)) {
          return (a.מיון_שורות || 1) - (b.מיון_שורות || 1);
        }
        return new Date(a.created_date).getTime() - new Date(b.created_date).getTime();
      });
    const creditLines = lines
      .filter(l => l.חשבונית_id === invoiceId && l.סוג_שורה === 'זיכוי_מלאי')
      .sort((a, b) => {
        if ((a.מיון_שורות || 1) !== (b.מיון_שורות || 1)) {
          return (a.מיון_שורות || 1) - (b.מיון_שורות || 1);
        }
        return new Date(a.created_date).getTime() - new Date(b.created_date).getTime();
      });

    const items = await base44.entities.פריט.list();

    const VAT_RATE = 0.18;

    // חישוב עבודה
    let laborSubtotal = 0;
    workLines.forEach(line => {
      const lineTotal = (line.כמות || 0) * (line.מחיר_יחידה || 0) * (1 - ((line.הנחה_אחוז || 0) / 100));
      laborSubtotal += lineTotal;
    });
    
    // חישוב חומרים
    let itemsSubtotal = 0;
    itemLines.forEach(line => {
      const lineTotal = (line.כמות || 0) * (line.מחיר_יחידה || 0) * (1 - ((line.הנחה_אחוז || 0) / 100));
      itemsSubtotal += lineTotal;
    });
    
    const laborVat = laborSubtotal * VAT_RATE;
    const laborTotal = laborSubtotal + laborVat;

    const itemsVat = itemsSubtotal * VAT_RATE;
    const itemsTotal = itemsSubtotal + itemsVat;

    const invoiceDate = new Date(invoiceData.תאריך).toLocaleDateString('he-IL');

    const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>חשבונית ודוח חומרים ${invoiceData.מספר_חשבונית}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Arial, sans-serif;
      padding: 15px;
      background: white;
      color: #000;
      direction: rtl;
    }
    
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 10px;
    }
    
    .page {
      page-break-after: always;
      page-break-inside: avoid;
    }
    
    .page:last-child {
      page-break-after: auto;
    }
    
    .top-row {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 12px;
      font-size: 12px;
    }
    
    .top-box {
      border: 2px solid #000;
      padding: 5px 8px;
      text-align: center;
      line-height: 1.3;
    }
    
    .top-right, .top-left {
      width: 160px;
    }
    
    .top-center {
      font-size: 16px;
      font-weight: bold;
      padding-top: 20px;
    }
    
    .main-header {
      text-align: center;
      margin-bottom: 10px;
    }
    
    .company-name {
      font-size: 36px;
      font-weight: bold;
      color: #ff0000;
      letter-spacing: 2px;
      margin-bottom: 3px;
    }
    
    .company-subtitle {
      font-size: 16px;
      color: #ff0000;
      margin-bottom: 6px;
    }
    
    .contact-bar {
      border: 2px solid #000;
      padding: 5px;
      text-align: center;
      font-size: 12px;
      margin-bottom: 12px;
    }
    
    .invoice-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .invoice-number {
      font-size: 20px;
      font-weight: bold;
    }
    
    .invoice-date {
      font-size: 14px;
    }
    
    .client-section {
      margin-bottom: 12px;
      border-bottom: 2px solid #000;
      padding-bottom: 6px;
    }
    
    .client-row {
      display: flex;
      border-bottom: 2px solid #000;
      padding: 3px 0;
      font-size: 13px;
    }
    
    .client-row:last-child {
      border-bottom: none;
    }
    
    .client-label {
      font-weight: bold;
      margin-left: 10px;
      min-width: 70px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      border: 2px solid #000;
    }
    
    th, td {
      border: 2px solid #000;
      padding: 4px 6px;
      text-align: center;
      font-size: 12px;
      line-height: 1.2;
    }
    
    th {
      background: #fff;
      font-weight: bold;
      padding: 5px 6px;
    }
    
    .summary-section {
      margin-top: 20px;
      display: flex;
      justify-content: space-between;
      align-items: start;
    }
    
    .summary-table {
      width: 350px;
      border: 2px solid #000;
      border-collapse: collapse;
    }
    
    .summary-table td {
      border: 2px solid #000;
      padding: 8px 12px;
      font-size: 14px;
    }
    
    .summary-table .label {
      text-align: right;
      font-weight: normal;
    }
    
    .summary-table .value {
      text-align: center;
      font-weight: bold;
    }
    
    .customer-details {
      text-align: right;
      font-size: 14px;
      line-height: 1.8;
    }
    
    .print-button {
      position: fixed;
      top: 20px;
      left: 20px;
      background: #4CAF50;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      z-index: 1000;
    }
    
    .print-button:hover {
      background: #45a049;
    }
    
    @media print {
      body {
        padding: 0;
      }
      
      .print-button {
        display: none;
      }
      
      .container {
        padding: 8px;
      }
      
      .page {
        page-break-after: always;
        page-break-inside: avoid;
      }
      
      .page:last-child {
        page-break-after: auto;
      }
      
      @page {
        size: A4;
        margin: 10mm;
      }
    }
  </style>
</head>
<body>
  <button class="print-button" onclick="window.print()">🖨️ הדפס הכל</button>
  
  <div class="container">
    <!-- עמוד 1: חשבונית -->
    <div class="page">
      <div class="top-row">
        <div class="top-box top-right">
          <div>טכנאי גז רמת 2</div>
          <div>מס' ההסמכה ${technician?.מספר_הסמכה || '1254'}</div>
        </div>
        
        <div class="top-center">
          העתק
        </div>
        
        <div class="top-box top-left">
          <div>עוסק מורשה למע"מ</div>
          <div>מס' 056510639</div>
        </div>
      </div>
      
      <div class="main-header">
        <div class="company-name">בן שלום שאלתיאל</div>
        <div class="company-subtitle">טכנאי גז ותיקונים</div>
      </div>
      
      <div class="contact-bar">
        רח' לוז 31 נחלת יהודה ראשון לציון טל. 054-7252776
      </div>
      
      <div class="invoice-header">
        <div class="invoice-date">${invoiceDate}</div>
        <div class="invoice-number">חשבון מספר ${invoiceData.מספר_חשבונית || '0'}</div>
      </div>
      
      <div class="client-section">
        <div class="client-row">
          <span class="client-label">לכבוד</span>
          <span>אמישרא גז</span>
        </div>
        <div class="client-row">
          <span class="client-label">כתובת:</span>
          <span>אחד העם 34 תל אביב</span>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th style="width: 10%;">כמות</th>
            <th style="width: 60%;">פריטים</th>
            <th style="width: 15%;">מחיר יח'</th>
            <th style="width: 15%;">סה"כ</th>
          </tr>
        </thead>
        <tbody>
          ${workLines.map(line => {
            const lineTotal = (line.כמות || 0) * (line.מחיר_יחידה || 0) * (1 - ((line.הנחה_אחוז || 0) / 100));
            return `
            <tr>
              <td>${line.כמות || ''}</td>
              <td style="text-align: right; padding-right: 10px;">${line.תיאור}</td>
              <td>${line.מחיר_יחידה?.toFixed(2) || '0.00'}</td>
              <td>${lineTotal.toFixed(2)}</td>
            </tr>
          `;
          }).join('')}
        </tbody>
      </table>
      
      <div class="summary-section">
        <div class="customer-details">
          <div>מרכזייה\\צרכן${customer?.שם_לקוח ? `: ${customer.שם_לקוח}` : ''}</div>
          ${customer?.כתובת ? `<div>כתובת: ${customer.כתובת}</div>` : ''}
          ${invoiceData.מספר_דוח ? `<div>מספר עבודה: ${invoiceData.מספר_דוח}</div>` : ''}
          ${invoiceData.מספר_493 ? `<div>493: ${invoiceData.מספר_493}</div>` : ''}
          ${itemsSubtotal > 0 ? `<div>סה"כ חומר: ₪${itemsSubtotal.toFixed(2)}</div>` : ''}
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: ${itemsSubtotal > 0 ? '5px' : '10px'};">
            ${invoiceData.קוד_מערכת ? `<div style="font-weight: bold; color: #666;">קוד מערכת: ${invoiceData.קוד_מערכת}</div>` : '<div></div>'}
            <div style="text-align: left; margin-right: 20px;">חתימת העוסק המורשה: _________________</div>
          </div>
        </div>
        
        <table class="summary-table">
          <tr>
            <td class="label">סה"כ</td>
            <td class="value">₪${laborSubtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td class="label">מע"מ בשיעור 18%</td>
            <td class="value">₪${laborVat.toFixed(2)}</td>
          </tr>
          <tr>
            <td class="label">סכום כולל מע"מ</td>
            <td class="value">₪${laborTotal.toFixed(2)}</td>
          </tr>
        </table>
      </div>
    </div>
    
    <!-- עמוד 2: דוח חומרים -->
    ${itemLines.length > 0 || creditLines.length > 0 ? `
    <div class="page">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px; padding-bottom: 10px; border: 2px solid #000; padding: 10px;">
        <div style="flex: 1; text-align: center;">
          <div style="font-size: 18px; font-weight: bold; color: #ff0000; margin-bottom: 5px;">דו"ח הוצאת חומרים ע"י הקבלן לעבודות תשתיות - לזיכוי</div>
          <div style="font-size: 14px;">טופס 493 א' מס' ${invoiceData.מספר_493 || invoiceData.מספר_דוח || '877787'}</div>
        </div>
        
        <div style="text-align: right; min-width: 200px; font-size: 12px;">
          <div style="margin-bottom: 5px;"><strong>שם:</strong> ${technician ? technician.שם_טכנאי : 'בן שלום שאלתיאל'}</div>
          <div><strong>קוד:</strong> 68</div>
        </div>
      </div>
      
      <div style="border: 2px solid #000; padding: 8px; margin-bottom: 8px; font-size: 11px;">
        <div style="margin-bottom: 3px;"><strong>מרכזייה\צרכן:</strong> ${customer?.שם_לקוח || 'לא צוין'}</div>
        <div style="margin-bottom: 3px;"><strong>כתובת:</strong> ${customer?.כתובת || 'לא צוינה'}</div>
        <div><strong>תאריך:</strong> ${invoiceDate}</div>
      </div>
      
      ${itemLines.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th>מק"ט</th>
            <th>תיאור פריט</th>
            <th>כמות</th>
            <th>מחיר</th>
            <th>סה"כ</th>
          </tr>
        </thead>
        <tbody>
          ${itemLines.map((line) => {
            const item = line.פריט_id ? items.find(i => i.id === line.פריט_id) : null;
            const catalogNumber = item?.מספר_קטלוג || '-';
            return `
            <tr>
              <td>${catalogNumber}</td>
              <td>${line.תיאור}</td>
              <td>${line.כמות || 1}</td>
              <td>${line.מחיר_יחידה?.toFixed(2) || '0.00'}</td>
              <td>${line.סכום_שורה?.toFixed(2) || '0.00'}</td>
            </tr>
          `;
          }).join('')}
        </tbody>
      </table>
      ` : ''}
      
      ${creditLines.length > 0 ? `
      <div style="font-size: 13px; font-weight: bold; margin: 15px 0 5px 0; color: #333;">זיכוי חומרים:</div>
      <table style="width: 60%; margin: 10px 0;">
        <thead>
          <tr>
            <th>מס' קטלוגי</th>
            <th>תיאור פריטים</th>
            <th>כמות</th>
          </tr>
        </thead>
        <tbody>
          ${creditLines.map((line) => {
            const item = line.פריט_id ? items.find(i => i.id === line.פריט_id) : null;
            const catalogNumber = item?.מספר_קטלוג || '-';
            return `
            <tr>
              <td>${catalogNumber}</td>
              <td>${line.תיאור}</td>
              <td>${line.כמות || 1}</td>
            </tr>
          `;
          }).join('')}
        </tbody>
      </table>
      ` : ''}
      
      <div style="display: flex; gap: 20px; margin-top: 15px;">
        <div style="flex: 1; border: 2px solid #000; padding: 10px; text-align: center;">
          <div style="font-size: 14px; margin-bottom: 5px;"><strong>סה"כ זיכוי כספי חומרים</strong></div>
          <div style="font-size: 16px; font-weight: bold;">₪${itemsSubtotal.toFixed(2)}</div>
        </div>
        
        <div style="flex: 1; border: 2px solid #000; padding: 10px; text-align: center;">
          <div style="font-size: 14px;"><strong>חשבון מס'</strong> ${invoiceData.מספר_חשבונית || ''} <strong>מיום</strong> ${invoiceDate}</div>
        </div>
      </div>
    </div>
    ` : ''}
    
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
    `;

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});