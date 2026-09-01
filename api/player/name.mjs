import { db } from '../_lib/db.mjs';
import { addressFromRequest } from '../_lib/auth.mjs';
import { json, badRequest, unauthorized, methodNotAllowed, readBody } from '../_lib/http.mjs';
import { nameProblem, normalise } from '../../src/leaderboard/displayName.js';

/**
 * Set a display name.
 *
 * The same rules run in the browser for immediate feedback, but they are
 * enforced here because the browser's opinion does not count. Names are stored
 * as given and rendered as plain text — never as links.
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

    const address = addressFromRequest(req);
    if (!address) return unauthorized(res);

    const { displayName } = readBody(req);
    const problem = nameProblem(displayName);
    if (problem) return badRequest(res, problem);

    const name = normalise(displayName);
    const sql = db();

    // Names must be unique so one player cannot pose as another.
    const [taken] = await sql`
        select address from players
        where lower(display_name) = lower(${name}) and address <> ${address}
    `;
    if (taken) return badRequest(res, 'name-taken');

    // Only a player who has actually played may put a name on the board; that
    // makes a spam entry cost a real session rather than a single request.
    const [played] = await sql`
        select 1 from sessions
        where address = ${address} and rejected = false and score is not null
        limit 1
    `;
    if (!played) return badRequest(res, 'no-verified-session');

    await sql`
        update players set display_name = ${name} where address = ${address}
    `;

    return json(res, 200, { displayName: name });
}
