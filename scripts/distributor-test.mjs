/**
 * End-to-end test of the real distributor, against the real program.
 *
 * It runs the whole payout path rather than a mock of it: our economics choose
 * the awards, our merkle module builds the tree, and the actual mainnet
 * bytecode -- cloned at its real address so its declared program id still
 * matches -- is the only thing that decides whether a claim is valid.
 *
 * This must pass before any real distribution. A wrong discriminator, account
 * order or argument layout means every claim fails at exactly the moment it
 * matters most, and none of that is visible from reading our own code.
 *
 * Running it (Linux or WSL -- solana-test-validator does not work on Windows,
 * and the in-process alternatives ship no Windows build):
 *
 *     sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
 *     solana program dump mERKcfx...CKxv d.so --url mainnet-beta
 *     solana-test-validator --reset --url mainnet-beta \
 *         --clone-upgradeable-program mERKcfxMC5SqJn4Ld4BUris3WKZZ1ojjWJ3A3J5CKxv
 *
 * Then, in a scratch directory holding payer.json and claimant.json:
 *
 *     npm install @solana/web3.js@1 @solana/spl-token@0.4
 *     GAME_DIR=/path/to/this/repo node distributor-test.mjs
 *
 * The two libraries are deliberately not repo dependencies. Nothing in src/
 * may import them -- @solana/web3.js ships syntax this project's babel cannot
 * parse -- and a manual pre-launch check is not worth risking the build over.
 */
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction,
    SYSVAR_RENT_PUBKEY
} from '@solana/web3.js';
import {
    createMint,
    getOrCreateAssociatedTokenAccount,
    getAssociatedTokenAddressSync,
    mintTo,
    getAccount,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';

import { pathToFileURL, fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const HERE = dirname(fileURLToPath(import.meta.url));
const GAME = process.env.GAME_DIR || resolve(HERE, '..');
const mod = (rel) => pathToFileURL(`${GAME}/${rel}`).href;
const { allocateDay } = await import(mod('src/economics/index.js'));
const { treeForAwards, leafFor, verifyProof } = await import(mod('src/economics/merkle.js'));

const PROGRAM = new PublicKey('mERKcfxMC5SqJn4Ld4BUris3WKZZ1ojjWJ3A3J5CKxv');
const RPC = 'http://127.0.0.1:8899';
const DECIMALS = 9;

/** Anchor dispatches on the first 8 bytes of sha256("global:<fn>"). */
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

const load = (file) =>
    Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(readFileSync(file, 'utf8')))
    );

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
    const sig = await conn.sendRawTransaction(tx.serialize(), {
        skipPreflight: false
    });
    await conn.confirmTransaction(sig, 'confirmed');
    return sig;
};

/**
 * A rejection only counts if it is the rejection we expected. Catching any
 * error and calling it a pass would let an incidental failure -- a funding
 * problem, a malformed account -- masquerade as the security property.
 */
const anchorErrorOf = (error) => {
    const logs = (error.logs || []).join('\n');
    const named = logs.match(/Error Code: (\w+)/);
    if (named) return named[1];
    if (/already in use/i.test(error.message || '')) return 'AccountAlreadyInUse';
    return 'unrecognised: ' + (error.message || '').split('\n')[0].slice(0, 60);
};

const expectRejection = async (label, expected, run) => {
    try {
        await run();
        check(false, label, 'the program ACCEPTED it');
    } catch (error) {
        const code = anchorErrorOf(error);
        check(
            code === expected,
            label,
            code === expected ? code : 'got ' + code + ', expected ' + expected
        );
    }
};

const main = async () => {
    const conn = new Connection(RPC, 'confirmed');

    console.log('=== validator ===');
    const version = await conn.getVersion();
    console.log('  solana-core', version['solana-core']);
    const programInfo = await conn.getAccountInfo(PROGRAM);
    check(
        Boolean(programInfo && programInfo.executable),
        'the real distributor program is present at its mainnet address'
    );

    const admin = load('./payer.json');
    const claimant = load('./claimant.json');
    const other = Keypair.generate();

    for (const who of [admin, claimant]) {
        const sig = await conn.requestAirdrop(who.publicKey, 5_000_000_000);
        await conn.confirmTransaction(sig, 'confirmed');
    }

    console.log('\n=== our economics decide the awards ===');
    // Two real-looking players: one big score, one small, both at base tier.
    const players = [
        { address: admin.publicKey.toBase58(), score: 9_500_000_000, balance: 0 },
        { address: claimant.publicKey.toBase58(), score: 12_000, balance: 0 }
    ];
    const day = allocateDay(players, 1);
    console.log(`  day 1: paid ${Math.round(day.paid)}, burned ${Math.round(day.burned)} of ${Math.round(day.ceiling)}`);
    day.awards.forEach((a) =>
        console.log(`    ${a.address.slice(0, 8)}… ${a.amount.toFixed(4)} BRRR`)
    );

    console.log('\n=== our merkle module builds the tree ===');
    const tree = treeForAwards(
        day.awards.map((award) => ({
            ...award,
            claimant: new PublicKey(award.address).toBuffer()
        })),
        DECIMALS
    );
    console.log('  root ', tree.root.toString('hex'));
    console.log('  total', tree.total, 'base units across', tree.claims.length, 'claims');

    console.log('\n=== set up the token ===');
    const mint = await createMint(
        conn,
        admin,
        admin.publicKey,
        null,
        DECIMALS
    );
    console.log('  mint', mint.toBase58());

    const versionNum = 0;
    const [distributor] = PublicKey.findProgramAddressSync(
        [
            Buffer.from('MerkleDistributor'),
            mint.toBuffer(),
            u64(versionNum)
        ],
        PROGRAM
    );
    const vault = getAssociatedTokenAddressSync(mint, distributor, true);
    const clawbackReceiver = await getOrCreateAssociatedTokenAccount(
        conn,
        admin,
        mint,
        admin.publicKey
    );

    console.log('\n=== create the distributor (permissionless) ===');
    const now = Math.floor(Date.now() / 1000);
    const data = Buffer.concat([
        discriminator('new_distributor'),
        u64(versionNum),
        tree.root,
        u64(tree.total),
        u64(tree.claims.length),
        // The program requires all three to be in the future. That does not
        // delay anything we care about: the unlocked amount transfers on
        // claim, and vesting only gates the locked portion, which is zero.
        i64(now + 3_600),
        i64(now + 7_200),
        i64(now + 7_200 + 86_400 + 60) // must be >= end + one day
    ]);

    const newDistributorIx = new TransactionInstruction({
        programId: PROGRAM,
        keys: [
            { pubkey: distributor, isSigner: false, isWritable: true },
            { pubkey: clawbackReceiver.address, isSigner: false, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: vault, isSigner: false, isWritable: true },
            { pubkey: admin.publicKey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
        ],
        data
    });

    await send(conn, [newDistributorIx], [admin]);
    const created = await conn.getAccountInfo(distributor);
    check(Boolean(created), 'distributor created by an ordinary signer', distributor.toBase58().slice(0, 12) + '…');
    check(created.data.length === 240, 'account is the expected 240 bytes');

    // Read back the root the program stored, to be sure it is ours.
    const storedRoot = created.data.subarray(8 + 1 + 8, 8 + 1 + 8 + 32);
    check(storedRoot.equals(tree.root), 'on-chain root equals the root we published');

    console.log('\n=== fund the vault ===');
    await mintTo(conn, admin, mint, vault, admin, BigInt(tree.total));
    const vaultAcct = await getAccount(conn, vault);
    check(vaultAcct.amount === BigInt(tree.total), 'vault holds exactly the published total', String(vaultAcct.amount));

    console.log('\n=== claim ===');
    const claim = tree.claims.find(
        (c) => c.address === claimant.publicKey.toBase58()
    );
    const claimantAta = await getOrCreateAssociatedTokenAccount(
        conn,
        claimant,
        mint,
        claimant.publicKey
    );

    const claimIx = (payload, signerPubkey, ata) => {
        const [claimStatus] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('ClaimStatus'),
                signerPubkey.toBuffer(),
                distributor.toBuffer()
            ],
            PROGRAM
        );
        return new TransactionInstruction({
            programId: PROGRAM,
            keys: [
                { pubkey: distributor, isSigner: false, isWritable: true },
                { pubkey: claimStatus, isSigner: false, isWritable: true },
                { pubkey: vault, isSigner: false, isWritable: true },
                { pubkey: ata, isSigner: false, isWritable: true },
                { pubkey: signerPubkey, isSigner: true, isWritable: true },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
            ],
            data: payload
        });
    };

    const claimData = (unlocked, locked, proof) =>
        Buffer.concat([
            discriminator('new_claim'),
            u64(unlocked),
            u64(locked),
            u32(proof.length),
            ...proof
        ]);

    // The honest claim.
    await send(
        conn,
        [
            claimIx(
                claimData(claim.amountUnlocked, claim.amountLocked, claim.proof),
                claimant.publicKey,
                claimantAta.address
            )
        ],
        [claimant]
    );

    const after = await getAccount(conn, claimantAta.address);
    check(
        after.amount === BigInt(claim.amountUnlocked),
        'claimant received exactly their award',
        `${after.amount} base units`
    );

    console.log('\n=== the program rejects what it should ===');

    await expectRejection(
        'a second claim by the same wallet is refused',
        'AccountAlreadyInUse',
        () =>
            send(
                conn,
                [
                    claimIx(
                        claimData(
                            claim.amountUnlocked,
                            claim.amountLocked,
                            claim.proof
                        ),
                        claimant.publicKey,
                        claimantAta.address
                    )
                ],
                [claimant]
            )
    );

    const fundAndAta = async (who) => {
        const sig = await conn.requestAirdrop(who.publicKey, 2_000_000_000);
        await conn.confirmTransaction(sig, 'confirmed');
        return getOrCreateAssociatedTokenAccount(conn, who, mint, who.publicKey);
    };

    const otherAta = await fundAndAta(other);
    await expectRejection(
        'an inflated amount with a valid proof is refused',
        'InvalidProof',
        () =>
            send(
                conn,
                [
                    claimIx(
                        claimData(999_999_999_999, 0, claim.proof),
                        other.publicKey,
                        otherAta.address
                    )
                ],
                [other]
            )
    );

    const greedy = Keypair.generate();
    const greedyAta = await fundAndAta(greedy);
    await expectRejection(
        'a wallet that was never in the tree is refused',
        'InvalidProof',
        () =>
            send(
                conn,
                [
                    claimIx(
                        claimData(claim.amountUnlocked, 0, claim.proof),
                        greedy.publicKey,
                        greedyAta.address
                    )
                ],
                [greedy]
            )
    );

    console.log(`\n=== ${pass.length} passed, ${fail.length} failed ===`);
    if (fail.length) {
        fail.forEach((f) => console.log(`  FAILED: ${f}`));
        process.exit(1);
    }
};

main().catch((error) => {
    console.error('\nFATAL:', error.message);
    if (error.logs) error.logs.slice(-15).forEach((l) => console.error('  ', l));
    process.exit(1);
});
