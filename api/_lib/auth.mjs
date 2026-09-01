import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Session tokens.
 *
 * A signed value rather than a stored one, so verifying a request costs no
 * database round trip. It carries only the address and an expiry — there is
 * nothing secret in it, and it is not a bearer key to anything but this game's
 * own score submission.
 */
const SEPARATOR = '.';

const secret = () => {
    const value = process.env.AUTH_SECRET;
    if (!value) throw new Error('AUTH_SECRET is not set');
    return value;
};

export const TOKEN_TTL_SECONDS = 24 * 60 * 60;

const signPayload = (payload) =>
    createHmac('sha256', secret()).update(payload).digest('base64url');

export const issueToken = (address, now = Date.now()) => {
    const expires = Math.floor(now / 1000) + TOKEN_TTL_SECONDS;
    const payload = Buffer.from(
        JSON.stringify({ address, exp: expires })
    ).toString('base64url');
    return `${payload}${SEPARATOR}${signPayload(payload)}`;
};

export const readToken = (token, now = Date.now()) => {
    if (typeof token !== 'string' || token.indexOf(SEPARATOR) === -1) {
        return null;
    }

    const [payload, signature] = token.split(SEPARATOR);
    if (!payload || !signature) return null;

    const expected = Buffer.from(signPayload(payload));
    const given = Buffer.from(signature);
    // Compare in constant time, and only when lengths match — timingSafeEqual
    // throws otherwise, which would itself leak length.
    if (expected.length !== given.length) return null;
    if (!timingSafeEqual(expected, given)) return null;

    let claims;
    try {
        claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch (error) {
        return null;
    }

    if (!claims || typeof claims.address !== 'string') return null;
    if (typeof claims.exp !== 'number' || claims.exp * 1000 < now) return null;

    return claims;
};

/** Reads `Authorization: Bearer <token>` and returns the address, or null. */
export const addressFromRequest = (req) => {
    const header = (req.headers && req.headers.authorization) || '';
    const match = /^Bearer (.+)$/.exec(header);
    if (!match) return null;

    const claims = readToken(match[1]);
    return claims ? claims.address : null;
};
