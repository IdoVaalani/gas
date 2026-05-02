import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting full system backup...');

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
        version: '2.0',
        createdBy: user.email,
        totalRecords: 0,
        entityCounts: {}
      },
      data: {}
    };

    for (const entityName of entitiesToBackup) {
      try {
        console.log(`Fetching all records from ${entityName}...`);
        // Use a very large limit to get ALL records in one call
        const records = await base44.asServiceRole.entities[entityName].list('-created_date', 9999);
        backupData.data[entityName] = records || [];
        backupData.metadata.totalRecords += (records || []).length;
        backupData.metadata.entityCounts[entityName] = (records || []).length;
        console.log(`Backed up ${(records || []).length} records from ${entityName}`);
      } catch (error) {
        console.error(`Error backing up ${entityName}:`, error.message);
        backupData.data[entityName] = [];
        backupData.metadata.entityCounts[entityName] = 0;
      }
    }

    console.log(`Backup completed. Total records: ${backupData.metadata.totalRecords}`);

    return Response.json(backupData, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Backup error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});