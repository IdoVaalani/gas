import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const items = await base44.asServiceRole.entities['\u05e4\u05e8\u05d9\u05d8'].list();
    let updated = 0;

    for (const item of items) {
        const price = item.מחיר_מכירה;
        if (price !== null && price !== undefined) {
            const rounded = Math.round(price * 100) / 100;
            if (rounded !== price) {
                await base44.asServiceRole.entities.פריט.update(item.id, { מחיר_מכירה: rounded });
                updated++;
            }
        }
    }

    return Response.json({ success: true, total: items.length, updated });
});