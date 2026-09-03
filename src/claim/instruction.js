/* global BigInt */
import { serializeMessage, base58Encode } from '../wallet/transaction.js';

/**
 * The claim instruction, assembled in the browser.
 *
 * The API supplies addresses and a proof; this file decides what the
 * transaction actually does. That split is the point: a compromised API can
 * hand over a wrong address, but every address it supplies is one the program
 * checks for itself — the vault by `address = distributor.token_vault`, the
 * claim status by its seeds, the destination by mint and authority. What an API
 * cannot do is add a second instruction beside the claim, because the
 * instruction list is built here.
 */

/**
 * Anchor dispatches on the first eight bytes of sha256("global:new_claim").
 * Hard-coded because it is a constant and hashing in a browser is async; the
 * test recomputes it rather than trusting this line.
 */
export const NEW_CLAIM_DISCRIMINATOR = Uint8Array.of(
    78,
    177,
    98,
    123,
    210,
    21,
    187,
    83
);

export const MERKLE_DISTRIBUTOR_PROGRAM =
    'mERKcfxMC5SqJn4Ld4BUris3WKZZ1ojjWJ3A3J5CKxv';
export const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const SYSTEM_PROGRAM = '11111111111111111111111111111111';

const u64 = (value) => {
    const out = new Uint8Array(8);
    let rest = BigInt(value);
    for (let i = 0; i < 8; i += 1) {
        out[i] = Number(rest & 0xffn);
        rest >>= 8n;
    }
    return out;
};

const u32 = (value) => {
    const out = new Uint8Array(4);
    let rest = value;
    for (let i = 0; i < 4; i += 1) {
        out[i] = rest & 0xff;
        rest >>>= 8;
    }
    return out;
};

const fromHex = (hex) => {
    if (typeof hex !== 'string' || hex.length !== 64) {
        throw new Error('a proof node must be 32 bytes of hex');
    }
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i += 1) {
        out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
};

const concat = (parts) => {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    parts.forEach((part) => {
        out.set(part, at);
        at += part.length;
    });
    return out;
};

/** Instruction data: discriminator, both amounts, then the proof as a vector. */
export const claimData = ({ amountUnlocked, amountLocked, proof }) =>
    concat([
        NEW_CLAIM_DISCRIMINATOR,
        u64(amountUnlocked),
        u64(amountLocked || 0),
        u32(proof.length),
        ...proof.map(fromHex),
    ]);

/**
 * Account order is the program's, not ours, and it is positional — a wrong
 * order is not rejected as malformed, it is read as different accounts.
 */
export const claimAccounts = ({
    distributor,
    claimStatus,
    vault,
    destination,
    claimant,
}) => [
    { address: distributor, isSigner: false, isWritable: true },
    { address: claimStatus, isSigner: false, isWritable: true },
    { address: vault, isSigner: false, isWritable: true },
    { address: destination, isSigner: false, isWritable: true },
    { address: claimant, isSigner: true, isWritable: true },
    { address: TOKEN_PROGRAM, isSigner: false, isWritable: false },
    { address: SYSTEM_PROGRAM, isSigner: false, isWritable: false },
];

/**
 * A complete, unsigned message, base58 encoded — the form a wallet's
 * `signAndSendTransaction` request takes.
 */
export const buildClaimMessage = ({
    claimant,
    distributor,
    claimStatus,
    vault,
    destination,
    amountUnlocked,
    amountLocked,
    proof,
    recentBlockhash,
    createDestination,
}) => {
    const instructions = [];

    // The associated token account has to exist before tokens can land in it.
    // Creating it is idempotent, so including it always is safer than guessing.
    if (createDestination) instructions.push(createDestination);

    instructions.push({
        programId: MERKLE_DISTRIBUTOR_PROGRAM,
        keys: claimAccounts({
            distributor,
            claimStatus,
            vault,
            destination,
            claimant,
        }),
        data: claimData({ amountUnlocked, amountLocked, proof }),
    });

    const message = serializeMessage({
        payer: claimant,
        instructions,
        recentBlockhash,
    });

    return { message, encoded: base58Encode(message), instructions };
};

export default buildClaimMessage;
