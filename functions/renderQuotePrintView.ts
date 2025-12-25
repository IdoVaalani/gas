import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { quoteId } = await req.json();
    
    const quote = await base44.entities.הצעת_מחיר.list();
    const quoteData = quote.find(q => q.id === quoteId);
    
    if (!quoteData) {
      return Response.json({ error: 'Quote not found' }, { status: 404 });
    }

    const customers = await base44.entities.לקוח.list();
    const customer = customers.find(c => c.id === quoteData.לקוח_id);
    
    const lines = await base44.entities.שורת_הצעה.list();
    const quoteLines = lines.filter(l => l.הצעת_מחיר_id === quoteId);

    const VAT_RATE = 0.18;
    let subtotal = 0;
    
    quoteLines.forEach(line => {
      const lineTotal = (line.כמות || 0) * (line.מחיר_יחידה || 0) * (1 - ((line.הנחה_אחוז || 0) / 100));
      subtotal += lineTotal;
    });
    
    const calculatedVat = subtotal * VAT_RATE;
    const calculatedTotal = subtotal + calculatedVat;

    const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>הצעת מחיר ${quoteData.מספר_הצעה}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Arial, sans-serif;
      padding: 40px;
      background: white;
      color: #333;
      direction: rtl;
    }
    
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
    }
    
    .header {
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
      display: flex;
      justify-between;
      align-items: center;
    }
    
    .company-info {
      text-align: right;
    }
    
    .company-name {
      font-size: 32px;
      font-weight: bold;
      color: #2563eb;
      margin-bottom: 5px;
    }
    
    .company-details {
      font-size: 14px;
      color: #666;
      line-height: 1.6;
    }
    
    .document-title {
      font-size: 24px;
      font-weight: bold;
      color: #1e40af;
      text-align: left;
    }
    
    .info-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 30px;
    }
    
    .info-box {
      background: #f8fafc;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    
    .info-box h3 {
      font-size: 16px;
      color: #1e40af;
      margin-bottom: 10px;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 5px;
    }
    
    .info-box p {
      margin: 8px 0;
      font-size: 14px;
      line-height: 1.6;
    }
    
    .info-label {
      font-weight: bold;
      color: #64748b;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 30px 0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    thead {
      background: #2563eb;
      color: white;
    }
    
    th {
      padding: 15px;
      text-align: right;
      font-weight: bold;
      font-size: 14px;
    }
    
    td {
      padding: 12px 15px;
      border-bottom: 1px solid #e2e8f0;
      text-align: right;
    }
    
    tbody tr:hover {
      background: #f8fafc;
    }
    
    .totals {
      margin-top: 30px;
      text-align: left;
      max-width: 400px;
      margin-right: auto;
    }
    
    .totals-row {
      display: flex;
      justify-between;
      padding: 10px 20px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 15px;
    }
    
    .totals-row.subtotal {
      background: #f8fafc;
    }
    
    .totals-row.vat {
      background: #f1f5f9;
    }
    
    .totals-row.total {
      background: #2563eb;
      color: white;
      font-weight: bold;
      font-size: 18px;
      border: none;
      margin-top: 5px;
    }
    
    .notes {
      margin-top: 40px;
      padding: 20px;
      background: #fffbeb;
      border-right: 4px solid #f59e0b;
      border-radius: 4px;
    }
    
    .notes h3 {
      color: #92400e;
      margin-bottom: 10px;
      font-size: 16px;
    }
    
    .notes p {
      color: #78350f;
      line-height: 1.6;
      font-size: 14px;
    }
    
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid #e2e8f0;
      text-align: center;
      color: #64748b;
      font-size: 12px;
    }
    
    .print-button {
      position: fixed;
      top: 20px;
      left: 20px;
      background: #2563eb;
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
      background: #1e40af;
    }
    
    @media print {
      body {
        padding: 0;
      }
      
      .print-button {
        display: none;
      }
      
      .container {
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <button class="print-button" onclick="window.print()">🖨️ הדפס</button>
  
  <div class="container">
    <div class="header">
      <div class="company-info">
        <div class="company-name">Amisra Shaltiel</div>
        <div class="company-details">
          מערכת ניהול התקנות גז<br>
          טלפון: 050-1234567<br>
          info@amisrashaltiel.co.il
        </div>
      </div>
      <div class="document-title">הצעת מחיר</div>
    </div>
    
    <div class="info-section">
      <div class="info-box">
        <h3>פרטי לקוח</h3>
        <p><span class="info-label">שם:</span> ${customer?.שם_לקוח || ''}</p>
        <p><span class="info-label">טלפון:</span> ${customer?.טלפון || ''}</p>
        ${customer?.אימייל ? `<p><span class="info-label">אימייל:</span> ${customer.אימייל}</p>` : ''}
        ${customer?.איש_קשר ? `<p><span class="info-label">איש קשר:</span> ${customer.איש_קשר}</p>` : ''}
        ${customer?.כתובת ? `<p><span class="info-label">כתובת:</span> ${customer.כתובת}</p>` : ''}
      </div>
      
      <div class="info-box">
        <h3>פרטי הצעה</h3>
        <p><span class="info-label">מספר הצעה:</span> ${quoteData.מספר_הצעה}</p>
        <p><span class="info-label">תאריך:</span> ${new Date(quoteData.תאריך_הצעה).toLocaleDateString('he-IL')}</p>
        ${quoteData.תוקף_עד ? `<p><span class="info-label">תוקף עד:</span> ${new Date(quoteData.תוקף_עד).toLocaleDateString('he-IL')}</p>` : ''}
        <p><span class="info-label">סטטוס:</span> ${quoteData.סטטוס}</p>
      </div>
    </div>
    
    <table>
      <thead>
        <tr>
          <th>תיאור</th>
          <th style="width: 80px;">כמות</th>
          <th style="width: 100px;">מחיר יחידה</th>
          <th style="width: 80px;">הנחה %</th>
          <th style="width: 120px;">סה"כ</th>
        </tr>
      </thead>
      <tbody>
        ${quoteLines.map(line => {
          const lineTotal = (line.כמות || 0) * (line.מחיר_יחידה || 0) * (1 - ((line.הנחה_אחוז || 0) / 100));
          return `
          <tr>
            <td>${line.תיאור}</td>
            <td>${line.כמות}</td>
            <td>₪${line.מחיר_יחידה?.toFixed(2)}</td>
            <td>${line.הנחה_אחוז || 0}%</td>
            <td><strong>₪${lineTotal.toFixed(2)}</strong></td>
          </tr>
        `;
        }).join('')}
      </tbody>
    </table>
    
    <div class="totals">
      <div class="totals-row subtotal">
        <span>סכום לפני מע"מ:</span>
        <span><strong>₪${subtotal.toFixed(2)}</strong></span>
      </div>
      <div class="totals-row vat">
        <span>מע"מ (18%):</span>
        <span><strong>₪${calculatedVat.toFixed(2)}</strong></span>
      </div>
      <div class="totals-row total">
        <span>סה"כ לתשלום:</span>
        <span>₪${calculatedTotal.toFixed(2)}</span>
      </div>
    </div>
    
    ${quoteData.הערות ? `
      <div class="notes">
        <h3>הערות</h3>
        <p>${quoteData.הערות}</p>
      </div>
    ` : ''}
    
    <div class="notes">
      <h3>תנאי תשלום</h3>
      <p>
        • תוקף ההצעה: 30 יום מתאריך הצעה זו<br>
        • תשלום: 50% מקדמה, יתרה בסיום העבודה<br>
        • המחירים כוללים מע"מ<br>
        • זמן אספקה: 7-14 ימי עסקים
      </p>
    </div>
    
    <div class="footer">
      <p>Amisra Shaltiel - מערכת ניהול התקנות גז | www.amisrashaltiel.co.il | 050-1234567</p>
      <p>הצעה זו נוצרה במערכת ממוחשבת ואינה דורשת חתימה</p>
    </div>
  </div>
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