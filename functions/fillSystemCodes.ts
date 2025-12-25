import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // קבלת כל החשבוניות
    const invoices = await base44.asServiceRole.entities.חשבונית.list();
    
    // סינון חשבוניות ללא קוד מערכת
    const invoicesWithoutCode = invoices.filter(inv => !inv.קוד_מערכת);
    
    if (invoicesWithoutCode.length === 0) {
      return Response.json({ 
        message: 'כל החשבוניות כבר מכילות קוד מערכת',
        updated: 0
      });
    }

    // מציאת הקוד הגבוה ביותר הקיים
    const existingCodes = invoices
      .map(inv => parseInt(inv.קוד_מערכת))
      .filter(num => !isNaN(num));
    
    let nextCode = 100000;
    if (existingCodes.length > 0) {
      nextCode = Math.max(...existingCodes) + 1;
    }

    // מיון החשבוניות לפי תאריך יצירה (מהישן לחדש)
    const sortedInvoices = invoicesWithoutCode.sort((a, b) => 
      new Date(a.created_date).getTime() - new Date(b.created_date).getTime()
    );

    // עדכון כל החשבוניות
    const updates = [];
    for (const invoice of sortedInvoices) {
      await base44.asServiceRole.entities.חשבונית.update(invoice.id, {
        קוד_מערכת: nextCode.toString()
      });
      updates.push({
        id: invoice.id,
        מספר_חשבונית: invoice.מספר_חשבונית,
        קוד_מערכת: nextCode.toString()
      });
      nextCode++;
    }

    return Response.json({ 
      message: `עודכנו ${updates.length} חשבוניות בהצלחה`,
      updated: updates.length,
      invoices: updates
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});