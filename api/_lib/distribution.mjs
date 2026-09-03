/* global BigInt */
import { base58Decode } from './crypto.mjs';
import {
    leafFor,
    buildLevels,
    rootOf,
    proofFor as proofAt,
    verifyProof,
} from '../../src/economics/merkle.js';

/**
 * Reading a published day back out.
 *
 * Proofs are rebuilt here from the stored leaves rather than stored alongside
 * them. A stored proof can drift from the root it is meant to prove — a schema
 * change, a partial write, a rebalance — and the failure would be invisible
 * until a player's claim was refused on chain. Rebuilding from the same leaves
 * the root was built from means a proof we serve is either right or the whole
 * day fails to reconstruct, which is the loud kind of wrong.
 */

/** Awards in leaf order, which is the order the tree was built in. */
export const awardsForDay = async (sql, day) => {
    const rows = await sql`
        select address, leaf_index, amount, score, claimed_at
        from distribution_awards
        where day = ${day}
        order by leaf_index asc
    `;
    return rows.map((row) => ({
        address: row.address,
        index: Number(row.leaf_index),
        amount: BigInt(row.amount),
        score: Number(row.score),
        claimedAt: row.claimed_at,
    }));
};

export const distributionForDay = async (sql, day) => {
    const [row] = await sql`
        select day, schedule_day, root, mint, distributor, version,
               total_awarded, ceiling, burned, node_count,
               created_tx, funded_tx, burned_tx, published_at
        from distributions
        where day = ${day}
    `;
    if (!row) return null;
    return {
        day: row.day,
        scheduleDay: Number(row.schedule_day),
        root: Buffer.from(row.root),
        mint: row.mint,
        distributor: row.distributor,
        version: Number(row.version),
        totalAwarded: BigInt(row.total_awarded),
        ceiling: BigInt(row.ceiling),
        burned: BigInt(row.burned),
        nodeCount: Number(row.node_count),
        createdTx: row.created_tx,
        fundedTx: row.funded_tx,
        burnedTx: row.burned_tx,
        publishedAt: row.published_at,
    };
};

/**
 * Rebuild the tree for a day. Throws rather than returning a bad tree: a root
 * that does not match what was published means the awards and the published
 * root disagree, and serving proofs from that would hand players claims the
 * chain will reject.
 */
export const rebuildTree = (awards, expectedRoot) => {
    if (!awards.length) throw new Error('no awards recorded for that day');

    awards.forEach((award, i) => {
        if (award.index !== i) {
            throw new Error(
                `leaf indexes are not contiguous: expected ${i}, found ${award.index}`
            );
        }
    });

    const leaves = awards.map((award) => {
        const raw = base58Decode(award.address);
        if (!raw || raw.length !== 32) {
            throw new Error(
                `award address is not a public key: ${award.address}`
            );
        }
        return leafFor(Buffer.from(raw), award.amount);
    });

    const levels = buildLevels(leaves);
    const root = rootOf(levels);

    if (expectedRoot && !root.equals(expectedRoot)) {
        throw new Error(
            'rebuilt root does not match the published root for that day'
        );
    }

    return { levels, leaves, root };
};

/**
 * One player's claim for one day, ready to hand to the distributor.
 *
 * The proof is checked here before it is served. It costs almost nothing and it
 * moves the failure from a rejected transaction the player has to interpret to
 * an error we can see in our own logs.
 */
export const claimForDay = async (sql, day, address) => {
    const distribution = await distributionForDay(sql, day);
    if (!distribution) return null;

    const awards = await awardsForDay(sql, day);
    const mine = awards.find((award) => award.address === address);
    if (!mine) return null;

    const { levels, leaves, root } = rebuildTree(awards, distribution.root);
    const proof = proofAt(levels, mine.index);

    if (!verifyProof(proof, root, leaves[mine.index])) {
        throw new Error('rebuilt proof does not verify against the root');
    }

    return {
        day: distribution.day,
        distributor: distribution.distributor,
        mint: distribution.mint,
        version: distribution.version,
        index: mine.index,
        amountUnlocked: mine.amount.toString(),
        amountLocked: '0',
        proof: proof.map((node) => node.toString('hex')),
        root: root.toString('hex'),
        claimedAt: mine.claimedAt,
        score: mine.score,
    };
};
