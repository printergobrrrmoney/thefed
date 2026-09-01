import { db } from '../_lib/db.mjs';
import { isValidAddress, newNonce } from '../_lib/crypto.mjs';
import { json, badRequest, methodNotAllowed, readBody, domainOf } from '../_lib/http.mjs';
import { NONCE_TTL_SECONDS } from '../../src/wallet/siws.js';

/**
 * Issue a sign-in challenge.
 *
 * The nonce is generated and stored here, so a signature is only ever good for
 * a challenge this server actually issued, and only once.
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

    const { address } = readBody(req);
    if (!isValidAddress(address)) return badRequest(res, 'invalid-address');

    const sql = db();
    const nonce = newNonce();
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + NONCE_TTL_SECONDS * 1000);

    await sql`
        insert into auth_nonces (nonce, address, issued_at, expires_at)
        values (${nonce}, ${address}, ${issuedAt.toISOString()}, ${expiresAt.toISOString()})
    `;

    // Opportunistic cleanup; there is no scheduler and these are tiny.
    await sql`delete from auth_nonces where expires_at < now() - interval '1 day'`;

    return json(res, 200, {
        domain: domainOf(req),
        address,
        nonce,
        issuedAt: issuedAt.toISOString(),
        expiresAt: expiresAt.toISOString()
    });
}
