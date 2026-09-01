import { db } from '../_lib/db.mjs';
import { isValidAddress, verifySignature } from '../_lib/crypto.mjs';
import { issueToken } from '../_lib/auth.mjs';
import { rateLimit, identify } from '../_lib/rateLimit.mjs';
import { json, badRequest, unauthorized, methodNotAllowed, readBody, domainOf } from '../_lib/http.mjs';
import { messageProblems } from '../../src/wallet/siws.js';

/**
 * Check a signature and hand back a session token.
 *
 * Three things must hold: the nonce was issued here and is unused, the message
 * says what it should say, and the signature is genuinely over that message by
 * that address. A valid signature over the wrong message is still a rejection.
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

    const { address, message, signature } = readBody(req);
    if (!isValidAddress(address)) return badRequest(res, 'invalid-address');
    const wait = await rateLimit('verify', identify(req, address));
    if (wait) {
        res.setHeader('Retry-After', String(wait));
        return json(res, 429, { error: 'rate-limited', retryAfter: wait });
    }

    if (typeof message !== 'string' || typeof signature !== 'string') {
        return badRequest(res, 'missing-signature');
    }

    const sql = db();
    const rows = await sql`
        select nonce, address, expires_at, used_at
        from auth_nonces
        where nonce = (
            select nonce from auth_nonces
            where address = ${address} and used_at is null
            order by issued_at desc limit 1
        )
    `;

    const challenge = rows[0];
    if (!challenge) return unauthorized(res, 'no-pending-challenge');

    const problems = messageProblems(message, {
        domain: domainOf(req),
        address,
        nonce: challenge.nonce,
        now: Date.now()
    });
    if (problems.length) return unauthorized(res, 'bad-message', { problems });

    if (!verifySignature({ message, signature, address })) {
        return unauthorized(res, 'bad-signature');
    }

    // Burn the nonce before issuing anything, so a replay cannot race this.
    const burned = await sql`
        update auth_nonces set used_at = now()
        where nonce = ${challenge.nonce} and used_at is null
        returning nonce
    `;
    if (!burned.length) return unauthorized(res, 'challenge-already-used');

    await sql`
        insert into players (address) values (${address})
        on conflict (address) do update set last_seen_at = now()
    `;

    const player = await sql`
        select display_name from players where address = ${address}
    `;

    return json(res, 200, {
        token: issueToken(address),
        address,
        displayName: player[0] ? player[0].display_name : null
    });
}
