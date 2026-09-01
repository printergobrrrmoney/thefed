import { findWallet, isUsable } from './providers.js';
import { buildSignInMessage } from './siws.js';

/**
 * Connect and sign in.
 *
 * The only two wallet operations this site performs are `connect` and
 * `signMessage`. It never builds, requests or sends a transaction. If a site
 * calling itself The Fed ever asks you to approve a transaction, it is not
 * this one.
 */

export const ERRORS = {
    NOT_FOUND: 'wallet-not-found',
    REJECTED: 'user-rejected',
    NO_ACCOUNT: 'no-account',
    SIGN_FAILED: 'signature-failed'
};

/** Phantom and friends reject with code 4001, following EIP-1193. */
const isRejection = (error) =>
    !!error &&
    (error.code === 4001 ||
        /user rejected|declined|cancelled|canceled/i.test(error.message || ''));

/**
 * UTF-8 encode, explicitly.
 *
 * TextEncoder would do this, but the bytes a wallet signs are the security
 * boundary, so it is worth having exactly one code path that is visible here
 * and covered by tests, rather than depending on what the host environment
 * happens to provide.
 */
export const utf8Bytes = (str) => {
    const out = [];
    for (let i = 0; i < str.length; i += 1) {
        const c = str.charCodeAt(i);
        if (c < 0x80) {
            out.push(c);
        } else if (c < 0x800) {
            out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
        } else if (c >= 0xd800 && c <= 0xdbff) {
            i += 1;
            const point = 0x10000 + ((c - 0xd800) << 10) + (str.charCodeAt(i) - 0xdc00);
            out.push(
                0xf0 | (point >> 18),
                0x80 | ((point >> 12) & 0x3f),
                0x80 | ((point >> 6) & 0x3f),
                0x80 | (point & 0x3f)
            );
        } else {
            out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
        }
    }
    return new Uint8Array(out);
};

/** Base64 without a dependency; the server decodes it back to bytes. */
export const toBase64 = (bytes) => {
    let binary = '';
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (let i = 0; i < arr.length; i += 1) {
        binary += String.fromCharCode(arr[i]);
    }
    return typeof btoa === 'function'
        ? btoa(binary)
        : Buffer.from(arr).toString('base64');
};

export const connect = async (walletId) => {
    const wallet = findWallet(walletId);
    if (!wallet || !isUsable(wallet.provider)) {
        throw Object.assign(new Error('Wallet not found'), {
            code: ERRORS.NOT_FOUND
        });
    }

    let result;
    try {
        result = await wallet.provider.connect();
    } catch (error) {
        throw Object.assign(new Error('Connection refused'), {
            code: isRejection(error) ? ERRORS.REJECTED : ERRORS.NO_ACCOUNT
        });
    }

    // Providers vary: some return the key, some only set it on themselves.
    const publicKey =
        (result && result.publicKey) || wallet.provider.publicKey || null;
    if (!publicKey) {
        throw Object.assign(new Error('No account'), {
            code: ERRORS.NO_ACCOUNT
        });
    }

    return { walletId: wallet.id, address: publicKey.toString() };
};

/**
 * Sign the server-issued challenge. The nonce comes from the server, so the
 * resulting signature is only good for this one sign-in.
 */
export const signIn = async ({ walletId, address, nonce, issuedAt, expiresAt, domain }) => {
    const wallet = findWallet(walletId);
    if (!wallet || !isUsable(wallet.provider)) {
        throw Object.assign(new Error('Wallet not found'), {
            code: ERRORS.NOT_FOUND
        });
    }

    const message = buildSignInMessage({
        domain,
        address,
        nonce,
        issuedAt,
        expiresAt
    });
    const encoded = utf8Bytes(message);

    let signed;
    try {
        signed = await wallet.provider.signMessage(encoded, 'utf8');
    } catch (error) {
        throw Object.assign(new Error('Signature refused'), {
            code: isRejection(error) ? ERRORS.REJECTED : ERRORS.SIGN_FAILED
        });
    }

    const signature = (signed && signed.signature) || signed;
    if (!signature) {
        throw Object.assign(new Error('No signature returned'), {
            code: ERRORS.SIGN_FAILED
        });
    }

    return { message, signature: toBase64(signature), address };
};

export const disconnect = async (walletId) => {
    const wallet = findWallet(walletId);
    if (wallet && wallet.provider && typeof wallet.provider.disconnect === 'function') {
        try {
            await wallet.provider.disconnect();
        } catch (error) {
            // A wallet refusing to disconnect should not trap the player in a
            // signed-in state; the app forgets them regardless.
        }
    }
};

/** 7xKX…gAsU — enough to recognise, short enough to sit in a nav bar. */
export const shortAddress = (address, lead = 4, tail = 4) =>
    typeof address === 'string' && address.length > lead + tail + 1
        ? `${address.slice(0, lead)}…${address.slice(-tail)}`
        : address || '';
