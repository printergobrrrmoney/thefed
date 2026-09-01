/**
 * The reward rules, in one place.
 *
 * Everything a player could want to check about what they can earn is computed
 * from the constants below, and the same module runs in the browser and on the
 * server — so the numbers shown on the page are the numbers the payout uses,
 * not a description of them that could drift.
 *
 * Nothing here is secret. It is published precisely so it can be argued with.
 */

/** Total supply the pool is carved from. */
export const TOTAL_SUPPLY = 1_000_000_000;

/** Share of supply reserved for players. */
export const POOL_SHARE = 0.3;

/** The pool is spent over this many days, then it is gone. */
export const SCHEDULE_DAYS = 365;

/** Base per-wallet daily cap, before any multiplier. */
export const BASE_DAILY_CAP = 500;

/** No single wallet may ever take more than this share of the pool. */
export const LIFETIME_WALLET_SHARE = 0.001;

export const POOL = TOTAL_SUPPLY * POOL_SHARE;

/**
 * The most that can be paid out on any day. It is a ceiling, never a quota:
 * whatever is not earned is burned rather than shared among however few
 * happened to play.
 */
export const DAILY_CEILING = POOL / SCHEDULE_DAYS;

export const LIFETIME_WALLET_CAP = POOL * LIFETIME_WALLET_SHARE;

/**
 * Being early is worth more, deliberately and openly, rather than as a side
 * effect of thin turnout. It runs on the day of the run, so nobody can register
 * early and bank a high rate to use months later.
 */
export const earlyMultiplier = (day) =>
    1 + 2 * Math.pow(0.5, Math.max(0, day - 1) / 45);

/** Holder tiers, by time-weighted balance sampled at unannounced slots. */
export const TIERS = [
    { name: 'Base', holds: 0, multiplier: 1 },
    { name: 'Holder', holds: 5_000, multiplier: 1.25 },
    { name: 'Stacker', holds: 50_000, multiplier: 1.5 },
    { name: 'Printer', holds: 200_000, multiplier: 2 },
    { name: 'Chair', holds: 500_000, multiplier: 2.5 }
];

export const tierFor = (balance = 0) =>
    TIERS.reduce(
        (best, tier) => (balance >= tier.holds ? tier : best),
        TIERS[0]
    );

/** What one wallet can earn today, at a given tier. */
export const dailyCapFor = (day, balance = 0) =>
    BASE_DAILY_CAP * earlyMultiplier(day) * tierFor(balance).multiplier;

/** Scores grow exponentially, so they are compressed before they are paid against. */
export const pointsFor = (score) => Math.log10(1 + Math.max(0, score));

/**
 * How many players it takes to reach the ceiling on a given day. Below this,
 * the difference is burned.
 */
export const playersToExhaust = (day, balance = 0) =>
    Math.ceil(DAILY_CEILING / dailyCapFor(day, balance));

/** Which day of the schedule a date falls on. Day one is the first day. */
export const dayOfSchedule = (startedOn, now = new Date()) => {
    const start = new Date(startedOn);
    const ms = now.getTime() - start.getTime();
    return Math.floor(ms / 86_400_000) + 1;
};

/**
 * Allocate a day's ceiling across the players who earned it. Each wallet is
 * held to its own cap, and what nobody earned is burned.
 */
export const allocateDay = (entries, day) => {
    const weighted = entries.map((entry) => {
        const multiplier = tierFor(entry.balance).multiplier;
        return {
            ...entry,
            cap: BASE_DAILY_CAP * earlyMultiplier(day) * multiplier,
            weight: pointsFor(entry.score) * earlyMultiplier(day) * multiplier
        };
    });

    const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);

    const awards = weighted.map((entry) => ({
        address: entry.address,
        amount: total
            ? Math.min(entry.cap, (DAILY_CEILING * entry.weight) / total)
            : 0
    }));

    const paid = awards.reduce((sum, award) => sum + award.amount, 0);

    return {
        day,
        awards: awards.filter((award) => award.amount > 0),
        paid,
        burned: Math.max(0, DAILY_CEILING - paid),
        ceiling: DAILY_CEILING
    };
};
