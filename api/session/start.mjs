import { randomUUID } from 'crypto';
import { db } from '../_lib/db.mjs';
import { addressFromRequest } from '../_lib/auth.mjs';
import { rateLimit, identify } from '../_lib/rateLimit.mjs';
import { json, unauthorized, methodNotAllowed } from '../_lib/http.mjs';
import { CORE_VERSION, SESSION_SECONDS } from '../../src/game-core/index.js';

/** How many sessions a wallet may start per day. Enforced here, not in the browser. */
export const MAX_SESSIONS_PER_DAY = 3;

/**
 * Open a session.
 *
 * The start time is set here rather than taken from the client, so a submitted
 * log cannot claim to have run longer than real time allows.
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

    const address = addressFromRequest(req);
    if (!address) return unauthorized(res);
    const wait = await rateLimit('start', identify(req, address));
    if (wait) {
        res.setHeader('Retry-After', String(wait));
        return json(res, 429, { error: 'rate-limited', retryAfter: wait });
    }


    const sql = db();
    const today = new Date().toISOString().slice(0, 10);

    const [tally] = await sql`
        insert into daily_sessions (address, day, started)
        values (${address}, ${today}, 1)
        on conflict (address, day)
        do update set started = daily_sessions.started + 1
        returning started
    `;

    if (tally.started > MAX_SESSIONS_PER_DAY) {
        // Put it back; a refused start should not consume an allowance.
        await sql`
            update daily_sessions set started = started - 1
            where address = ${address} and day = ${today}
        `;
        return json(res, 429, {
            error: 'daily-limit-reached',
            limit: MAX_SESSIONS_PER_DAY
        });
    }

    const id = randomUUID();
    const startedAt = new Date();

    await sql`
        insert into sessions (id, address, core_version, started_at)
        values (${id}, ${address}, ${CORE_VERSION}, ${startedAt.toISOString()})
    `;

    return json(res, 200, {
        sessionId: id,
        startedAt: startedAt.toISOString(),
        coreVersion: CORE_VERSION,
        sessionSeconds: SESSION_SECONDS,
        sessionsUsedToday: tally.started,
        sessionsPerDay: MAX_SESSIONS_PER_DAY
    });
}
