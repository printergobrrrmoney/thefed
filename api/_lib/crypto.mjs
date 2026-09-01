import { createPublicKey, verify, randomBytes } from 'crypto';

/**
 * Ed25519 signature verification for Solana addresses, using Node's own crypto
 * rather than a signing library. A wallet library would pull in far more than
 * this needs, and this is the one place where being able to read the code end
 * to end actually matters.
 */

const BASE58 =
    '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Solana addresses are base58; this returns the raw 32 bytes. */
export const base58Decode = (input) => {
    if (typeof input !== 'string' || input.length === 0) return null;

    const bytes = [0];
    for (let i = 0; i < input.length; i += 1) {
        const value = BASE58.indexOf(input[i]);
        if (value === -1) return null;

        let carry = value;
        for (let j = 0; j < bytes.length; j += 1) {
            carry += bytes[j] * 58;
            bytes[j] = carry & 0xff;
            carry >>= 8;
        }
        while (carry > 0) {
            bytes.push(carry & 0xff);
            carry >>= 8;
        }
    }

    // Leading '1's are leading zero bytes.
    for (let i = 0; i < input.length && input[i] === '1'; i += 1) bytes.push(0);

    return Buffer.from(bytes.reverse());
};

export const isValidAddress = (address) => {
    const decoded = base58Decode(address);
    return !!decoded && decoded.length === 32;
};

/**
 * Node will not import a bare ed25519 key, but it will import SPKI DER. The
 * prefix below is the fixed DER header for an ed25519 public key, so a raw
 * 32-byte key can be wrapped without a dependency.
 */
const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export const verifySignature = ({ message, signature, address }) => {
    try {
        const rawKey = base58Decode(address);
        if (!rawKey || rawKey.length !== 32) return false;

        const sig = Buffer.from(signature, 'base64');
        if (sig.length !== 64) return false;

        const key = createPublicKey({
            key: Buffer.concat([SPKI_PREFIX, rawKey]),
            format: 'der',
            type: 'spki'
        });

        return verify(null, Buffer.from(message, 'utf8'), key, sig);
    } catch (error) {
        // A malformed key or signature is a failed verification, not a crash.
        return false;
    }
};

export const newNonce = () => randomBytes(24).toString('base64url');
