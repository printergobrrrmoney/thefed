import { db } from '../_lib/db.mjs';
import { addressFromRequest } from '../_lib/auth.mjs';
import { rateLimit, identify } from '../_lib/rateLimit.mjs';
import { json, badRequest, unauthorized, methodNotAllowed, readBody } from '../_lib/http.mjs';
import { verifyLog } from '../../src/game-core/index.js';

/**
 * Submit a replay log and get back the score the server computed from it.
 *
 * Nothing the client says about its score is read. The log is replayed through
 * the same rules the browser ran, and the result of that replay is the only
 * score stored. The raw log is kept so a disputed payout can be re-run.
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

    const address = addressFromRequest(req);
    if (!address) return unauthorized(res);
    const wait = await rateLimit('submit', identify(req, address));
    if (wait) {
        res.setHeader('Retry-After', String(wait));
        return json(res, 429, { error: 'rate-limited', retryAfter: wait });
    }


    const { sessionId, log } = readBody(req);
    if (!sessionId || !log) return badRequest(res, 'missing-log');

    const sql = db();
    const [session] = await sql`
        select id, address, started_at, submitted_at
        from sessions where id = ${sessionId}
    `;

    if (!session) return badRequest(res, 'unknown-session');
    if (session.address !== address) return unauthorized(res, 'not-your-session');
    if (session.submitted_at) return badRequest(res, 'already-submitted');

    // The server's own timings, not the client's claims about them.
    const result = verifyLog({
        ...log,
        startedAt: new Date(session.started_at).getTime(),
        submittedAt: Date.now()
    });

    await sql`
        update sessions set
            submitted_at = now(),
            score = ${result.ok ? result.score : 0},
            ticks = ${result.ok ? result.ticks : 0},
            ended_reason = ${result.endedReason || null},
            rejected = ${!result.ok},
            problems = ${result.problems},
            log = ${JSON.stringify(log)}
        where id = ${sessionId}
    `;

    if (!result.ok) {
        return json(res, 422, { accepted: false, problems: result.problems });
    }

    const [best] = await sql`
        select coalesce(max(score), 0) as best
        from sessions where address = ${address} and rejected = false
    `;

    return json(res, 200, {
        accepted: true,
        score: result.score,
        ticks: result.ticks,
        endedReason: result.endedReason,
        best: Number(best.best)
    });
}
