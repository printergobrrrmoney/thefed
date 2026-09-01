import { db } from '../_lib/db.mjs';
import { addressFromRequest } from '../_lib/auth.mjs';
import { rateLimit, identify } from '../_lib/rateLimit.mjs';
import { json, badRequest, unauthorized, methodNotAllowed, readBody } from '../_lib/http.mjs';
import { nameProblem, normalise } from '../../src/leaderboard/displayName.js';

/**
 * Set a display name.
 *
 * The same rules run in the browser for immediate feedback, but they are
 * enforced here because the browser's opinion does not count. Names are stored
 * as given and rendered as plain text — never as links.
 *
 * Names are deliberately not unique. The leaderboard shows the address beside
 * every name, so two players called Powell are visibly different rows — which
 * distinguishes them better than a uniqueness rule, and without rejecting a
 * name at the moment someone is filling in a form.
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

    const address = addressFromRequest(req);
    if (!address) return unauthorized(res);
    const wait = await rateLimit('name', identify(req, address));
    if (wait) {
        res.setHeader('Retry-After', String(wait));
        return json(res, 429, { error: 'rate-limited', retryAfter: wait });
    }


    const { displayName } = readBody(req);
    const problem = nameProblem(displayName);
    if (problem) return badRequest(res, problem);

    const name = normalise(displayName);
    const sql = db();

    await sql`
        update players set display_name = ${name} where address = ${address}
    `;

    return json(res, 200, { displayName: name });
}
