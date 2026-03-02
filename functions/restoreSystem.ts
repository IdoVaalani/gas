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

    if (!backupData) {
      return Response.json({ error: 'Invalid backup file' }, { status: 400 });
    }

    // Phase: restore one entity using update (upsert) - no delete needed
    if (phase === 'restore') {
      const records = (backupData.data || {})[entityName] || [];
      let restoredCount = 0;
      const errors = [];

      for (const record of records) {
        const { created_date, updated_date, created_by, id, ...recordData } = record;
        let success = false;

        // Try update first, then create
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await base44.asServiceRole.entities[entityName].update(id, recordData);
            restoredCount++;
            success = true;
            break;
          } catch (e) {
            if (e.message && e.message.includes('not found')) {
              // Record doesn't exist, create it
              try {
                await base44.asServiceRole.entities[entityName].create({ id, ...recordData });
                restoredCount++;
                success = true;
                break;
              } catch (e2) {
                if (e2.message && e2.message.includes('Rate limit')) {
                  await sleep(600);
                } else {
                  errors.push(`${entityName}/${id}: ${e2.message}`);
                  break;
                }
              }
            } else if (e.message && e.message.includes('Rate limit')) {
              await sleep(600);
            } else {
              errors.push(`${entityName}/${id}: ${e.message}`);
              break;
            }
          }
        }

        if (!success && !errors.find(er => er.startsWith(`${entityName}/${id}`))) {
          errors.push(`${entityName}/${id}: failed after retries`);
        }

        await sleep(60);
      }

      return Response.json({ success: true, restored: restoredCount, errors });
    }

    return Response.json({ error: 'Unknown phase' }, { status: 400 });

  } catch (error) {
    console.error('Restore error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});