import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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
      const { created_date, updated_date, created_by_id, ...recordData } = record;

      if (!recordData.id) {
        errors.push(`record missing id, skipping`);
        continue;
      }

      let success = false;

      // Step 1: try update (record already exists)
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const { id, ...updateData } = recordData;
          await base44.asServiceRole.entities[entityName].update(id, updateData);
          restoredCount++;
          success = true;
          break;
        } catch (e) {
          const msg = e.message || '';
          if (msg.includes('not found') || msg.includes('404') || msg.includes('does not exist') || msg.includes('No record')) {
            // Record doesn't exist → create it with original id
            try {
              await base44.asServiceRole.entities[entityName].create(recordData);
              restoredCount++;
              success = true;
            } catch (e2) {
              errors.push(`${recordData.id}: create failed: ${e2.message}`);
            }
            break;
          } else if (msg.includes('Rate limit') || msg.includes('429')) {
            await sleep(1000);
          } else {
            errors.push(`${recordData.id}: update failed: ${msg}`);
            break;
          }
        }
      }

      await sleep(20);
    }

    console.log(`Restored ${restoredCount}/${records.length} records for ${entityName}. Errors: ${errors.length}`);

    return Response.json({ success: true, restored: restoredCount, errors });

  } catch (error) {
    console.error('Restore error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});