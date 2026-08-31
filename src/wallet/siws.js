/**
 * The message a player signs to prove they control a wallet.
 *
 * Deliberately plain English. A wallet shows this text verbatim in its approval
 * dialog, so it is the last thing standing between a player and a mistake — it
 * should read like a sentence, not a blob, and it should state plainly that
 * nothing is being moved.
 *
 * The shape follows Sign-In-With-Solana: a domain, a statement, and fields the
 * server can check. The nonce is issued by the server, so a signature captured
 * from elsewhere cannot be replayed here.
 */

export const SIGN_IN_STATEMENT =
    'Sign in to The Fed. This proves you control this wallet. ' +
    'It is not a transaction and moves no funds.';

/** Seconds a sign-in request stays valid. */
export const NONCE_TTL_SECONDS = 5 * 60;

export const buildSignInMessage = ({
    domain,
    address,
    nonce,
    issuedAt,
    expiresAt,
    statement = SIGN_IN_STATEMENT
}) =>
    [
        `${domain} wants you to sign in with your Solana account:`,
        address,
        '',
        statement,
        '',
        `URI: https://${domain}`,
        `Nonce: ${nonce}`,
        `Issued At: ${issuedAt}`,
        `Expires At: ${expiresAt}`
    ].join('\n');

/**
 * Parse a message back into its fields. The server uses this to check what it
 * is about to trust, rather than assuming the client sent back what it was
 * given.
 */
export const parseSignInMessage = (message) => {
    if (typeof message !== 'string') return null;

    const lines = message.split('\n');
    if (lines.length < 9) return null;

    const domainMatch = /^(.+) wants you to sign in with your Solana account:$/.exec(
        lines[0]
    );
    if (!domainMatch) return null;

    const field = (prefix) => {
        const line = lines.find((l) => l.indexOf(`${prefix}: `) === 0);
        return line ? line.slice(prefix.length + 2) : null;
    };

    return {
        domain: domainMatch[1],
        address: lines[1],
        statement: lines[3],
        uri: field('URI'),
        nonce: field('Nonce'),
        issuedAt: field('Issued At'),
        expiresAt: field('Expires At')
    };
};

/**
 * Everything the server must be satisfied of before it trusts a signature.
 * Signature verification itself happens server-side; these are the checks that
 * stop a valid signature over the wrong message being accepted.
 */
export const messageProblems = (
    message,
    { domain, address, nonce, now }
) => {
    const parsed = parseSignInMessage(message);
    const problems = [];

    if (!parsed) return ['unparseable-message'];
    if (parsed.domain !== domain) problems.push('wrong-domain');
    if (parsed.address !== address) problems.push('wrong-address');
    if (parsed.nonce !== nonce) problems.push('wrong-nonce');

    const expires = Date.parse(parsed.expiresAt);
    if (Number.isNaN(expires)) problems.push('bad-expiry');
    else if (expires < now) problems.push('expired');

    return problems;
};
