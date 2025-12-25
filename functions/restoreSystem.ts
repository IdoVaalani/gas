import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { backupData } = await req.json();

    if (!backupData || !backupData.data) {
      return Response.json({ error: 'Invalid backup file' }, { status: 400 });
    }

    console.log('Starting system restore...');
    console.log(`Backup from: ${backupData.metadata.timestamp}`);
    console.log(`Total records to restore: ${backupData.metadata.totalRecords}`);

    // רשימת entities בסדר הנכון (כדי לשמור על dependencies)
    const restoreOrder = [
      'פריט',           // ראשון - אין תלויות
      'טכנאי',          // ראשון - אין תלויות
      'לקוח',           // ראשון - אין תלויות
      'אתר',            // תלוי בלקוח
      'הזמנת_עבודה',    // תלוי בלקוח, אתר, טכנאי
      'הצעת_מחיר',      // תלוי בלקוח
      'שורת_הצעה',      // תלוי בהצעת_מחיר, פריט
      'חשבונית',        // תלוי בלקוח, טכנאי
      'שורת_חשבונית',   // תלוי בחשבונית, פריט
      'תשלום_חשבונית',  // תלוי בחשבונית
      'מסמך_חשבונית'    // תלוי בחשבונית
    ];

    const results = {
      deleted: {},
      restored: {},
      errors: []
    };

    // שלב 1: מחיקת כל הנתונים הקיימים (בסדר הפוך)
    console.log('Step 1: Deleting existing data...');
    for (const entityName of [...restoreOrder].reverse()) {
      try {
        const existingRecords = await base44.asServiceRole.entities[entityName].list();
        console.log(`Deleting ${existingRecords.length} records from ${entityName}`);
        
        for (const record of existingRecords) {
          try {
            await base44.asServiceRole.entities[entityName].delete(record.id);
          } catch (deleteError) {
            console.error(`Error deleting record ${record.id} from ${entityName}:`, deleteError);
          }
        }
        
        results.deleted[entityName] = existingRecords.length;
      } catch (error) {
        console.error(`Error deleting from ${entityName}:`, error);
        results.errors.push(`Delete ${entityName}: ${error.message}`);
      }
    }

    // שלב 2: שחזור הנתונים מהגיבוי
    console.log('Step 2: Restoring data from backup...');
    for (const entityName of restoreOrder) {
      try {
        const records = backupData.data[entityName] || [];
        console.log(`Restoring ${records.length} records to ${entityName}`);
        
        if (records.length > 0) {
          // שחזור רשומה רשומה (כדי לשמור על IDs מקוריים)
          let restoredCount = 0;
          for (const record of records) {
            try {
              // הסרת שדות built-in שלא צריך לשחזר
              const { created_date, updated_date, ...recordData } = record;
              
              await base44.asServiceRole.entities[entityName].create({
                id: record.id,  // שמירה על ה-ID המקורי
                ...recordData
              });
              restoredCount++;
            } catch (createError) {
              console.error(`Error creating record in ${entityName}:`, createError);
              results.errors.push(`Create in ${entityName}: ${createError.message}`);
            }
          }
          results.restored[entityName] = restoredCount;
        } else {
          results.restored[entityName] = 0;
        }
      } catch (error) {
        console.error(`Error restoring ${entityName}:`, error);
        results.errors.push(`Restore ${entityName}: ${error.message}`);
        results.restored[entityName] = 0;
      }
    }

    const totalRestored = Object.values(results.restored).reduce((sum, count) => sum + count, 0);
    console.log(`Restore completed. Total records restored: ${totalRestored}`);

    return Response.json({
      success: true,
      message: `שוחזרו ${totalRestored} רשומות בהצלחה`,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Restore error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});