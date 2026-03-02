import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { backupData, phase, entityName } = await req.json();

    if (!backupData || !backupData.data) {
      return Response.json({ error: 'Invalid backup file' }, { status: 400 });
    }

    const restoreOrder = [
      'פריט', 'טכנאי', 'לקוח', 'אתר', 'הזמנת_עבודה',
      'הצעת_מחיר', 'שורת_הצעה', 'חשבונית', 'שורת_חשבונית',
      'תשלום_חשבונית', 'מסמך_חשבונית'
    ];

    // Phase: delete one entity
    if (phase === 'delete') {
      let deletedCount = 0;
      let hasMore = true;
      let page = 0;

      while (hasMore && page < 100) {
        const records = await base44.asServiceRole.entities[entityName].list('created_date', 100);
        if (records.length === 0) { hasMore = false; break; }

        await Promise.allSettled(records.map(r => base44.asServiceRole.entities[entityName].delete(r.id)));
        deletedCount += records.length;

        if (records.length < 100) hasMore = false;
        page++;
      }

      return Response.json({ success: true, deleted: deletedCount });
    }

    // Phase: restore one entity
    if (phase === 'restore') {
      const records = backupData.data[entityName] || [];
      const BATCH_SIZE = 10;
      let restoredCount = 0;
      const errors = [];

      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(record => {
            const { created_date, updated_date, created_by, ...recordData } = record;
            return base44.asServiceRole.entities[entityName].create({ id: record.id, ...recordData });
          })
        );
        restoredCount += results.filter(r => r.status === 'fulfilled').length;
        results.filter(r => r.status === 'rejected').forEach(f => {
          errors.push(f.reason?.message || String(f.reason));
        });
      }

      return Response.json({ success: true, restored: restoredCount, errors });
    }

    // No phase - full restore (fallback, may timeout on large datasets)
    const results = { deleted: {}, restored: {}, errors: [] };

    for (const entity of [...restoreOrder].reverse()) {
      let hasMore = true, page = 0, deleted = 0;
      while (hasMore && page < 50) {
        const recs = await base44.asServiceRole.entities[entity].list('created_date', 100);
        if (!recs.length) break;
        await Promise.allSettled(recs.map(r => base44.asServiceRole.entities[entity].delete(r.id)));
        deleted += recs.length;
        if (recs.length < 100) hasMore = false;
        page++;
      }
      results.deleted[entity] = deleted;
    }

    for (const entity of restoreOrder) {
      const records = backupData.data[entity] || [];
      let count = 0;
      for (let i = 0; i < records.length; i += 10) {
        const batch = records.slice(i, i + 10);
        const res = await Promise.allSettled(batch.map(record => {
          const { created_date, updated_date, created_by, ...data } = record;
          return base44.asServiceRole.entities[entity].create({ id: record.id, ...data });
        }));
        count += res.filter(r => r.status === 'fulfilled').length;
      }
      results.restored[entity] = count;
    }

    const total = Object.values(results.restored).reduce((s, c) => s + c, 0);
    return Response.json({ success: true, message: `שוחזרו ${total} רשומות`, results });

  } catch (error) {
    console.error('Restore error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});