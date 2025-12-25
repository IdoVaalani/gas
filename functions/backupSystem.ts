import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting system backup...');

    // רשימת כל ה-entities לגיבוי
    const entitiesToBackup = [
      'לקוח',
      'אתר',
      'טכנאי',
      'הזמנת_עבודה',
      'הצעת_מחיר',
      'שורת_הצעה',
      'חשבונית',
      'שורת_חשבונית',
      'פריט',
      'תשלום_חשבונית',
      'מסמך_חשבונית'
    ];

    const backupData = {
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0',
        createdBy: user.email,
        totalRecords: 0
      },
      data: {}
    };

    // גיבוי כל entity
    for (const entityName of entitiesToBackup) {
      try {
        const records = await base44.asServiceRole.entities[entityName].list();
        backupData.data[entityName] = records;
        backupData.metadata.totalRecords += records.length;
        console.log(`Backed up ${records.length} records from ${entityName}`);
      } catch (error) {
        console.error(`Error backing up ${entityName}:`, error);
        backupData.data[entityName] = [];
      }
    }

    console.log(`Backup completed. Total records: ${backupData.metadata.totalRecords}`);

    return Response.json(backupData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Backup error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});