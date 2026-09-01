import { db } from './_lib/db.mjs';
import { json, methodNotAllowed } from './_lib/http.mjs';

/**
 * Best verified score per player. Only sessions that survived replay count, so
 * this is a table of what the server recomputed, not what any client reported.
 *
 * The address always comes back alongside the name, because names are not
 * unique — the address is what actually identifies a player.
 */
export default async function handler(req, res) {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

    const limit = Math.min(Number(req.query && req.query.limit) || 50, 200);
    const sql = db();

    const rows = await sql`
        select
            s.address,
            p.display_name,
            max(s.score) as score,
            count(*) as sessions
        from sessions s
        join players p on p.address = s.address
        where s.rejected = false and s.score is not null
        group by s.address, p.display_name
        order by score desc
        limit ${limit}
    `;

    return json(res, 200, {
        entries: rows.map((row, index) => ({
            rank: index + 1,
            address: row.address,
            displayName: row.display_name,
            score: Number(row.score),
            sessions: Number(row.sessions)
        }))
    });
}
