/* global BigInt */
import { createHash } from 'crypto';

/**
 * The merkle tree a day's payout is published as.
 *
 * This is deliberately a reimplementation of the tree the on-chain distributor
 * already verifies against, not an invention. A claim succeeds only if the root
 * we publish and the proof we hand a player reproduce, byte for byte, what the
 * program recomputes for itself — so the format is not ours to choose, and the
 * constants below are transcribed from the program rather than picked.
 *
 * From the program's claim instruction:
 *
 *     node = sha256(claimant || amount_unlocked_le || amount_locked_le)
 *     leaf = sha256([0] || node)
 *
 * and from its proof verifier, which walks the branch pairing hashes in sorted
 * order so a proof need not say which side each sibling was on:
 *
 *     parent = sha256([1] || min(a, b) || max(a, b))
 *
 * The two prefixes are what stop a leaf being passed off as an interior node,
 * which is the classic second-preimage attack on a naive merkle tree.
 */

/** Domain separators. A leaf and an interior node must never hash alike. */
export const LEAF_PREFIX = Buffer.from([0]);
export const INTERMEDIATE_PREFIX = Buffer.from([1]);

const sha256 = (...parts) =>
    createHash('sha256').update(Buffer.concat(parts)).digest();

/** Amounts cross the ABI as little-endian u64, which is what the program reads. */
export const u64le = (value) => {
    const out = Buffer.alloc(8);
    out.writeBigUInt64LE(BigInt(value));
    return out;
};

/**
 * One claimant's leaf. `claimant` is the raw 32-byte public key, not base58 —
 * the program hashes the key bytes, so anything else silently produces a tree
 * nobody can claim against.
 */
export const leafFor = (claimant, unlocked, locked = 0) => {
    if (!Buffer.isBuffer(claimant) || claimant.length !== 32) {
        throw new Error('claimant must be the raw 32-byte public key');
    }
    const node = sha256(claimant, u64le(unlocked), u64le(locked));
    return sha256(LEAF_PREFIX, node);
};

/** Interior node. Sorted, because the verifier pairs by value rather than side. */
export const pairHash = (a, b) =>
    Buffer.compare(a, b) <= 0
        ? sha256(INTERMEDIATE_PREFIX, a, b)
        : sha256(INTERMEDIATE_PREFIX, b, a);

/**
 * Build every level, leaves first, root last.
 *
 * An odd level duplicates its final entry rather than promoting it, matching
 * the reference implementation. Promoting instead would produce a different
 * root for the same claimants, and every proof under it would be rejected.
 */
export const buildLevels = (leaves) => {
    if (!leaves.length) throw new Error('cannot build a tree with no leaves');

    const levels = [leaves];
    let current = leaves;

    while (current.length > 1) {
        const next = [];
        for (let i = 0; i < current.length; i += 2) {
            const left = current[i];
            const right = i + 1 < current.length ? current[i + 1] : current[i];
            next.push(pairHash(left, right));
        }
        levels.push(next);
        current = next;
    }

    return levels;
};

export const rootOf = (levels) => levels[levels.length - 1][0];

/** The sibling at each level, which is all the sorted verifier needs. */
export const proofFor = (levels, index) => {
    if (index < 0 || index >= levels[0].length) {
        throw new Error(`no leaf at index ${index}`);
    }

    const proof = [];
    let at = index;

    for (let level = 0; level < levels.length - 1; level += 1) {
        const nodes = levels[level];
        const sibling = at % 2 === 0 ? at + 1 : at - 1;
        // An odd level pairs its last entry with itself, so that is its sibling.
        proof.push(sibling < nodes.length ? nodes[sibling] : nodes[at]);
        at = Math.floor(at / 2);
    }

    return proof;
};

/**
 * A transcription of the program's own verifier.
 *
 * It exists so our tests check proofs the way the chain will, rather than the
 * way we built them — a builder that agrees only with itself would pass its own
 * tests and fail every real claim.
 */
export const verifyProof = (proof, root, leaf) => {
    return proof
        .reduce((computed, sibling) => pairHash(computed, sibling), leaf)
        .equals(root);
};

/**
 * Turn a day's allocation into something publishable.
 *
 * Amounts are floored to whole base units: the chain has no fractions, and
 * rounding up would promise a total the funded account cannot cover.
 */
export const treeForAwards = (awards, decimals = 9) => {
    const scale = 10 ** decimals;

    const entries = awards
        .map((award) => ({
            address: award.address,
            claimant: Buffer.isBuffer(award.claimant) ? award.claimant : null,
            amount: Math.floor(award.amount * scale),
        }))
        .filter((entry) => entry.amount > 0);

    if (!entries.length) throw new Error('no non-zero awards to publish');

    const leaves = entries.map((entry) =>
        leafFor(entry.claimant, entry.amount)
    );
    const levels = buildLevels(leaves);

    return {
        root: rootOf(levels),
        total: entries.reduce((sum, entry) => sum + entry.amount, 0),
        claims: entries.map((entry, index) => ({
            address: entry.address,
            amountUnlocked: entry.amount,
            amountLocked: 0,
            index,
            proof: proofFor(levels, index),
        })),
    };
};
