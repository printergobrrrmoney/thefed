import { db } from './_lib/db.mjs';
import { json, methodNotAllowed } from './_lib/http.mjs';
import {
    TOTAL_SUPPLY,
    POOL,
    POOL_SHARE,
    SCHEDULE_DAYS,
    DAILY_CEILING,
    BASE_DAILY_CAP,
    LIFETIME_WALLET_CAP,
    TIERS,
    earlyMultiplier,
    dailyCapFor,
    playersToExhaust,
    dayOfSchedule
} from '../src/economics/index.js';

/**
 * Everything about what can be earned, in public.
 *
 * The figures come from the same module the payout uses, so this cannot drift
 * from the rules it describes. Nothing here is behind sign-in: the point is
 * that a player can see the terms before deciding whether to bother.
 */
export const SCHEDULE_START = process.env.SCHEDULE_START || null;

export default async function handler(req, res) {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

    const day = SCHEDULE_START ? dayOfSchedule(SCHEDULE_START) : null;
    const live = day !== null && day >= 1 && day <= SCHEDULE_DAYS;
    const multiplier = earlyMultiplier(live ? day : 1);

    let players = 0;
    try {
        const sql = db();
        const [row] = await sql`
            select count(distinct address)::int as players
            from sessions
            where rejected = false and score is not null
              and started_at > now() - interval '1 day'
        `;
        players = row ? row.players : 0;
    } catch (error) {
        // The rules are worth showing even when the tally is not available.
        players = 0;
    }

    return json(res, 200, {
        // Nothing is being distributed until the schedule starts, and saying so
        // plainly is better than implying a payout that does not yet exist.
        live,
        day: live ? day : null,
        scheduleDays: SCHEDULE_DAYS,
        scheduleStart: SCHEDULE_START,
        totalSupply: TOTAL_SUPPLY,
        poolShare: POOL_SHARE,
        pool: POOL,
        dailyCeiling: DAILY_CEILING,
        baseDailyCap: BASE_DAILY_CAP,
        lifetimeWalletCap: LIFETIME_WALLET_CAP,
        earlyMultiplier: multiplier,
        capToday: dailyCapFor(live ? day : 1, 0),
        capTodayTopTier: dailyCapFor(live ? day : 1, 500_000),
        playersToExhaust: playersToExhaust(live ? day : 1),
        playersYesterday: players,
        tiers: TIERS.map((tier) => ({
            ...tier,
            capToday: dailyCapFor(live ? day : 1, tier.holds)
        })),
        // Until the distributor is live these are known to be zero, and it is
        // better to say so than to leave them out and look evasive.
        distributedToDate: 0,
        burnedToDate: 0,
        note:
            'No tokens are being distributed yet. The rules below are what will apply when they are.'
    });
}
