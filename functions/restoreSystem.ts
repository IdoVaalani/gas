import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { backupData, phase, entityName } = await req.json();

    if (!backupData || !backupData.data === undefined) {
      return Response.json({ error: 'Invalid backup file' }, { status: 400 });
    }

    // Phase: delete one entity - sequentially with delay
    if (phase === 'delete') {
      let deletedCount = 0;
      let hasMore = true;
      let page = 0;

      while (hasMore && page < 100) {
        let records;
        try {
          records = await base44.asServiceRole.entities[entityName].list('created_date', 50);
        } catch (e) {
          await sleep(1000);
          records = await base44.asServiceRole.entities[entityName].list('created_date', 50);
        }

        if (!records || records.length === 0) break;

        // Delete one by one with small delay to avoid rate limit
        for (const record of records) {
          try {
            await base44.asServiceRole.entities[entityName].delete(record.id);
            deletedCount++;
          } catch (e) {
            // If rate limited, wait and retry
            if (e.message && e.message.includes('Rate limit')) {
              await sleep(500);
              try {
                await base44.asServiceRole.entities[entityName].delete(record.id);
                deletedCount++;
              } catch (_) {}
            }
          }
          await sleep(50); // 50ms between each delete
        }

        if (records.length < 50) hasMore = false;
        page++;
      }

      return Response.json({ success: true, deleted: deletedCount });
    }

    // Phase: restore one entity - sequentially with delay
    if (phase === 'restore') {
      if (!backupData.data) {
        return Response.json({ error: 'No data in backup' }, { status: 400 });
      }
      const records = backupData.data[entityName] || [];
      let restoredCount = 0;
      const errors = [];

      for (const record of records) {
        const { created_date, updated_date, created_by, ...recordData } = record;
        try {
          await base44.asServiceRole.entities[entityName].create({ id: record.id, ...recordData });
          restoredCount++;
        } catch (e) {
          if (e.message && e.message.includes('Rate limit')) {
            await sleep(500);
            try {
              await base44.asServiceRole.entities[entityName].create({ id: record.id, ...recordData });
              restoredCount++;
            } catch (e2) {
              errors.push(e2.message);
            }
          } else {
            errors.push(e.message);
          }
        }
        await sleep(50); // 50ms between each create
      }

      return Response.json({ success: true, restored: restoredCount, errors });
    }

    return Response.json({ error: 'Unknown phase' }, { status: 400 });

  } catch (error) {
    console.error('Restore error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});