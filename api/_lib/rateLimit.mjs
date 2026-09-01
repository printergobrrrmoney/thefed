import { db } from './db.mjs';

/**
 * Rate limiting, in Postgres.
 *
 * A dedicated store would be faster, but this runs at the scale of people
 * clicking a button, and one fewer service is one fewer thing to go wrong. The
 * window is fixed rather than sliding: cruder, but it cannot be gamed in a way
 * that matters here.
 *
 * Limits are per identity — usually an address, falling back to an IP for the
 * endpoints that run before anyone is signed in.
 */
export const LIMITS = {
    nonce: { max: 10, seconds: 60 },
    verify: { max: 10, seconds: 60 },
    start: { max: 10, seconds: 60 },
    submit: { max: 20, seconds: 60 },
    name: { max: 5, seconds: 300 }
};

/**
 * Behind Vercel the socket address is a proxy, so the forwarded header is the
 * only thing resembling a client. It is spoofable, which is why it only ever
 * guards endpoints that run before sign-in — anything that matters is limited
 * by address instead.
 */
export const identify = (req, address) => {
    if (address) return `addr:${address}`;
    const forwarded = (req.headers && req.headers['x-forwarded-for']) || '';
    const ip = forwarded.split(',')[0].trim();
    return `ip:${ip || 'unknown'}`;
};

/**
 * Returns null when the call is allowed, or the seconds to wait when it is not.
 */
export const rateLimit = async (bucket, identity) => {
    const limit = LIMITS[bucket];
    if (!limit) return null;

    const sql = db();
    const windowStart = new Date(
        Math.floor(Date.now() / (limit.seconds * 1000)) * limit.seconds * 1000
    );

    const [row] = await sql`
        insert into rate_limits (bucket, identity, window_start, hits)
        values (${bucket}, ${identity}, ${windowStart.toISOString()}, 1)
        on conflict (bucket, identity, window_start)
        do update set hits = rate_limits.hits + 1
        returning hits
    `;

    if (row.hits > limit.max) {
        const elapsed = (Date.now() - windowStart.getTime()) / 1000;
        return Math.max(1, Math.ceil(limit.seconds - elapsed));
    }

    return null;
};

/** Old windows are dead weight; clearing them is cheap and needs no scheduler. */
export const sweepRateLimits = async () => {
    const sql = db();
    await sql`delete from rate_limits where window_start < now() - interval '1 hour'`;
};
