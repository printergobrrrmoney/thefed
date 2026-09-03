/* global BigInt */
/**
 * Publish an allocated day on chain.
 *
 * Takes a day already recorded by allocate-day.mjs and creates the distributor,
 * funds its vault from the operator's own balance, and writes the signatures
 * back so every step can be looked up afterwards.
 *
 *   node scripts/publish-day.mjs 2026-09-03 \
 *     --clawback <treasury address> [--burn <tokens>] [--commit]
 *
 * The clawback receiver has to be named explicitly and is never defaulted.
 * Whoever it points at can take the entire vault once the clawback date
 * passes, so it belongs to the treasury and never to the key running this
 * script. It is fixed at creation and cannot be changed for that distributor.
 *
 * Funding is a transfer, not a mint: the supply is fixed and this only ever
 * moves tokens the operator already holds.
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
} from '@solana/web3.js';
import {
    getAssociatedTokenAddressSync,
    getAccount,
    createTransferInstruction,
    createBurnInstruction,
    createAssociatedTokenAccountIdempotentInstruction,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

const here = new URL('.', import.meta.url);
const env = Object.fromEntries(
    readFileSync(new URL('../.env.development.local', here), 'utf8')
        .split('\n')
        .filter((line) => line.includes('='))
        .map((line) => {
            const at = line.indexOf('=');
            return [
                line.slice(0, at),
                line.slice(at + 1).replace(/^"|"$/g, ''),
            ];
        })
);
Object.assign(process.env, env);

const { db } = await import('../api/_lib/db.mjs');
const { distributionForDay, awardsForDay, rebuildTree } = await import(
    '../api/_lib/distribution.mjs'
);

const PROGRAM = new PublicKey('mERKcfxMC5SqJn4Ld4BUris3WKZZ1ojjWJ3A3J5CKxv');
const args = process.argv.slice(2);
const day = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const flag = (name) => {
    const at = args.indexOf(`--${name}`);
    return at === -1 ? null : args[at + 1];
};
const commit = args.includes('--commit');
const clawbackTo = flag('clawback');
const burnTokens = flag('burn');
const rpc = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const keyPath =
    flag('keypair') ||
    `${process.env.USERPROFILE || process.env.HOME}/.brrr/operator.json`;

if (!day) {
    console.error(
        'usage: publish-day.mjs YYYY-MM-DD --clawback <address> [--commit]'
    );
    process.exit(1);
}
if (!clawbackTo) {
    console.error(
        'a --clawback address is required. Whoever it names can take the vault\n' +
            'after the clawback date, so it must be a deliberate choice.'
    );
    process.exit(1);
}

const operator = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(keyPath, 'utf8')))
);
const conn = new Connection(rpc, 'confirmed');
const sql = db();

const distribution = await distributionForDay(sql, day);
if (!distribution) {
    console.error(`${day} has not been allocated. Run allocate-day.mjs first.`);
    process.exit(1);
}
if (distribution.distributor) {
    console.error(
        `${day} is already published at ${distribution.distributor}. ` +
            'Publishing twice would create a second vault for one root.'
    );
    process.exit(1);
}

const awards = await awardsForDay(sql, day);
const { root } = rebuildTree(awards, distribution.root);

const mint = new PublicKey(distribution.mint);
const version = BigInt(distribution.version);
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
const disc = (name) =>
    createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);

const [distributor] = PublicKey.findProgramAddressSync(
    [Buffer.from('MerkleDistributor'), mint.toBuffer(), u64(version)],
    PROGRAM
);
const vault = getAssociatedTokenAddressSync(mint, distributor, true);
const operatorAta = getAssociatedTokenAddressSync(mint, operator.publicKey);
const clawbackReceiver = getAssociatedTokenAddressSync(
    mint,
    new PublicKey(clawbackTo)
);

const scale = 10n ** 9n;
const show = (units) => (Number(units) / Number(scale)).toLocaleString('en-US');

let held = 0n;
try {
    held = (await getAccount(conn, operatorAta)).amount;
} catch (error) {
    console.error('The operator holds no account for that mint.');
    process.exit(1);
}

const burnUnits = burnTokens
    ? BigInt(Math.floor(Number(burnTokens) * 1e9))
    : 0n;

console.log(`\nPublishing ${day}`);
console.log(`  operator      : ${operator.publicKey.toBase58()}`);
console.log(`  mint          : ${mint.toBase58()}`);
console.log(`  distributor   : ${distributor.toBase58()}`);
console.log(`  vault         : ${vault.toBase58()}`);
console.log(`  clawback to   : ${clawbackTo}`);
console.log(`  root          : ${root.toString('hex')}`);
console.log(`  awards        : ${awards.length}`);
console.log(`  to fund       : ${show(distribution.totalAwarded)} tokens`);
console.log(
    `  to burn       : ${burnTokens ? show(burnUnits) : '(none this run)'}`
);
console.log(`  operator holds: ${show(held)} tokens`);

if (held < distribution.totalAwarded + burnUnits) {
    console.error(
        '\nNot enough tokens to fund the vault. Refusing to publish half a day.'
    );
    process.exit(1);
}

if (!commit) {
    console.log('\nDry run. Pass --commit to publish.');
    process.exit(0);
}

const send = async (label, instructions) => {
    const tx = new Transaction().add(...instructions);
    tx.feePayer = operator.publicKey;
    tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
    tx.sign(operator);
    const sig = await conn.sendRawTransaction(tx.serialize());
    await conn.confirmTransaction(sig, 'confirmed');
    console.log(`  ${label}: ${sig}`);
    return sig;
};

const now = Math.floor(Date.now() / 1000);
const createdTx = await send('created ', [
    // The clawback receiver must exist before it can be named.
    createAssociatedTokenAccountIdempotentInstruction(
        operator.publicKey,
        clawbackReceiver,
        new PublicKey(clawbackTo),
        mint
    ),
    new TransactionInstruction({
        programId: PROGRAM,
        keys: [
            { pubkey: distributor, isSigner: false, isWritable: true },
            { pubkey: clawbackReceiver, isSigner: false, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: vault, isSigner: false, isWritable: true },
            { pubkey: operator.publicKey, isSigner: true, isWritable: true },
            {
                pubkey: SystemProgram.programId,
                isSigner: false,
                isWritable: false,
            },
            {
                pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
                isSigner: false,
                isWritable: false,
            },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: Buffer.concat([
            disc('new_distributor'),
            u64(version),
            root,
            u64(distribution.totalAwarded),
            u64(awards.length),
            // Vesting must be in the future; unlocked amounts are unaffected by it.
            i64(now + 3600),
            i64(now + 7200),
            i64(now + 7200 + 86_400 + 60),
        ]),
    }),
]);

const fundedTx = await send('funded  ', [
    createTransferInstruction(
        operatorAta,
        vault,
        operator.publicKey,
        distribution.totalAwarded
    ),
]);

let burnedTx = null;
if (burnUnits > 0n) {
    burnedTx = await send('burned  ', [
        createBurnInstruction(operatorAta, mint, operator.publicKey, burnUnits),
    ]);
}

// `burned` records what was destroyed, not what allocation intended to
// destroy. A run that burns less than the remainder leaves the day unsettled,
// and the column has to say so or it asserts a burn that never happened.
await sql`
    update distributions
    set distributor = ${distributor.toBase58()},
        created_tx = ${createdTx},
        funded_tx = ${fundedTx},
        burned_tx = ${burnedTx},
        burned = ${burnUnits.toString()}
    where day = ${day}
`;

if (burnUnits < distribution.ceiling - distribution.totalAwarded) {
    console.log(
        `
NOT SETTLED: ${show(
            distribution.ceiling - distribution.totalAwarded - burnUnits
        )} tokens of this day's remainder were not burned.`
    );
}

const vaultNow = await getAccount(conn, vault);
console.log(`\nVault holds ${show(vaultNow.amount)} tokens.`);
console.log(`${day} is published and claimable.`);
