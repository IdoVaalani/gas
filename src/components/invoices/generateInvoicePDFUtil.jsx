import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { format } from "date-fns";

export async function generateInvoicePDF({ invoice, customers, technicians, invoiceLines }) {
  if (!invoice) return;

  const customer = customers.find(c => c.id === invoice.לקוח_id);
  const technician = technicians.find(t => t.id === invoice.טכנאי_id);

  const allLines = invoiceLines.filter(l => l.חשבונית_id === invoice.id);
  const workLines = allLines.filter(l => l.סוג_שורה === 'עבודה').sort((a, b) => {
    if ((a.מיון_שורות || 1) !== (b.מיון_שורות || 1)) return (a.מיון_שורות || 1) - (b.מיון_שורות || 1);
    return new Date(a.created_date).getTime() - new Date(b.created_date).getTime();
  });
  const itemLines = allLines.filter(l => l.סוג_שורה === 'פריט').sort((a, b) => {
    if ((a.מיון_שורות || 1) !== (b.מיון_שורות || 1)) return (a.מיון_שורות || 1) - (b.מיון_שורות || 1);
    return new Date(a.created_date).getTime() - new Date(b.created_date).getTime();
  });

  let laborSubtotal = 0;
  workLines.forEach(line => {
    laborSubtotal += (line.כמות || 0) * (line.מחיר_יחידה || 0) * (1 - ((line.הנחה_אחוז || 0) / 100));
  });

  let itemsSubtotal = 0;
  itemLines.forEach(line => {
    itemsSubtotal += (line.כמות || 0) * (line.מחיר_יחידה || 0) * (1 - ((line.הנחה_אחוז || 0) / 100));
  });

  const laborVat = laborSubtotal * 0.18;
  const laborTotal = laborSubtotal + laborVat;
  const itemsVat = itemsSubtotal * 0.18;
  const invoiceDate = format(new Date(invoice.תאריך), 'dd/MM/yyyy');

  // --- Page 1: Work lines ---
  const container = document.createElement('div');
  container.style.cssText = 'position:absolute;right:-9999px;width:210mm;background:white;direction:rtl;';
  document.body.appendChild(container);

  container.innerHTML = `
    <div style="font-family: Arial, sans-serif; padding: 15px; background: white; color: #000; direction: rtl;">
      <div style="max-width: 900px; margin: 0 auto; background: white; padding: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px; font-size: 12px;">
          <div style="border: 2px solid #000; padding: 5px 8px; text-align: center; line-height: 1.3; width: 160px;">
            <div>טכנאי גז רמת 2</div>
            <div>מס' ההסמכה ${technician?.מספר_הסמכה || '1254'}</div>
          </div>
          <div style="font-size: 16px; font-weight: bold; padding-top: 20px;">העתק</div>
          <div style="border: 2px solid #000; padding: 5px 8px; text-align: center; line-height: 1.3; width: 160px;">
            <div>עוסק מורשה למע"מ</div>
            <div>מס' 056510639</div>
          </div>
        </div>
        <div style="text-align: center; margin-bottom: 10px;">
          <div style="font-size: 36px; font-weight: bold; color: #ff0000; letter-spacing: 2px; margin-bottom: 3px;">בן שלום שאלתיאל</div>
          <div style="font-size: 16px; color: #ff0000; margin-bottom: 6px;">טכנאי גז ותיקונים</div>
        </div>
        <div style="border: 2px solid #000; padding: 5px; text-align: center; font-size: 12px; margin-bottom: 12px;">
          רח' לוז 31 נחלת יהודה ראשון לציון טל. 054-7252776
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="font-size: 14px;">${invoiceDate}</div>
          <div style="font-size: 20px; font-weight: bold;">חשבון מספר ${invoice.מספר_חשבונית || '0'}</div>
        </div>
        <div style="margin-bottom: 12px; border-bottom: 2px solid #000; padding-bottom: 6px;">
          <div style="display: flex; border-bottom: 2px solid #000; padding: 3px 0; font-size: 13px;">
            <span style="font-weight: bold; margin-left: 10px; min-width: 70px;">לכבוד</span>
            <span>אמישרא גז</span>
          </div>
          <div style="display: flex; padding: 3px 0; font-size: 13px;">
            <span style="font-weight: bold; margin-left: 10px; min-width: 70px;">כתובת:</span>
            <span>אחד העם 34 תל אביב</span>
          </div>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin: 12px 0; border: 2px solid #000;">
          <thead>
            <tr>
              <th style="border: 2px solid #000; padding: 5px 6px; text-align: center; font-size: 12px; background: #fff; font-weight: bold; width: 10%;">כמות</th>
              <th style="border: 2px solid #000; padding: 5px 6px; text-align: center; font-size: 12px; background: #fff; font-weight: bold; width: 60%;">פריטים</th>
              <th style="border: 2px solid #000; padding: 5px 6px; text-align: center; font-size: 12px; background: #fff; font-weight: bold; width: 15%;">מחיר יח'</th>
              <th style="border: 2px solid #000; padding: 5px 6px; text-align: center; font-size: 12px; background: #fff; font-weight: bold; width: 15%;">סה"כ</th>
            </tr>
          </thead>
          <tbody>
            ${workLines.map(line => {
              const lt = (line.כמות || 0) * (line.מחיר_יחידה || 0) * (1 - ((line.הנחה_אחוז || 0) / 100));
              return `<tr>
                <td style="border: 2px solid #000; padding: 4px 6px; text-align: center; font-size: 12px;">${line.כמות || ''}</td>
                <td style="border: 2px solid #000; padding: 4px 6px; text-align: right; padding-right: 10px; font-size: 12px;">${line.תיאור}</td>
                <td style="border: 2px solid #000; padding: 4px 6px; text-align: center; font-size: 12px;">${line.מחיר_יחידה?.toFixed(2) || '0.00'}</td>
                <td style="border: 2px solid #000; padding: 4px 6px; text-align: center; font-size: 12px;">${lt.toFixed(2)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: start;">
          <div style="text-align: right; font-size: 14px; line-height: 1.8;">
            <div>מרכזייה\\צרכן${customer?.שם_לקוח ? `: ${customer.שם_לקוח}` : ''}</div>
            ${customer?.כתובת ? `<div>כתובת: ${customer.כתובת}</div>` : ''}
            ${invoice.מספר_דוח ? `<div>מספר עבודה: ${invoice.מספר_דוח}</div>` : ''}
            ${invoice.מספר_493 ? `<div>493: ${invoice.מספר_493}</div>` : ''}
            ${itemsSubtotal > 0 ? `<div>סה"כ חומר: ₪${itemsSubtotal.toFixed(2)}</div>` : ''}
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: ${itemsSubtotal > 0 ? '5px' : '10px'};">
              ${invoice.קוד_מערכת ? `<div style="font-weight: bold; color: #666;">קוד מערכת: ${invoice.קוד_מערכת}</div>` : '<div></div>'}
              <div style="text-align: left; margin-right: 20px;">חתימת העוסק המורשה: _________________</div>
            </div>
          </div>
          <table style="width: 350px; border: 2px solid #000; border-collapse: collapse;">
            <tr>
              <td style="border: 2px solid #000; padding: 8px 12px; font-size: 14px; text-align: right;">סה"כ</td>
              <td style="border: 2px solid #000; padding: 8px 12px; font-size: 14px; text-align: center; font-weight: bold;">₪${laborSubtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="border: 2px solid #000; padding: 8px 12px; font-size: 14px; text-align: right;">מע"מ בשיעור 18%</td>
              <td style="border: 2px solid #000; padding: 8px 12px; font-size: 14px; text-align: center; font-weight: bold;">₪${laborVat.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="border: 2px solid #000; padding: 8px 12px; font-size: 14px; text-align: right;">סכום כולל מע"מ</td>
              <td style="border: 2px solid #000; padding: 8px 12px; font-size: 14px; text-align: center; font-weight: bold;">₪${laborTotal.toFixed(2)}</td>
            </tr>
          </table>
        </div>
      </div>
    </div>
  `;

  const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: container.scrollWidth + 100, windowHeight: container.scrollHeight + 100, x: -20, y: -20 });
  document.body.removeChild(container);

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth() - 20;
  const pdfHeight = pdf.internal.pageSize.getHeight() - 20;
  const imgWidth = pdfWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 10;
  pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
  heightLeft -= pdfHeight;
  while (heightLeft > 0) {
    position = heightLeft - imgHeight + 10;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;
  }
  pdf.save(`חשבון-${invoice.מספר_חשבונית || invoice.קוד_מערכת}.pdf`);

  // --- Page 2: Item lines (if any) ---
  if (itemLines.length > 0) {
    const container2 = document.createElement('div');
    container2.style.cssText = 'position:absolute;right:-9999px;width:210mm;background:white;direction:rtl;';
    document.body.appendChild(container2);

    container2.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 15px; background: white; color: #000; direction: rtl;">
        <div style="max-width: 900px; margin: 0 auto; background: white; padding: 10px;">
          <div style="text-align: center; margin-bottom: 10px;">
            <div style="font-size: 36px; font-weight: bold; color: #ff0000; letter-spacing: 2px; margin-bottom: 3px;">בן שלום שאלתיאל</div>
            <div style="font-size: 16px; color: #ff0000; margin-bottom: 6px;">טכנאי גז ותיקונים</div>
          </div>
          <div style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 12px; border-bottom: 2px solid #000; padding-bottom: 8px;">
            דוח חומרים - חשבון ${invoice.מספר_חשבונית || invoice.קוד_מערכת} | ${invoiceDate}
          </div>
          <div style="margin-bottom: 10px; font-size: 13px;">
            לקוח: ${customer?.שם_לקוח || ''}
            ${invoice.מספר_דוח ? ` | הוראת עבודה: ${invoice.מספר_דוח}` : ''}
          </div>
          <table style="width: 100%; border-collapse: collapse; margin: 12px 0; border: 2px solid #000;">
            <thead>
              <tr>
                <th style="border: 2px solid #000; padding: 5px 6px; text-align: center; font-size: 12px; font-weight: bold; width: 10%;">כמות</th>
                <th style="border: 2px solid #000; padding: 5px 6px; text-align: center; font-size: 12px; font-weight: bold; width: 55%;">פריט</th>
                <th style="border: 2px solid #000; padding: 5px 6px; text-align: center; font-size: 12px; font-weight: bold; width: 15%;">מחיר יח'</th>
                <th style="border: 2px solid #000; padding: 5px 6px; text-align: center; font-size: 12px; font-weight: bold; width: 20%;">סה"כ</th>
              </tr>
            </thead>
            <tbody>
              ${itemLines.map(line => {
                const lt = (line.כמות || 0) * (line.מחיר_יחידה || 0) * (1 - ((line.הנחה_אחוז || 0) / 100));
                return `<tr>
                  <td style="border: 2px solid #000; padding: 4px 6px; text-align: center; font-size: 12px;">${line.כמות || ''}</td>
                  <td style="border: 2px solid #000; padding: 4px 6px; text-align: right; padding-right: 10px; font-size: 12px;">${line.תיאור}</td>
                  <td style="border: 2px solid #000; padding: 4px 6px; text-align: center; font-size: 12px;">${line.מחיר_יחידה?.toFixed(2) || '0.00'}</td>
                  <td style="border: 2px solid #000; padding: 4px 6px; text-align: center; font-size: 12px;">${lt.toFixed(2)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
          <div style="margin-top: 12px; font-size: 14px; border-top: 2px solid #000; padding-top: 8px; text-align: left;">
            <div>סה"כ חומרים (לפני מע"מ): ₪${itemsSubtotal.toFixed(2)}</div>
            <div style="font-weight: bold;">מע"מ 18%: ₪${itemsVat.toFixed(2)}</div>
            <div style="font-weight: bold; font-size: 16px;">סה"כ כולל מע"מ: ₪${(itemsSubtotal + itemsVat).toFixed(2)}</div>
          </div>
        </div>
      </div>
    `;

    const canvas2 = await html2canvas(container2, { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: container2.scrollWidth + 100, windowHeight: container2.scrollHeight + 100, x: -20, y: -20 });
    document.body.removeChild(container2);

    const imgData2 = canvas2.toDataURL('image/png');
    const pdf2 = new jsPDF('p', 'mm', 'a4');
    const pdfWidth2 = pdf2.internal.pageSize.getWidth() - 20;
    const imgWidth2 = pdfWidth2;
    const imgHeight2 = (canvas2.height * imgWidth2) / canvas2.width;
    pdf2.addImage(imgData2, 'PNG', 10, 10, imgWidth2, imgHeight2);
    pdf2.save(`חשבון-${invoice.מספר_חשבונית || invoice.קוד_מערכט}-חומרים.pdf`);
  }
}