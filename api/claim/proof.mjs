import { db } from '../_lib/db.mjs';
import { json, badRequest, methodNotAllowed } from '../_lib/http.mjs';
import { isValidAddress } from '../_lib/crypto.mjs';
import { claimForDay, distributionForDay } from '../_lib/distribution.mjs';

/**
 * What one wallet can claim, and the proof that lets it.
 *
 * Public and unauthenticated, like the rest of the read surface. A proof is not
 * a secret: it only proves an award that is already in a published tree, and it
 * is useless to anyone who cannot sign for the address it names. Requiring a
 * signature here would protect nothing and would stop a player checking a
 * wallet they cannot sign for from another device.
 */

/** Days are UTC dates; anything else is a client bug worth naming. */
const DAY = /^\d{4}-\d{2}-\d{2}$/;

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
    const day = (req.query && req.query.day) || '';

    if (!isValidAddress(address)) return badRequest(res, 'bad-address');
    if (!DAY.test(day)) return badRequest(res, 'bad-day');

    const sql = db();

    let claim;
    try {
        claim = await claimForDay(sql, day, address);
    } catch (error) {
        // A day that will not reconstruct is our problem, not the caller's, and
        // it must be loud: every proof for that day is unusable until it is
        // fixed, so it should never be quietly reported as "nothing to claim".
        return json(res, 500, {
            error: 'day-inconsistent',
            detail: error.message
        });
    }

    if (!claim) {
        const published = await distributionForDay(sql, day);
        return json(res, 200, {
            address,
            day,
            published: Boolean(published),
            claimable: null,
            note: published
                ? 'That day was published, but this wallet earned nothing on it.'
                : 'Nothing has been published for that day.'
        });
    }

    return json(res, 200, {
        address,
        day: claim.day,
        published: true,
        // Everything the claim instruction needs, and nothing it does not.
        claimable: {
            distributor: claim.distributor,
            mint: claim.mint,
            amountUnlocked: claim.amountUnlocked,
            amountLocked: claim.amountLocked,
            proof: claim.proof,
            index: claim.index
        },
        root: claim.root,
        score: claim.score,
        claimedAt: claim.claimedAt,
        note: claim.claimedAt
            ? 'Already claimed. The proof is still valid to inspect.'
            : 'Unclaimed. The proof below is what the distributor verifies.'
    });
}
