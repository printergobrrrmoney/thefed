/**
 * Building a transaction by hand, because the library cannot be used here.
 *
 * @solana/web3.js ships syntax this project's babel cannot parse — the same
 * reason the wallet module is hand-written — so claiming needs the message
 * bytes assembled here instead.
 *
 * There is a second reason to want that, and it is the better one. The claim
 * page argues that nothing on it asks you to take our word for anything. If the
 * server handed the browser a finished blob to sign, a compromised server could
 * slip an extra instruction in beside the claim and the page would present it
 * as ours. Assembling the instruction list in the browser means the server can
 * supply addresses but never decide what the transaction does, and every
 * address it does supply is one the program independently checks.
 *
 * This is the legacy message format, which is what the distributor needs and
 * what every wallet still accepts.
 */

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export const base58Encode = (bytes) => {
    const digits = [];
    for (let i = 0; i < bytes.length; i += 1) {
        let carry = bytes[i];
        for (let j = 0; j < digits.length; j += 1) {
            carry += digits[j] << 8;
            digits[j] = carry % 58;
            carry = (carry / 58) | 0;
        }
        while (carry > 0) {
            digits.push(carry % 58);
            carry = (carry / 58) | 0;
        }
    }

    let out = '';
    // Every leading zero byte is a literal '1', not a zero digit.
    for (let i = 0; i < bytes.length && bytes[i] === 0; i += 1) out += '1';
    for (let i = digits.length - 1; i >= 0; i -= 1) out += B58[digits[i]];
    return out;
};

export const base58Decode = (input) => {
    if (typeof input !== 'string' || !input.length) return null;

    const bytes = [];
    for (let i = 0; i < input.length; i += 1) {
        const value = B58.indexOf(input[i]);
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

    for (let i = 0; i < input.length && input[i] === '1'; i += 1) bytes.push(0);
    return Uint8Array.from(bytes.reverse());
};

/** Solana's short vector length prefix: seven bits a byte, high bit continues. */
export const compactU16 = (value) => {
    const out = [];
    let rest = value;
    for (;;) {
        if (rest < 0x80) {
            out.push(rest);
            return Uint8Array.from(out);
        }
        out.push((rest & 0x7f) | 0x80);
        rest >>= 7;
    }
};

const concat = (parts) => {
    const total = parts.reduce((n, part) => n + part.length, 0);
    const out = new Uint8Array(total);
    let at = 0;
    parts.forEach((part) => {
        out.set(part, at);
        at += part.length;
    });
    return out;
};

/**
 * Order accounts the way the runtime expects: the fee payer first, then signers
 * before non-signers and writable before read-only within each group. Getting
 * this wrong does not fail loudly — it produces a message that serialises fine
 * and is rejected on chain — so it is pinned by tests against the real library.
 */
export const orderAccounts = (payer, instructions) => {
    const seen = new Map();

    const note = (address, isSigner, isWritable) => {
        const existing = seen.get(address);
        if (existing) {
            existing.isSigner = existing.isSigner || isSigner;
            existing.isWritable = existing.isWritable || isWritable;
            return;
        }
        seen.set(address, { address, isSigner, isWritable });
    };

    note(payer, true, true);
    instructions.forEach((instruction) => {
        instruction.keys.forEach((key) =>
            note(key.address, Boolean(key.isSigner), Boolean(key.isWritable))
        );
    });
    // A program is never a signer and is never written to.
    instructions.forEach((instruction) =>
        note(instruction.programId, false, false)
    );

    /**
     * Signers before non-signers, writable before read-only, and then -- the
     * part that is easy to miss -- ties broken lexicographically by address.
     * Insertion order seems the natural tiebreak and is wrong: the runtime
     * expects the same ordering the reference implementation produces, and a
     * message ordered any other way serialises and signs perfectly before
     * being rejected on chain. These exact collation options are what
     * @solana/web3.js uses.
     */
    const COLLATION = {
        localeMatcher: 'best fit',
        usage: 'sort',
        sensitivity: 'variant',
        ignorePunctuation: false,
        numeric: false,
        caseFirst: 'lower',
    };

    const ordered = [...seen.values()].sort((a, b) => {
        if (a.isSigner !== b.isSigner) return a.isSigner ? -1 : 1;
        if (a.isWritable !== b.isWritable) return a.isWritable ? -1 : 1;
        return a.address.localeCompare(b.address, 'en', COLLATION);
    });

    // The fee payer has to be index zero, whatever the sort thought.
    const payerAt = ordered.findIndex((account) => account.address === payer);
    if (payerAt > 0) ordered.unshift(...ordered.splice(payerAt, 1));

    return ordered;
};

/**
 * Serialise a legacy message. `instructions` are plain objects so nothing in
 * here depends on a library type:
 *
 *   { programId, keys: [{ address, isSigner, isWritable }], data: Uint8Array }
 */
export const serializeMessage = ({ payer, instructions, recentBlockhash }) => {
    const accounts = orderAccounts(payer, instructions);
    const indexOf = (address) =>
        accounts.findIndex((account) => account.address === address);

    const numRequiredSignatures = accounts.filter((a) => a.isSigner).length;
    const numReadonlySigned = accounts.filter(
        (a) => a.isSigner && !a.isWritable
    ).length;
    const numReadonlyUnsigned = accounts.filter(
        (a) => !a.isSigner && !a.isWritable
    ).length;

    const keyBytes = accounts.map((account) => {
        const raw = base58Decode(account.address);
        if (!raw || raw.length !== 32) {
            throw new Error(`not a public key: ${account.address}`);
        }
        return raw;
    });

    const blockhash = base58Decode(recentBlockhash);
    if (!blockhash || blockhash.length !== 32) {
        throw new Error('recentBlockhash is not a 32-byte hash');
    }

    const encoded = instructions.map((instruction) => {
        const indices = instruction.keys.map((key) => indexOf(key.address));
        if (indices.some((i) => i < 0)) {
            throw new Error('instruction names an account not in the message');
        }
        return concat([
            Uint8Array.of(indexOf(instruction.programId)),
            compactU16(indices.length),
            Uint8Array.from(indices),
            compactU16(instruction.data.length),
            Uint8Array.from(instruction.data),
        ]);
    });

    return concat([
        Uint8Array.of(
            numRequiredSignatures,
            numReadonlySigned,
            numReadonlyUnsigned
        ),
        compactU16(accounts.length),
        ...keyBytes,
        blockhash,
        compactU16(encoded.length),
        ...encoded,
    ]);
};

export default serializeMessage;
