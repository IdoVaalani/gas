import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { phase, entityName, records } = await req.json();

    if (phase !== 'restore') {
      return Response.json({ error: 'Unknown phase' }, { status: 400 });
    }

    if (!entityName || !Array.isArray(records)) {
      return Response.json({ error: 'Missing entityName or records' }, { status: 400 });
    }

    let restoredCount = 0;
    const errors = [];

    for (const record of records) {
      const { id, created_date, updated_date, created_by, ...recordData } = record;

      let success = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          // Try update first
          await base44.asServiceRole.entities[entityName].update(id, recordData);
          restoredCount++;
          success = true;
          break;
        } catch (e) {
          if (e.message && (e.message.includes('not found') || e.message.includes('404'))) {
            // Record doesn't exist → create
            try {
              await base44.asServiceRole.entities[entityName].create({ id, ...recordData });
              restoredCount++;
              success = true;
            } catch (e2) {
              errors.push(`${id}: ${e2.message}`);
            }
            break;
          } else if (e.message && e.message.includes('Rate limit')) {
            await sleep(700);
          } else {
            errors.push(`${id}: ${e.message}`);
            break;
          }
        }
      }

      await sleep(30);
    }

    return Response.json({ success: true, restored: restoredCount, errors });

  } catch (error) {
    console.error('Restore error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});