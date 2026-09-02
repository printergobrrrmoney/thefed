import { db } from '../_lib/db.mjs';
import { json, badRequest, methodNotAllowed } from '../_lib/http.mjs';
import {
    SCHEDULE_DAYS,
    BASE_DAILY_CAP,
    LIFETIME_WALLET_CAP,
    earlyMultiplier,
    dailyCapFor,
    pointsFor,
    dayOfSchedule
} from '../../src/economics/index.js';

/**
 * What one wallet has actually done, and what the rules say that is worth.
 *
 * This is deliberately public and unauthenticated. Every figure it returns is
 * derived from scores that are already on the leaderboard, so requiring a
 * signature would protect nothing and would stop a player checking a wallet
 * they cannot sign for right now.
 *
 * It reports points, never a token balance. Nothing has been allocated, and a
 * page that showed a confident "you are owed N" before the distributor exists
 * would be inventing a debt.
 */

const SCHEDULE_START = process.env.SCHEDULE_START || null;

/** Base58 has no 0, O, I or l. Length is the usual 32-44 for an ed25519 key. */
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        return res.status(204).send('');
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return methodNotAllowed(res, ['GET', 'HEAD', 'OPTIONS']);
    }

    const address = (req.query && req.query.address) || '';
    if (!ADDRESS.test(address)) return badRequest(res, 'bad-address');

    const day = SCHEDULE_START ? dayOfSchedule(SCHEDULE_START) : null;
    const live = day !== null && day >= 1 && day <= SCHEDULE_DAYS;
    const scheduleDay = live ? day : 1;

    const sql = db();

    const [player] = await sql`
        select address, display_name, created_at
        from players
        where address = ${address}
    `;

    // Allocation is worked out per day, so the daily grouping is the shape that
    // matters — a career total would not survive contact with the caps.
    const days = await sql`
        select
            (started_at at time zone 'utc')::date as day,
            max(score) as best,
            sum(score) as total,
            count(*) as runs
        from sessions
        where address = ${address}
          and rejected = false
          and score is not null
        group by 1
        order by 1 desc
        limit 30
    `;

    const [totals] = await sql`
        select
            coalesce(max(score), 0) as best,
            count(*) filter (where score is not null and rejected = false) as scored,
            count(*) as attempted
        from sessions
        where address = ${address}
    `;

    const capToday = dailyCapFor(scheduleDay, 0);

    return json(res, 200, {
        address,
        found: Boolean(player),
        displayName: player ? player.display_name : null,
        playingSince: player ? player.created_at : null,

        bestScore: totals ? Number(totals.best) : 0,
        scoredSessions: totals ? Number(totals.scored) : 0,
        attemptedSessions: totals ? Number(totals.attempted) : 0,

        days: days.map((row) => ({
            day: row.day,
            best: Number(row.best),
            total: Number(row.total),
            runs: Number(row.runs),
            // Scores grow exponentially, so this is what actually gets weighed.
            points: pointsFor(Number(row.total))
        })),

        // The rules as they stand today, so the page can show the ceiling a
        // wallet is playing against rather than restating it from memory.
        scheduleDay: live ? day : null,
        earlyMultiplier: earlyMultiplier(scheduleDay),
        baseDailyCap: BASE_DAILY_CAP,
        capToday,
        lifetimeWalletCap: LIFETIME_WALLET_CAP,

        // The honest part.
        live,
        claimable: 0,
        note: live
            ? 'Allocation runs daily. Points earn a share of that day, up to your cap.'
            : 'Nothing is claimable yet — the distribution schedule has not started. Runs recorded now still count when it does.'
    });
}
