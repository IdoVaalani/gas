import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

    const restoreOrder = [
      'פריט',
      'טכנאי',
      'לקוח',
      'אתר',
      'הזמנת_עבודה',
      'הצעת_מחיר',
      'שורת_הצעה',
      'חשבונית',
      'שורת_חשבונית',
      'תשלום_חשבונית',
      'מסמך_חשבונית'
    ];

    const results = { deleted: {}, restored: {}, errors: [] };

    // שלב 1: מחיקת נתונים קיימים - מחיקה מקבילה לכל entity
    console.log('Step 1: Deleting existing data...');
    for (const entityName of [...restoreOrder].reverse()) {
      try {
        let page = 0;
        let hasMore = true;
        let deletedCount = 0;

        while (hasMore) {
          const existingRecords = await base44.asServiceRole.entities[entityName].list('created_date', 100);
          if (existingRecords.length === 0) {
            hasMore = false;
            break;
          }

          // מחיקה מקבילה
          await Promise.allSettled(
            existingRecords.map(record =>
              base44.asServiceRole.entities[entityName].delete(record.id)
            )
          );
          deletedCount += existingRecords.length;

          if (existingRecords.length < 100) hasMore = false;
          page++;
          if (page > 50) break; // safety
        }

        results.deleted[entityName] = deletedCount;
        console.log(`Deleted ${deletedCount} from ${entityName}`);
      } catch (error) {
        console.error(`Error deleting from ${entityName}:`, error);
        results.errors.push(`Delete ${entityName}: ${error.message}`);
      }
    }

    // שלב 2: שחזור הנתונים - יצירה מקבילה בקבוצות
    console.log('Step 2: Restoring data from backup...');
    const BATCH_SIZE = 20;

    for (const entityName of restoreOrder) {
      try {
        const records = backupData.data[entityName] || [];
        console.log(`Restoring ${records.length} records to ${entityName}`);

        let restoredCount = 0;

        for (let i = 0; i < records.length; i += BATCH_SIZE) {
          const batch = records.slice(i, i + BATCH_SIZE);

          const batchResults = await Promise.allSettled(
            batch.map(record => {
              const { created_date, updated_date, created_by, ...recordData } = record;
              return base44.asServiceRole.entities[entityName].create({
                id: record.id,
                ...recordData
              });
            })
          );

          const succeeded = batchResults.filter(r => r.status === 'fulfilled').length;
          const failed = batchResults.filter(r => r.status === 'rejected');
          restoredCount += succeeded;

          failed.forEach(f => {
            results.errors.push(`Create in ${entityName}: ${f.reason?.message || f.reason}`);
          });
        }

        results.restored[entityName] = restoredCount;
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