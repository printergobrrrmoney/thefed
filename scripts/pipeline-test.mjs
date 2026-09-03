/**
 * End-to-end test of the distribution pipeline against the real program.
 *
 * The point of this one, as distinct from distributor-test.mjs, is that the
 * proof handed to the chain comes out of the same code path that will serve
 * players -- rebuildTree in api/_lib/distribution.mjs, rebuilding from stored
 * award rows rather than from a tree kept in memory since it was built. That
 * rebuild is the part that could silently drift from the published root, and a
 * drift would only show up as claims being refused.
 *
 * Runs on Linux or WSL, against a local validator with the mainnet program
 * cloned at its real address:
 *
 *   solana-test-validator --reset --url https://api.mainnet-beta.solana.com \
 *     --clone-upgradeable-program mERKcfxMC5SqJn4Ld4BUris3WKZZ1ojjWJ3A3J5CKxv
 *
 *   npm install @solana/web3.js@1 @solana/spl-token@0.4
 *   GAME_DIR=/path/to/repo node pipeline-test.mjs
 */
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { pathToFileURL, fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction
} from '@solana/web3.js';
import {
    createMint,
    getOrCreateAssociatedTokenAccount,
    getAssociatedTokenAddressSync,
    mintTo,
    getAccount,
    createBurnInstruction,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME = process.env.GAME_DIR || resolve(HERE, '..');
const mod = (rel) => pathToFileURL(`${GAME}/${rel}`).href;

const { allocateDay } = await import(mod('src/economics/index.js'));
const { treeForAwards, verifyProof, leafFor } = await import(
    mod('src/economics/merkle.js')
);
const { rebuildTree } = await import(mod('api/_lib/distribution.mjs'));

const PROGRAM = new PublicKey('mERKcfxMC5SqJn4Ld4BUris3WKZZ1ojjWJ3A3J5CKxv');
const RPC = 'http://127.0.0.1:8899';
const DECIMALS = 9;

const discriminator = (name) =>
    createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
const u64 = (v) => {
    const b = Buffer.alloc(8);
    b.writeBigUInt64LE(BigInt(v));
    return b;
};
const i64 = (v) => {
    const b = Buffer.alloc(8);
    b.writeBigInt64LE(BigInt(v));
    return b;
};
const u32 = (v) => {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(v);
    return b;
};

const pass = [];
const fail = [];
const check = (ok, label, detail = '') => {
    (ok ? pass : fail).push(label);
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
};

const send = async (conn, ixs, signers) => {
    const tx = new Transaction().add(...ixs);
    tx.feePayer = signers[0].publicKey;
    tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
    tx.sign(...signers);
    const sig = await conn.sendRawTransaction(tx.serialize());
    await conn.confirmTransaction(sig, 'confirmed');
    return sig;
};

const main = async () => {
    const conn = new Connection(RPC, 'confirmed');
    console.log('=== validator ===');
    const info = await conn.getAccountInfo(PROGRAM);
    check(Boolean(info && info.executable), 'real distributor program present');

    // Three players with wildly different days, so caps and shares both bite.
    const players = [Keypair.generate(), Keypair.generate(), Keypair.generate()];
    const admin = Keypair.generate();
    for (const who of [admin, ...players]) {
        const sig = await conn.requestAirdrop(who.publicKey, 5_000_000_000);
        await conn.confirmTransaction(sig, 'confirmed');
    }

    console.log('\n=== allocate a day from scores ===');
    const scores = [8_000_000_000, 250_000, 900];
    const day = allocateDay(
        players.map((p, i) => ({
            address: p.publicKey.toBase58(),
            score: scores[i],
            balance: 0
        })),
        1
    );
    console.log(`  paid ${Math.round(day.paid)} of ${Math.round(day.ceiling)}, burning ${Math.round(day.burned)}`);

    const tree = treeForAwards(
        day.awards.map((a) => ({
            ...a,
            claimant: new PublicKey(a.address).toBuffer()
        })),
        DECIMALS
    );

    // This is what the database would hold: address, index, amount. Nothing else.
    const storedAwards = tree.claims.map((c) => ({
        address: c.address,
        index: c.index,
        amount: BigInt(c.amountUnlocked),
        score: 0
    }));

    console.log('\n=== rebuild from stored rows, as the endpoint does ===');
    const rebuilt = rebuildTree(storedAwards, tree.root);
    check(
        rebuilt.root.equals(tree.root),
        'root rebuilt from stored rows matches the published root',
        rebuilt.root.toString('hex').slice(0, 16) + '…'
    );

    // A row edited after publication must be caught, not silently served.
    try {
        rebuildTree(
            storedAwards.map((a, i) =>
                i === 0 ? { ...a, amount: a.amount + 1n } : a
            ),
            tree.root
        );
        check(false, 'a tampered award row is refused');
    } catch (error) {
        check(true, 'a tampered award row is refused', 'root mismatch');
    }

    try {
        rebuildTree(
            storedAwards.map((a, i) => (i === 1 ? { ...a, index: 9 } : a)),
            tree.root
        );
        check(false, 'a gap in leaf indexes is refused');
    } catch (error) {
        check(true, 'a gap in leaf indexes is refused', 'non-contiguous');
    }

    console.log('\n=== publish on chain ===');
    const mint = await createMint(conn, admin, admin.publicKey, null, DECIMALS);
    const [distributor] = PublicKey.findProgramAddressSync(
        [Buffer.from('MerkleDistributor'), mint.toBuffer(), u64(0)],
        PROGRAM
    );
    const vault = getAssociatedTokenAddressSync(mint, distributor, true);
    const clawback = await getOrCreateAssociatedTokenAccount(
        conn,
        admin,
        mint,
        admin.publicKey
    );

    const now = Math.floor(Date.now() / 1000);
    await send(
        conn,
        [
            new TransactionInstruction({
                programId: PROGRAM,
                keys: [
                    { pubkey: distributor, isSigner: false, isWritable: true },
                    { pubkey: clawback.address, isSigner: false, isWritable: true },
                    { pubkey: mint, isSigner: false, isWritable: false },
                    { pubkey: vault, isSigner: false, isWritable: true },
                    { pubkey: admin.publicKey, isSigner: true, isWritable: true },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
                ],
                data: Buffer.concat([
                    discriminator('new_distributor'),
                    u64(0),
                    tree.root,
                    u64(tree.total),
                    u64(tree.claims.length),
                    i64(now + 3600),
                    i64(now + 7200),
                    i64(now + 7200 + 86_400 + 60)
                ])
            })
        ],
        [admin]
    );

    const created = await conn.getAccountInfo(distributor);
    const onChainRoot = created.data.subarray(17, 49);
    check(
        onChainRoot.equals(rebuilt.root),
        'on-chain root equals the rebuilt root'
    );

    await mintTo(conn, admin, mint, vault, admin, BigInt(tree.total));
    check(
        (await getAccount(conn, vault)).amount === BigInt(tree.total),
        'vault funded with exactly the awarded total'
    );

    console.log('\n=== claim with a proof from the rebuild path ===');
    const claimant = players.find(
        (p) => p.publicKey.toBase58() === storedAwards[0].address
    );
    const award = storedAwards[0];
    const { proofFor } = await import(mod('src/economics/merkle.js'));
    const proof = proofFor(rebuilt.levels, award.index);
    check(
        verifyProof(proof, rebuilt.root, rebuilt.leaves[award.index]),
        'proof verifies locally before it is sent'
    );

    const ata = await getOrCreateAssociatedTokenAccount(
        conn,
        claimant,
        mint,
        claimant.publicKey
    );
    const [claimStatus] = PublicKey.findProgramAddressSync(
        [
            Buffer.from('ClaimStatus'),
            claimant.publicKey.toBuffer(),
            distributor.toBuffer()
        ],
        PROGRAM
    );

    await send(
        conn,
        [
            new TransactionInstruction({
                programId: PROGRAM,
                keys: [
                    { pubkey: distributor, isSigner: false, isWritable: true },
                    { pubkey: claimStatus, isSigner: false, isWritable: true },
                    { pubkey: vault, isSigner: false, isWritable: true },
                    { pubkey: ata.address, isSigner: false, isWritable: true },
                    { pubkey: claimant.publicKey, isSigner: true, isWritable: true },
                    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
                ],
                data: Buffer.concat([
                    discriminator('new_claim'),
                    u64(award.amount),
                    u64(0),
                    u32(proof.length),
                    ...proof
                ])
            })
        ],
        [claimant]
    );

    const got = await getAccount(conn, ata.address);
    check(
        got.amount === award.amount,
        'the chain accepted a proof rebuilt from stored rows',
        `${got.amount} base units`
    );

    console.log('\n=== burn the remainder ===');
    // The day's unspent ceiling is destroyed rather than kept. Minting it to a
    // holding account and burning from there is what makes the figure on the
    // site a transaction anyone can look up.
    const scale = 10 ** DECIMALS;
    const burnUnits = BigInt(Math.floor(day.burned * scale));
    await mintTo(conn, admin, mint, clawback.address, admin, burnUnits);
    const supplyBefore = (await conn.getTokenSupply(mint)).value.amount;

    await send(
        conn,
        [
            createBurnInstruction(
                clawback.address,
                mint,
                admin.publicKey,
                burnUnits
            )
        ],
        [admin]
    );

    const supplyAfter = (await conn.getTokenSupply(mint)).value.amount;
    check(
        BigInt(supplyBefore) - BigInt(supplyAfter) === burnUnits,
        'burning the remainder reduces total supply',
        `${burnUnits} destroyed`
    );
    check(
        (await getAccount(conn, clawback.address)).amount === 0n,
        'nothing is left behind in the holding account'
    );

    console.log(`\n=== ${pass.length} passed, ${fail.length} failed ===`);
    if (fail.length) {
        fail.forEach((f) => console.log(`  FAILED: ${f}`));
        process.exit(1);
    }
};

main().catch((error) => {
    console.error('\nFATAL:', error.message);
    if (error.logs) error.logs.slice(-12).forEach((l) => console.error('  ', l));
    process.exit(1);
});
