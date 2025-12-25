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
    const invoiceLines = lines
      .filter(l => l.חשבונית_id === invoiceId && l.סוג_שורה === 'פריט')
      .sort((a, b) => {
        if ((a.מיון_שורות || 1) !== (b.מיון_שורות || 1)) {
          return (a.מיון_שורות || 1) - (b.מיון_שורות || 1);
        }
        return new Date(a.created_date) - new Date(b.created_date);
      });
    const creditLines = lines
      .filter(l => l.חשבונית_id === invoiceId && l.סוג_שורה === 'זיכוי_מלאי')
      .sort((a, b) => {
        if ((a.מיון_שורות || 1) !== (b.מיון_שורות || 1)) {
          return (a.מיון_שורות || 1) - (b.מיון_שורות || 1);
        }
        return new Date(a.created_date) - new Date(b.created_date);
      });

    const items = await base44.entities.פריט.list();

    // חישוב סכומים רק לפי פריטים
    let itemsSubtotal = 0;
    invoiceLines.forEach(line => {
      const quantity = line.כמות || 0;
      const unitPrice = line.מחיר_יחידה || 0;
      const discountPercentage = line.הנחה_אחוז || 0;
      const lineTotal = quantity * unitPrice * (1 - (discountPercentage / 100));
      itemsSubtotal += lineTotal;
    });
    
    const itemsVat = itemsSubtotal * 0.18;
    const itemsTotal = itemsSubtotal + itemsVat;

    const invoiceDate = invoiceData.תאריך
      ? new Date(invoiceData.תאריך).toLocaleDateString('he-IL', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
      : '';

    const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>דו"ח הוצאת חומרים לזיכוי</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Arial, sans-serif;
      padding: 10px;
      background: white;
      color: #000;
      direction: rtl;
      font-size: 11px;
    }
    
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      border: 2px solid #000;
      padding: 10px;
    }
    
    .header {
      text-align: center;
      margin-bottom: 10px;
      padding-bottom: 10px;
      border-bottom: 2px solid #000;
    }
    
    .title {
      font-size: 16px;
      font-weight: bold;
      color: #ff0000;
      margin-bottom: 5px;
    }
    
    .subtitle {
      font-size: 13px;
      margin-bottom: 3px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      border: 2px solid #000;
    }
    
    th, td {
      border: 1px solid #000;
      padding: 4px 6px;
      text-align: center;
      font-size: 11px;
    }
    
    th {
      background: #f5f5f5;
      font-weight: bold;
      padding: 5px 6px;
    }
    
    .credit-table {
      width: 60%;
      margin: 20px 0;
    }
    
    .credit-title {
      font-size: 13px;
      font-weight: bold;
      margin: 15px 0 5px 0;
      color: #333;
    }
    
    .print-button {
      position: fixed;
      top: 20px;
      left: 20px;
      background: #673AB7;
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
      background: #5E35B1;
    }
    
    @media print {
      body {
        padding: 0;
      }
      
      .print-button {
        display: none;
      }
      
      .container {
        border: 2px solid #000;
        padding: 10px;
      }
      
      @page {
        size: A4;
        margin: 10mm;
      }
    }
  </style>
</head>
<body>
  <button class="print-button" onclick="window.print()">🖨️ הדפס דו"ח</button>
  
  <div class="container">
    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 2px solid #000;">
      <div class="header" style="flex: 1; border: none; padding: 0; margin: 0; text-align: center;">
        <div class="title">דו"ח הוצאת חומרים ע"י הקבלן לעבודות תשתיות - לזיכוי</div>
        <div class="subtitle">טופס 493 א' מס' ${invoiceData.מספר_493 || invoiceData.מספר_דוח || '877787'}</div>
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
        ${invoiceLines.map((line) => {
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
    
    ${creditLines.length > 0 ? `
    <div class="credit-title">זיכוי חומרים:</div>
    <table class="credit-table">
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