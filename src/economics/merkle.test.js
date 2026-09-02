import { createHash } from 'crypto';
import {
    LEAF_PREFIX,
    INTERMEDIATE_PREFIX,
    u64le,
    leafFor,
    pairHash,
    buildLevels,
    rootOf,
    proofFor,
    verifyProof,
    treeForAwards,
} from './merkle';

/**
 * These tests check the builder against the verifier, deliberately.
 *
 * The verifier is a transcription of the program's own code and is short enough
 * to read against the original line by line; the builder is the part with the
 * fiddly cases — odd levels, duplicated tails, sibling lookup. Proving the
 * complicated half satisfies the simple half is the same question the chain
 * asks when someone claims.
 */
const key = (seed) => createHash('sha256').update(String(seed)).digest();

const treeOf = (count) => {
    const claimants = Array.from({ length: count }, (unused, i) => key(i));
    const amounts = claimants.map((unused, i) => (i + 1) * 1_000);
    const leaves = claimants.map((claimant, i) =>
        leafFor(claimant, amounts[i])
    );
    const levels = buildLevels(leaves);
    return { claimants, amounts, leaves, levels, root: rootOf(levels) };
};

describe('the leaf format', () => {
    it('is the double hash the program recomputes', () => {
        const claimant = key('alice');
        const inner = createHash('sha256')
            .update(Buffer.concat([claimant, u64le(500), u64le(0)]))
            .digest();
        const expected = createHash('sha256')
            .update(Buffer.concat([LEAF_PREFIX, inner]))
            .digest();

        expect(leafFor(claimant, 500)).toEqual(expected);
    });

    it('writes amounts as little-endian u64', () => {
        expect([...u64le(1)]).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
        expect([...u64le(256)]).toEqual([0, 1, 0, 0, 0, 0, 0, 0]);
    });

    it('separates leaves from interior nodes', () => {
        expect(LEAF_PREFIX[0]).toBe(0);
        expect(INTERMEDIATE_PREFIX[0]).toBe(1);
    });

    it('refuses a base58 address where raw key bytes are required', () => {
        expect(() => leafFor('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZ', 1)).toThrow(
            /32-byte/
        );
    });
});

describe('pairing', () => {
    it('sorts, so a proof need not say which side a sibling was on', () => {
        const a = key('a');
        const b = key('b');
        expect(pairHash(a, b)).toEqual(pairHash(b, a));
    });
});

describe('the tree', () => {
    // Odd counts are where a merkle implementation usually goes wrong, so they
    // are covered densely rather than sampled.
    [1, 2, 3, 4, 5, 7, 8, 9, 16, 17, 33, 100].forEach((count) => {
        it(`produces a proof the verifier accepts for all ${count} leaves`, () => {
            const { leaves, levels, root } = treeOf(count);

            leaves.forEach((leaf, index) => {
                expect(verifyProof(proofFor(levels, index), root, leaf)).toBe(
                    true
                );
            });
        });
    });

    it('gives a single leaf an empty proof that still verifies', () => {
        const { leaves, levels, root } = treeOf(1);
        expect(proofFor(levels, 0)).toEqual([]);
        expect(verifyProof([], root, leaves[0])).toBe(true);
    });

    it('rejects a claim for an amount that was not awarded', () => {
        const { claimants, levels, root } = treeOf(8);
        const inflated = leafFor(claimants[3], 999_999_999);

        expect(verifyProof(proofFor(levels, 3), root, inflated)).toBe(false);
    });

    it('rejects a claimant who is not in the tree', () => {
        const { levels, root } = treeOf(8);
        const stranger = leafFor(key('not-a-player'), 1_000);

        expect(verifyProof(proofFor(levels, 0), root, stranger)).toBe(false);
    });

    it('will not let one claimant use another claimant proof', () => {
        const { leaves, levels, root } = treeOf(8);
        expect(verifyProof(proofFor(levels, 2), root, leaves[5])).toBe(false);
    });

    it('rejects a tampered proof', () => {
        const { leaves, levels, root } = treeOf(8);
        const proof = proofFor(levels, 2);
        proof[0] = key('swapped');

        expect(verifyProof(proof, root, leaves[2])).toBe(false);
    });

    it('changes root when any amount changes', () => {
        const a = buildLevels([leafFor(key(1), 100), leafFor(key(2), 200)]);
        const b = buildLevels([leafFor(key(1), 100), leafFor(key(2), 201)]);

        expect(rootOf(a).equals(rootOf(b))).toBe(false);
    });
});

describe('publishing a day', () => {
    const awards = [
        { address: 'one', claimant: key('one'), amount: 1.5 },
        { address: 'two', claimant: key('two'), amount: 2.25 },
        { address: 'three', claimant: key('three'), amount: 0 },
    ];

    it('drops zero awards rather than publishing unclaimable leaves', () => {
        const tree = treeForAwards(awards);
        expect(tree.claims.map((claim) => claim.address)).toEqual([
            'one',
            'two',
        ]);
    });

    it('scales to base units and floors, never promising more than is funded', () => {
        const tree = treeForAwards(awards);
        expect(tree.claims[0].amountUnlocked).toBe(1_500_000_000);
        expect(tree.claims[1].amountUnlocked).toBe(2_250_000_000);
        expect(tree.total).toBe(3_750_000_000);
    });

    it('emits proofs that verify against the published root', () => {
        const tree = treeForAwards(awards);

        tree.claims.forEach((claim, index) => {
            const leaf = leafFor(
                key(claim.address),
                claim.amountUnlocked,
                claim.amountLocked
            );
            expect(claim.index).toBe(index);
            expect(verifyProof(claim.proof, tree.root, leaf)).toBe(true);
        });
    });

    it('refuses to publish a day nobody earned', () => {
        expect(() => treeForAwards([])).toThrow(/no non-zero awards/);
    });
});
