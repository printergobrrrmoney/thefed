/**
 * Byte-for-byte comparison of our hand-rolled message serialiser against
 * @solana/web3.js.
 *
 * Account ordering and the short-vec lengths are the parts that fail quietly:
 * a wrong order still serialises, still signs, and is only rejected on chain
 * with an error that says nothing useful. So the check is equality with the
 * reference implementation over cases chosen to exercise every ordering rule.
 *
 * Run where web3.js is installed (WSL):
 *   GAME_DIR=/path/to/repo node message-parity.mjs
 */
import { pathToFileURL, fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import {
    Keypair,
    PublicKey,
    Transaction,
    TransactionInstruction,
    SystemProgram
} from '@solana/web3.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME = process.env.GAME_DIR || resolve(HERE, '..');
const mod = (rel) => pathToFileURL(`${GAME}/${rel}`).href;
const { serializeMessage, base58Encode, base58Decode, compactU16 } =
    await import(mod('src/wallet/transaction.js'));

const pass = [];
const fail = [];
const check = (ok, label, detail = '') => {
    (ok ? pass : fail).push(label);
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
};

const blockhash = base58Encode(Keypair.generate().publicKey.toBytes());

/** Same instruction set, described twice: once for each implementation. */
const compare = (label, payer, specs) => {
    const tx = new Transaction();
    tx.feePayer = new PublicKey(payer);
    tx.recentBlockhash = blockhash;
    specs.forEach((spec) => {
        tx.add(
            new TransactionInstruction({
                programId: new PublicKey(spec.programId),
                keys: spec.keys.map((k) => ({
                    pubkey: new PublicKey(k.address),
                    isSigner: k.isSigner,
                    isWritable: k.isWritable
                })),
                data: Buffer.from(spec.data)
            })
        );
    });
    const expected = tx.serializeMessage();
    const actual = Buffer.from(
        serializeMessage({ payer, instructions: specs, recentBlockhash: blockhash })
    );

    const same = expected.equals(actual);
    check(
        same,
        label,
        same
            ? `${actual.length} bytes`
            : (() => {
                  let at = 0;
                  while (at < expected.length && expected[at] === actual[at]) at += 1;
                  return `first differs at byte ${at} of ${expected.length}: expected ${expected
                      .slice(at, at + 8)
                      .toString('hex')}, got ${actual.slice(at, at + 8).toString('hex')}`;
              })()
    );
    return same;
};

const key = () => Keypair.generate().publicKey.toBase58();

console.log('=== base58 round trip ===');
{
    const raw = Keypair.generate().publicKey.toBytes();
    const encoded = base58Encode(raw);
    check(
        encoded === new PublicKey(raw).toBase58(),
        'encode matches PublicKey.toBase58'
    );
    check(
        Buffer.from(base58Decode(encoded)).equals(Buffer.from(raw)),
        'decode round trips'
    );
    // Leading zero bytes are the classic base58 bug.
    const leading = new Uint8Array(32);
    leading[31] = 7;
    check(
        base58Encode(leading) === new PublicKey(leading).toBase58(),
        'leading zero bytes survive encoding',
        base58Encode(leading).slice(0, 12) + '…'
    );
}

console.log('\n=== short vector lengths ===');
[0, 1, 5, 127, 128, 255, 256, 16383, 16384].forEach((n) => {
    const mine = Buffer.from(compactU16(n));
    // web3.js encodes lengths the same way inside serializeMessage; check the
    // shape directly rather than trusting it implicitly.
    const expected =
        n < 0x80
            ? Buffer.from([n])
            : n < 0x4000
              ? Buffer.from([(n & 0x7f) | 0x80, n >> 7])
              : Buffer.from([(n & 0x7f) | 0x80, ((n >> 7) & 0x7f) | 0x80, n >> 14]);
    check(mine.equals(expected), `compactU16(${n})`, mine.toString('hex'));
});

console.log('\n=== message serialisation ===');
{
    const payer = key();
    compare('one instruction, payer only', payer, [
        { programId: key(), keys: [], data: [1, 2, 3] }
    ]);

    const writable = key();
    const readonly = key();
    compare('writable and read-only non-signers', payer, [
        {
            programId: key(),
            keys: [
                { address: writable, isSigner: false, isWritable: true },
                { address: readonly, isSigner: false, isWritable: false }
            ],
            data: [9]
        }
    ]);

    const cosigner = key();
    compare('a second signer, ordered before non-signers', payer, [
        {
            programId: key(),
            keys: [
                { address: readonly, isSigner: false, isWritable: false },
                { address: cosigner, isSigner: true, isWritable: false },
                { address: writable, isSigner: false, isWritable: true }
            ],
            data: [4, 5]
        }
    ]);

    compare('an account appearing twice with different flags', payer, [
        {
            programId: key(),
            keys: [
                { address: writable, isSigner: false, isWritable: false },
                { address: writable, isSigner: false, isWritable: true }
            ],
            data: [0]
        }
    ]);

    compare('two instructions sharing accounts', payer, [
        {
            programId: SystemProgram.programId.toBase58(),
            keys: [{ address: writable, isSigner: false, isWritable: true }],
            data: [1]
        },
        {
            programId: key(),
            keys: [
                { address: writable, isSigner: false, isWritable: true },
                { address: readonly, isSigner: false, isWritable: false }
            ],
            data: new Array(200).fill(7)
        }
    ]);

    // The shape a real claim takes: seven accounts, a long proof payload.
    compare('a claim-shaped instruction', payer, [
        {
            programId: key(),
            keys: [
                { address: key(), isSigner: false, isWritable: true },
                { address: key(), isSigner: false, isWritable: true },
                { address: key(), isSigner: false, isWritable: true },
                { address: key(), isSigner: false, isWritable: true },
                { address: payer, isSigner: true, isWritable: true },
                { address: key(), isSigner: false, isWritable: false },
                { address: key(), isSigner: false, isWritable: false }
            ],
            data: new Array(8 + 8 + 8 + 4 + 32 * 12).fill(3)
        }
    ]);
}

console.log(`\n=== ${pass.length} passed, ${fail.length} failed ===`);
if (fail.length) process.exit(1);
