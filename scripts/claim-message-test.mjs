/**
 * Claim on chain using a message this project built by hand.
 *
 * The parity test proves our serialiser agrees with @solana/web3.js. This one
 * proves the agreement is worth something: the message the browser would build,
 * signed and submitted raw, and accepted by the real program. web3.js is used
 * only to set the scene — mint, distributor, funding — and never touches the
 * claim itself.
 *
 * Run in WSL against a validator with the mainnet program cloned:
 *   GAME_DIR=/path/to/repo node claim-message-test.mjs
 */
import { createHash, sign as edSign, createPrivateKey } from 'crypto';
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
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME = process.env.GAME_DIR || resolve(HERE, '..');
const mod = (rel) => pathToFileURL(`${GAME}/${rel}`).href;

const { buildClaimMessage, NEW_CLAIM_DISCRIMINATOR } = await import(
    mod('src/claim/instruction.js')
);
const { treeForAwards, proofFor: proofAt, leafFor } = await import(
    mod('src/economics/merkle.js')
);
const { rebuildTree } = await import(mod('api/_lib/distribution.mjs'));
const { compactU16 } = await import(mod('src/wallet/transaction.js'));

const PROGRAM = new PublicKey('mERKcfxMC5SqJn4Ld4BUris3WKZZ1ojjWJ3A3J5CKxv');
const DECIMALS = 9;
const conn = new Connection('http://127.0.0.1:8899', 'confirmed');

const pass = [];
const fail = [];
const check = (ok, label, detail = '') => {
    (ok ? pass : fail).push(label);
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
};

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

console.log('=== the hard-coded discriminator ===');
check(
    Buffer.from(NEW_CLAIM_DISCRIMINATOR).equals(disc('new_claim')),
    'matches sha256("global:new_claim")',
    Buffer.from(NEW_CLAIM_DISCRIMINATOR).toString('hex')
);

const admin = Keypair.generate();
const claimant = Keypair.generate();
for (const who of [admin, claimant]) {
    await conn.confirmTransaction(
        await conn.requestAirdrop(who.publicKey, 5_000_000_000),
        'confirmed'
    );
}

console.log('\n=== set the scene with the library ===');
const tree = treeForAwards(
    [
        { address: claimant.publicKey.toBase58(), amount: 1234.5, claimant: claimant.publicKey.toBuffer() },
        { address: admin.publicKey.toBase58(), amount: 900, claimant: admin.publicKey.toBuffer() }
    ],
    DECIMALS
);
const mint = await createMint(conn, admin, admin.publicKey, null, DECIMALS);
const [distributor] = PublicKey.findProgramAddressSync(
    [Buffer.from('MerkleDistributor'), mint.toBuffer(), u64(0)],
    PROGRAM
);
const vault = getAssociatedTokenAddressSync(mint, distributor, true);
const clawback = await getOrCreateAssociatedTokenAccount(conn, admin, mint, admin.publicKey);
const now = Math.floor(Date.now() / 1000);

const setup = new Transaction().add(
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
            disc('new_distributor'),
            u64(0),
            tree.root,
            u64(tree.total),
            u64(tree.claims.length),
            i64(now + 3600),
            i64(now + 7200),
            i64(now + 7200 + 86_400 + 60)
        ])
    })
);
setup.feePayer = admin.publicKey;
setup.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
setup.sign(admin);
await conn.confirmTransaction(
    await conn.sendRawTransaction(setup.serialize()),
    'confirmed'
);
await mintTo(conn, admin, mint, vault, admin, BigInt(tree.total));
check(true, 'distributor created and vault funded', `${tree.total} base units`);

// The claimant's token account, created the ordinary way. In the browser this
// is the instruction the page prepends when the account does not exist yet.
const destination = await getOrCreateAssociatedTokenAccount(
    conn,
    claimant,
    mint,
    claimant.publicKey
);

console.log('\n=== build the claim in our own code ===');
const stored = tree.claims.map((c) => ({
    address: c.address,
    index: c.index,
    amount: BigInt(c.amountUnlocked),
    score: 0
}));
const rebuilt = rebuildTree(stored, tree.root);
const mine = stored.find((s) => s.address === claimant.publicKey.toBase58());
const proof = proofAt(rebuilt.levels, mine.index).map((n) => n.toString('hex'));

const [claimStatus] = PublicKey.findProgramAddressSync(
    [Buffer.from('ClaimStatus'), claimant.publicKey.toBuffer(), distributor.toBuffer()],
    PROGRAM
);

const blockhash = (await conn.getLatestBlockhash()).blockhash;
const built = buildClaimMessage({
    claimant: claimant.publicKey.toBase58(),
    distributor: distributor.toBase58(),
    claimStatus: claimStatus.toBase58(),
    vault: vault.toBase58(),
    destination: destination.address.toBase58(),
    amountUnlocked: mine.amount.toString(),
    amountLocked: '0',
    proof,
    recentBlockhash: blockhash
});
check(built.message.length > 0, 'message built', `${built.message.length} bytes`);

console.log('\n=== sign it without the library ===');
// Raw ed25519 over the message bytes, exactly what a wallet does internally.
const pkcs8 = Buffer.concat([
    Buffer.from('302e020100300506032b657004220420', 'hex'),
    Buffer.from(claimant.secretKey.slice(0, 32))
]);
const signature = edSign(
    null,
    Buffer.from(built.message),
    createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' })
);
check(signature.length === 64, 'produced a 64-byte signature');

const wire = Buffer.concat([
    Buffer.from(compactU16(1)),
    signature,
    Buffer.from(built.message)
]);

console.log('\n=== submit it raw ===');
const before = (await getAccount(conn, destination.address)).amount;
let sent = null;
try {
    sent = await conn.sendRawTransaction(wire, { skipPreflight: false });
    await conn.confirmTransaction(sent, 'confirmed');
    check(true, 'the chain accepted a hand-built, hand-signed claim', sent.slice(0, 16) + '…');
} catch (error) {
    check(false, 'the chain accepted a hand-built, hand-signed claim', error.message.split('\n')[0]);
    if (error.logs) error.logs.slice(-8).forEach((l) => console.log('     ', l));
}

const after = (await getAccount(conn, destination.address)).amount;
check(
    after - before === mine.amount,
    'the claimant received exactly the awarded amount',
    `${after - before} base units`
);

console.log(`\n=== ${pass.length} passed, ${fail.length} failed ===`);
if (fail.length) process.exit(1);
